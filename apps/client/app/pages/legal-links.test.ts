import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import { parse } from 'vue/compiler-sfc'

/**
 * client-shell spec F-20 · D-32 · D-35 · D-36 — 발급기 화면의 법정 링크 · 고지 문구(개인정보 보호법 30조 · 약관 3조① · 6조④ · 12조③).
 * 화면 배선은 소스로 본다(main 에는 컴포넌트 렌더 테스트 의존성이 없다 — 그리는 규칙 자체는 utils/legal-render.test.ts 가 실문서로 본다).
 */
const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')

// 템플릿 AST(vue/compiler-sfc) — 소스 글자 대신 실제 요소의 부모 · 자식 관계로 본다
interface TNode {
  type: number
  tag?: string
  props?: {
    type: number
    name: string
    rawName?: string
    value?: { content: string }
    exp?: { content: string }
    arg?: { content: string; isStatic?: boolean }
  }[]
  children?: TNode[]
  loc: { source: string }
}
const ELEMENT = 1
const attr = (n: TNode, name: string) => n.props?.find((p) => p.type === 6 && p.name === name)?.value?.content
const dir = (n: TNode, raw: string) => n.props?.find((p) => p.type === 7 && p.rawName === raw)?.exp?.content
const cls = (n: TNode) => attr(n, 'class') ?? ''
const text = (n: TNode) => n.loc.source
function findAll(root: TNode, ok: (n: TNode) => boolean) {
  const out: { node: TNode; ancestors: TNode[] }[] = []
  const walk = (n: TNode, up: TNode[]) => {
    if (n.type === ELEMENT && ok(n)) out.push({ node: n, ancestors: up })
    for (const c of n.children ?? []) walk(c, n.type === ELEMENT ? [...up, n] : up)
  }
  walk(root, [])
  return out
}
const find = (root: TNode, ok: (n: TNode) => boolean) => findAll(root, ok)[0]?.node
const template = (src: string) =>
  src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>'))
const APP = fileURLToPath(new URL('..', import.meta.url))
const SERVER = fileURLToPath(new URL('../../server', import.meta.url))
const SHARED = fileURLToPath(new URL('../../shared', import.meta.url))
const NUXT_CONFIG = fileURLToPath(new URL('../../nuxt.config.ts', import.meta.url))
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const code = (dir: string) =>
  walk(dir).filter((f) => /\.(vue|ts)$/.test(f) && !/\.test\.ts$/.test(f))

describe('발급기 법정 링크(F-20)', () => {
  it('verify — 개인정보처리방침(굵게 · 색 구분 클래스) · 이용약관, 새 탭', () => {
    const t = template(read('./verify/[orderId].vue'))
    expect(t).toMatch(
      /<a\s+class="verify-page__policy-link verify-page__policy-link--privacy"\s+href="\/privacy"\s+target="_blank"\s+rel="noopener"\s*>개인정보처리방침<span class="sr-only"> \(새 창\)<\/span><\/a/,
    )
    expect(t).toMatch(
      /href="\/terms"\s+target="_blank"\s+rel="noopener"\s*>이용약관<span class="sr-only"> \(새 창\)<\/span><\/a/,
    )
    // 방침은 굵게 · 색으로 다른 링크와 구분(처리방침 작성지침) · 터치 영역 24px 이상
    const css = read('./verify/[orderId].vue')
    expect(css).toMatch(
      /\.verify-page__policy-link--privacy \{[^}]*color: var\(--n-color-primary-600[^}]*font-weight: 700/,
    )
    expect(css).toMatch(/\.verify-page__policy-link \{[^}]*min-height: 24px/)
    // 크게 확대해도 두 링크 줄이 넘치지 않게(넘치면 «개인정보처리방침» 앞 글자가 가려진다) · 링크 글자는 안 갈림
    expect(css).toMatch(/\.verify-page__policy \{[^}]*flex-wrap: wrap;/)
    expect(css).toMatch(/\.verify-page__policy-link \{[^}]*white-space: nowrap;/)
  })

  it('발급 필수 동의 문구(D-44) — 글자 그대로 · «이용약관» · «취소·환불 정책» 링크는 하단 시트를 연다(D-45 — 새 탭 아님 · href 는 남김)', () => {
    const src = read('../components/legal/IssueConsentLabel.vue')
    const tpl = parse(src).descriptor.template!.ast! as unknown as TNode
    const links = findAll(tpl, (n) => n.tag === 'a').map((l) => l.node)
    expect(links.map((l) => [attr(l, 'href'), attr(l, 'target'), attr(l, 'aria-haspopup'), dir(l, '@click.prevent')])).toEqual([
      ['/terms', undefined, 'dialog', "emit('open', 'terms')"],
      ['/refund', undefined, 'dialog', "emit('open', 'refund')"],
    ])
    expect(src).toMatch(/defineEmits<\{ open: \[doc: 'terms' \| 'refund'\] \}>\(\)/)
    // 화면 글자(줄바꿈 정리) = 결정 글자
    const shown = template(src).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    expect(shown).toBe('(필수) 이용약관과 취소·환불 정책을 확인했으며 설치 전 환불 시 환불 비용이 발생하는 것에 동의합니다.')
  })

  it('약관 · 환불 정책 하단 시트(D-45) — 확인 팝업 안 · X(closable) · 본문 = 생성물(LegalMarkdown) · 본문만 스크롤 · 팝업을 닫으면 시트도', () => {
    const src = read('./select-date/[orderId].vue')
    const tpl = parse(src).descriptor.template!.ast! as unknown as TNode
    const dialog = find(tpl, (n) => n.tag === 'NAlertDialog' && dir(n, 'v-model') === 'isConfirmOrderVisible')!
    const sheets = findAll(dialog, (n) => n.tag === 'NBottomSheet')
    expect(sheets).toHaveLength(1)
    const sheet = sheets[0]!.node
    expect(dir(sheet, 'v-model')).toBe('isLegalSheetOpen')
    expect(dir(sheet, ':title')).toBe('legalSheetDoc?.title')
    expect(sheet.props!.some((p) => p.type === 6 && p.name === 'closable')).toBe(true)
    const md = find(sheet, (n) => n.tag === 'LegalMarkdown')!
    expect(dir(md, ':doc')).toBe('legalSheetDoc')
    expect(cls(find(sheet, (n) => n.tag === 'div')!)).toBe('select-date-page__legal-sheet')
    expect(src).toMatch(/\.select-date-page__legal-sheet \{[^}]*overflow-y: auto;[^}]*\}/)
    // 두 동의 자리(compact · 보통) 모두 시트를 연다
    const labels = findAll(dialog, (n) => n.tag === 'IssueConsentLabel').map((l) => dir(l.node, '@open'))
    expect(labels).toEqual(['openLegalSheet', 'openLegalSheet'])
    expect(src).toMatch(/legalSheet\.value === 'terms' \? TERMS_DOC : legalSheet\.value === 'refund' \? REFUND_DOC : null/)
    expect(src).toMatch(/watch\(isConfirmOrderVisible, \(open\) => \{\s*if \(!open\) legalSheet\.value = null/)
  })

  it('select-date 확인 팝업(템플릿 AST) — 요약 → 고지(D-42) · 스크롤 영역 배선 · 동의 체크는 밖(compact 면 안) · 체크 전 발급 비활성', () => {
    const src = read('./select-date/[orderId].vue')
    const tpl = parse(src).descriptor.template!.ast! as unknown as TNode
    const dialog = find(tpl, (n) => n.tag === 'NAlertDialog' && dir(n, 'v-model') === 'isConfirmOrderVisible')
    expect(dialog).toBeTruthy()
    const scroll = find(dialog!, (n) => cls(n).split(/\s+/).includes('select-date-page__confirm-scroll'))!
    // 높이 맞춤 배선 — ref · :style · @scroll 중 하나만 빠져도 높이 맞춤 · 흐림이 꺼진다
    expect(attr(scroll, 'ref')).toBe('confirmScrollEl')
    expect(dir(scroll, ':style')).toBe('confirmScrollStyle')
    expect(dir(scroll, '@scroll')).toBe('updateConfirmMore')
    // 스크롤 안 — 주문 요약 → 고지(05-A 원문 · 약관 12조③ «미리 표시» — 같은 팝업 안) 순서(D-42)
    const kids = (scroll.children ?? []).filter((c) => c.type === ELEMENT)
    const policyAt = kids.findIndex((c) => cls(c) === 'select-date-page__confirm-policy')
    const summaryAt = kids.findIndex((c) => cls(c) === 'select-date-page__confirm')
    expect(summaryAt).toBe(0) // D-42 — 주문 요약 → 고지(John 2026-10-02)
    expect(policyAt).toBe(1)
    // F-21 · D-43 — 05-A 제목 + 안내 2줄만(지원 기기 · 문제 시 고객센터 — John 2026-10-02) · 굵은 줄 없음
    expect(text(kids[policyAt]!)).toContain('{{ ISSUE_NOTICE.heading }}')
    expect(text(kids[policyAt]!)).toContain('<component :is="renderNoticeList(NOTICE_LINES, [])" />')
    expect(src).toMatch(/const NOTICE_LINES = \[ISSUE_NOTICE\.device, ISSUE_NOTICE\.trouble\]/)
    expect(src.match(/ISSUE_NOTICE\.(?:start|refund|period)\b/g) ?? []).toEqual([])
    // 안내 줄은 글머리 점 · 들여쓰기 없이 제목과 같은 폭으로 한 줄씩(John 2026-10-03)
    expect(src).toMatch(/\.select-date-page__confirm-policy :deep\(\.issue-notice__list\) \{[^}]*padding: 0;[^}]*list-style: none;[^}]*\}/)
    // 동의 체크 — 둘: 보통은 스크롤 밖(늘 보임), 공간이 모자라면 스크롤 안 끝(compact). 동시에 그려지지 않는다
    const boxes = findAll(dialog!, (n) => n.tag === 'NCheckbox' && dir(n, 'v-model') === 'isPolicyAgreed')
    expect(boxes).toHaveLength(2)
    // D-44 — 문구는 slot 의 IssueConsentLabel 하나(두 자리 같은 글자) · label 글자 없음 · 따로 있던 링크 줄 없음
    for (const b of boxes) {
      expect(dir(b.node, ':label')).toBeUndefined()
      expect((b.node.children ?? []).filter((c) => c.type === ELEMENT).map((c) => c.tag)).toEqual(['IssueConsentLabel'])
      const agree = b.ancestors[b.ancestors.length - 1]!
      expect(findAll(agree, (n) => n.tag === 'a')).toEqual([])
    }
    expect(src).not.toMatch(/confirm-links|이용약관 보기|취소·환불 정책 보기/)
    const inside = boxes.find((b) => b.ancestors.includes(scroll))!
    const outside = boxes.find((b) => !b.ancestors.includes(scroll))!
    expect(inside.ancestors.some((a) => dir(a, 'v-if') === 'confirmCompact')).toBe(true)
    expect(outside.ancestors.some((a) => dir(a, 'v-if') === '!confirmCompact')).toBe(true)
    // 체크가 막혀 있으면 발급이 영영 안 된다
    for (const b of boxes) expect(b.node.props?.some((p) => /disabled/.test(p.rawName ?? p.name))).toBe(false)
    // 밖 체크의 자리 — 스크롤 영역(고지 · 요약) 뒤 · 버튼(#actions) 앞: «이용약관과 위 내용을 확인했으며» 가 참이게
    const top = (dialog!.children ?? []).filter((c) => c.type === ELEMENT)
    const wrapAt = top.findIndex((c) => cls(c).includes('select-date-page__confirm-scroll-wrap'))
    const agreeAt = top.findIndex((c) => c === outside.ancestors.find((a) => dir(a, 'v-if') === '!confirmCompact'))
    const actionsAt = top.findIndex((c) => c.tag === 'template' && /#actions/.test(text(c).slice(0, 30)))
    expect(wrapAt >= 0 && wrapAt < agreeAt && agreeAt < actionsAt).toBe(true)
    // compact 안 체크는 스크롤 영역의 마지막(고지 · 요약 뒤)
    expect(kids[kids.length - 1]).toBe(inside.ancestors[inside.ancestors.length - 1])
    // 체크 전에는 발급하기 비활성 · 눌러도 막힘 · 다시 열면 체크를 지운다(D-35 — 약관 동의 자리)
    const issue = find(dialog!, (n) => n.tag === 'NButton' && text(n).includes('eSIM 발급하기'))!
    expect(dir(issue, ':disabled')).toBe('isSubmitting || !isPolicyAgreed')
    expect(src).toMatch(/if \(isSubmitting\.value \|\| !isPolicyAgreed\.value\) return/)
    expect(src).toMatch(/isPolicyAgreed\.value = false\n\s*isConfirmOrderVisible\.value = true/)
    // 높이 = utils/confirm-fit(숫자는 그 테스트가 본다) · layout viewport · 열릴 때 compact 초기화 · resize
    expect(src).toMatch(
      /confirmScrollFit\(\s*document\.documentElement\.clientHeight,\s*dialog\.offsetHeight,\s*el\.offsetHeight,\s*confirmCompact\.value,\s*\)/,
    )
    // compact 로 바뀌면 체크를 옮긴 뒤 다시 잰다(그 블록이 빠지면 낮은 화면에서 버튼이 잘린다)
    expect(src).toMatch(
      /if \(fit\.compact && !confirmCompact\.value\) \{\s*(?:\/\/[^\n]*\n\s*)?confirmCompact\.value = true\s*nextTick\(fitConfirm\)\s*return\s*\}/,
    )
    expect(src).toMatch(/watch\(isConfirmOrderVisible,[\s\S]*?confirmCompact\.value = false[\s\S]*?requestAnimationFrame\(fitConfirm\)/)
    expect(src).toMatch(/window\.addEventListener\('resize', fitConfirm\)/)
  })

  it('체크아웃(F-22) — 동의 블록은 구조 스냅샷 · 상태는 useCheckoutConsent 하나 · 결제는 필수 2개 뒤(구문 트리) · 링크는 새 창', () => {
    const src = read('./checkout-preview.vue')
    const tpl = parse(src).descriptor.template!.ast! as unknown as TNode
    type Any = TNode & { content?: string | { content?: string } }
    // ① 동의 블록(05-B — 약관 · 14세 · 마케팅 · 개인정보 안내 · 결제 전 안내) = 구조 스냅샷. 태그 · 속성 · 지시자 · 보간 · 글자 하나라도
    //    바뀌면 실패한다(손으로 적은 동의 문구 · 숨기는 속성 · 클래스 · 미리 체크 · 항목 바꿔치기 · 주석 속 문구 모두). 법정 블록이라 바꿀 때는
    //    이 스냅샷을 같이 고친다 — 그 diff 가 리뷰 대상이다. 조상(페이지 뿌리)도 고정 — 감싸서 숨기지 못하게
    const ser = (n: Any, d = 0): string[] => {
      const pad = '  '.repeat(d)
      if (n.type === 2) {
        const s = String(n.content).trim()
        return s ? [`${pad}"${s}"`] : []
      }
      if (n.type === 3) return [`${pad}<!--${String(n.content).trim()}-->`]
      if (n.type === 5) return [`${pad}{{ ${String((n.content as { content?: string }).content).trim()} }}`]
      if (n.type !== ELEMENT) return [`${pad}?${n.type}`]
      const props = (n.props ?? []).map((p) =>
        p.type === 6 ? `${p.name}${p.value ? `="${p.value.content}"` : ''}` : `${p.rawName}="${p.exp?.content ?? ''}"`,
      )
      return [`${pad}<${n.tag}${props.length ? ` ${props.join(' ')}` : ''}>`, ...(n.children ?? []).flatMap((c) => ser(c as Any, d + 1))]
    }
    const agrees = findAll(tpl, (n) => cls(n).split(/\s+/).includes('checkout__agree'))
    expect(agrees).toHaveLength(1)
    const { node: agree, ancestors } = agrees[0]!
    expect(ser(agree as Any).join('\n')).toBe(
    [
      "<section class=\"checkout__agree\" aria-label=\"약관 동의 · 개인정보 안내\">",
      "  <div v-for=\"item in consentItems\" :key=\"item.key\" class=\"checkout__consent-item\">",
      "    <div class=\"checkout__consent\">",
      "      <NCheckbox v-model=\"agreed[item.key]\" :label=\"item.label\">",
      "      <a v-for=\"link in item.links\" :key=\"link.href\" :href=\"link.href\" target=\"_blank\" rel=\"noopener\" class=\"checkout__link\">",
      "        {{ link.text }}",
      "        <span class=\"sr-only\">",
      "          \"(새 창)\"",
      "    <p v-if=\"item.info\" class=\"checkout__consent-info\">",
      "      {{ item.info }}",
      "  <div class=\"checkout__notice\">",
      "    <p class=\"checkout__notice-title\">",
      "      {{ PRIVACY_NOTICE.label }}",
      "      <a v-for=\"link in PRIVACY_NOTICE.links\" :key=\"link.href\" :href=\"link.href\" target=\"_blank\" rel=\"noopener\" class=\"checkout__link\">",
      "        {{ link.text }}",
      "        <span class=\"sr-only\">",
      "          \"(새 창)\"",
      "    <p class=\"checkout__consent-info\">",
      "      {{ PRIVACY_NOTICE.info }}",
      "  <div class=\"checkout__notice\">",
      "    <p class=\"checkout__notice-title\">",
      "      {{ BEFORE_NOTICE.title }}",
      "    <component :is=\"renderNoticeList(BEFORE_NOTICE.lines)\">",
    ].join('\n'),
    )
    expect(ancestors.map((a) => ser({ ...a, children: [] } as Any)[0])).toEqual(['<div class="checkout">'])
    expect(findAll(tpl, (n) => n.tag === 'NCheckbox')).toHaveLength(1)
    // ② 결제 — 결제 버튼 속성 고정 · onPay 를 부르는 요소는 모두 같은 :disabled · 템플릿에서 canPay 는 그 :disabled 에만
    const pay = find(tpl, (n) => n.tag === 'NButton' && /결제하기/.test(text(n)))!
    expect(pay.props!.map((p) => (p.type === 6 ? p.name : `${p.rawName}=${p.exp?.content}`))).toEqual([
      'variant',
      'size',
      'full-width',
      ':disabled=!isConfigured || !canPay',
      ':loading=isRequesting',
      '@click=onPay',
    ])
    const exprs: { node: TNode; raw: string; exp: string }[] = []
    const walkTpl = (n: Any): void => {
      for (const p of n.props ?? []) if (p.exp) exprs.push({ node: n, raw: p.rawName ?? p.name, exp: p.exp.content })
      if (n.type === 5) exprs.push({ node: n, raw: '{{}}', exp: String((n.content as { content?: string }).content) })
      for (const c of n.children ?? []) walkTpl(c as Any)
    }
    walkTpl(tpl as Any)
    // 템플릿 이름 수 — 동의 상태 · 블록 이름은 블록 안 자리에만(블록 밖 식 · 이벤트로 체크 값을 쓰거나 문구를 바꾸는 길). canPay 는 ③ 뒤에서
    const tcount = (name: string) => exprs.filter((x) => new RegExp(`\\b${name}\\b`).test(x.exp)).length
    expect(['agreed', 'consentItems', 'PRIVACY_NOTICE', 'BEFORE_NOTICE', 'renderNoticeList', 'CONSENT_ITEMS', 'CHECKOUT_NOTICE'].map(tcount)).toEqual([
      1, 1, 3, 2, 1, 0, 0,
    ])
    // 템플릿 어디서도 DOM 을 직접 만지거나 수명 주기 이벤트 · 정적 on* 핸들러 · v-html · 다른 :is 를 쓰지 않는다(미리 체크 · 주입)
    const DOM = /\b(?:document|window|querySelector(?:All)?|getElement\w*|dispatchEvent|parent(?:Element|Node)|children|childNodes|\w+ElementSibling|closest|Object|Reflect|insertAdjacent\w*)\b|(?<![\w$])\$(?:el|refs|parent|root|attrs)\b|\.click\s*\(/
    for (const e of exprs) expect(e.exp, e.raw).not.toMatch(DOM)
    for (const e of exprs) expect(/^(?:@|v-on:)vue?:|^(?:@|v-on:)vnode/i.test(e.raw), e.raw).toBe(false)
    const allEls = findAll(tpl, () => true).map((x) => x.node)
    for (const n of allEls)
      for (const p of n.props ?? []) {
        if (p.type === 6) expect(/^on/i.test(p.name), `정적 핸들러 ${p.name}`).toBe(false)
        if (p.type === 7) expect(p.name === 'html', `v-html · ${text(n).slice(0, 40)}`).toBe(false)
        if (p.type === 6 && p.name === 'is') expect(true, '정적 is').toBe(false)
        if (p.type === 7 && p.arg?.content === 'is') expect(p.exp?.content, ':is').toBe('renderNoticeList(BEFORE_NOTICE.lines)')
      }
    // 동의 블록 밖 — 동의 · 고지 문구(손으로 쓴 것 · 다른 생성물)와 체크박스를 두지 않는다(05-B 생성물은 블록 안에서만)
    const inAgree = new Set<TNode>()
    const markAgree = (n: TNode): void => {
      inAgree.add(n)
      for (const c of n.children ?? []) markAgree(c)
    }
    markAgree(agree)
    const LEGALISH = /동의|약관|개인정보|환불|청약|철회/
    const outsideText: string[] = []
    const walkOut = (n: Any): void => {
      if (n.type === ELEMENT && inAgree.has(n)) return
      if (n.type === 2) outsideText.push(String(n.content))
      for (const p of n.props ?? []) if (p.type === 6 && p.value) outsideText.push(p.value.content)
      for (const c of n.children ?? []) walkOut(c as Any)
    }
    walkOut(tpl as Any)
    expect(outsideText.filter((s) => LEGALISH.test(s))).toEqual([])
    expect(exprs.filter((x) => !inAgree.has(x.node) && /\b[A-Z][A-Z_]*(?:NOTICE|CONSENT|LEGAL|TERMS|PRIVACY|REFUND)\b/.test(x.exp)).map((x) => x.exp)).toEqual([])
    // 블록 밖 보간은 정해진 것만(상수 · 하위 컴포넌트로 동의 · 고지 문구를 들이는 길) · 문자열 바인딩에 법정 낱말 0 · 컴포넌트는 DS 두 개와 블록의 component 만
    expect([...new Set(exprs.filter((x) => !inAgree.has(x.node) && x.raw === '{{}}').map((x) => x.exp.trim()))].sort()).toEqual(
      ['PREVIEW_ITEM.productName', 'PREVIEW_ITEM.optionName', 'PREVIEW_ITEM.quantity', 'PREVIEW_ITEM.usage', 'formatWon(PREVIEW_ITEM.amount)', 'result.paymentId', 'result.message', 'openError'].sort(),
    )
    expect(exprs.filter((x) => /['"`]/.test(x.exp) && LEGALISH.test(x.exp)).map((x) => x.exp)).toEqual([])
    expect([...new Set(allEls.map((n) => n.tag ?? '').filter((tag) => /[A-Z]|-/.test(tag)))].sort()).toEqual(['NButton', 'NCheckbox'])
    expect(allEls.filter((n) => /^input$/i.test(n.tag ?? '') || (n.props ?? []).some((p) => p.type === 6 && p.name === 'role' && /checkbox|switch/i.test(p.value?.content ?? '')))).toHaveLength(0)
    // ③ 스크립트 — TypeScript 구문 트리. 상태는 useCheckoutConsent(~/utils/checkout-preview) 하나 · 세 이름은 그 구조 분해에서만 ·
    //    canPay 는 결제 함수 첫 문장 가드에서만 읽는다 · 결제 호출은 onPay 안 한 곳 · DOM 직접 조작 0
    const script = src.slice(src.indexOf('<script setup lang="ts">') + '<script setup lang="ts">'.length, src.indexOf('</script>'))
    const sf = ts.createSourceFile('checkout-preview.ts', script, ts.ScriptTarget.Latest, true)
    const idents: ts.Identifier[] = []
    const declared: string[] = []
    const aliased: string[] = []
    const visit = (n: ts.Node): void => {
      if (ts.isIdentifier(n)) idents.push(n)
      if (ts.isImportSpecifier(n) && n.propertyName) aliased.push(n.propertyName.getText(sf))
      if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name)) declared.push(n.name.text)
      if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) declared.push(n.name.text)
      ts.forEachChild(n, visit)
    }
    visit(sf)
    const named = (name: string) => idents.filter((i) => i.text === name)
    expect(aliased).toEqual([])
    const importOf = (name: string) =>
      sf.statements
        .filter(ts.isImportDeclaration)
        .filter((d) => d.importClause?.namedBindings && ts.isNamedImports(d.importClause.namedBindings) && d.importClause.namedBindings.elements.some((e) => e.name.text === name))
        .map((d) => (d.moduleSpecifier as ts.StringLiteral).text)
    // 블록 · 결제 버튼이 쓰는 이름은 정해진 모듈에서만 · 페이지 안에서 다시 정의하지 않는다(문구 · 체크박스 바꿔치기)
    expect(
      Object.fromEntries(
        ['useCheckoutConsent', 'PRIVACY_NOTICE', 'BEFORE_NOTICE', 'renderNoticeList', 'NCheckbox', 'NButton'].map((n) => [n, importOf(n)]),
      ),
    ).toEqual({
      useCheckoutConsent: ['~/utils/checkout-preview'],
      PRIVACY_NOTICE: ['~/utils/checkout-preview'],
      BEFORE_NOTICE: ['~/utils/checkout-preview'],
      renderNoticeList: ['~/utils/legal-render'],
      NCheckbox: ['@imjohnkoo/design-vue'],
      NButton: ['@imjohnkoo/design-vue'],
    })
    const decls = sf.statements.filter(ts.isVariableStatement).flatMap((s) => [...s.declarationList.declarations])
    const consentDecl = decls.filter((d) => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(sf) === 'useCheckoutConsent')
    expect(consentDecl).toHaveLength(1)
    expect(consentDecl[0]!.name.getText(sf)).toBe('{ items: consentItems, agreed, canPay }')
    expect(consentDecl[0]!.initializer!.getText(sf)).toBe('useCheckoutConsent()')
    expect(
      ['agreed', 'canPay', 'consentItems', 'useCheckoutConsent', 'PRIVACY_NOTICE', 'BEFORE_NOTICE', 'renderNoticeList', 'NCheckbox', 'NButton'].map(
        (n) => declared.filter((d) => d === n).length,
      ),
    ).toEqual([1, 1, 1, 0, 0, 0, 0, 0, 0])
    expect([named('useCheckoutConsent').length, named('agreed').length, named('consentItems').length]).toEqual([2, 1, 1])
    // 블록 · 버튼 이름은 스크립트에서 import 한 번뿐(템플릿에서만 쓴다) — 스크립트에서 고치거나 감싸는 길(얼린 객체 변경 시도 포함) 0
    expect(['PRIVACY_NOTICE', 'BEFORE_NOTICE', 'renderNoticeList', 'NCheckbox', 'NButton'].map((n) => named(n).length)).toEqual([1, 1, 1, 1, 1])
    // canPay 참조 = 구조 분해 하나 + 함수 첫 문장의 «if (… !canPay.value …) return» 안
    const firstGuard = (id: ts.Node) => {
      let n: ts.Node = id
      while (n.parent && !ts.isIfStatement(n)) n = n.parent
      if (!ts.isIfStatement(n) || !ts.isReturnStatement(n.thenStatement)) return false
      const block = n.parent
      return ts.isBlock(block) && block.statements[0] === n && (ts.isArrowFunction(block.parent) || ts.isFunctionLike(block.parent)) && /!canPay\.value\b/.test(n.expression.getText(sf))
    }
    const canPayUses = named('canPay').filter((i) => !ts.isBindingElement(i.parent))
    expect(canPayUses.length).toBeGreaterThanOrEqual(1)
    for (const use of canPayUses) expect(firstGuard(use), use.parent.getText(sf).slice(0, 60)).toBe(true)
    const onPay = decls.find((d) => d.name.getText(sf) === 'onPay')!
    const payBody = (onPay.initializer as ts.ArrowFunction).body as ts.Block
    expect(payBody.statements[0]!.getText(sf)).toBe('if (!isConfigured || !canPay.value || isRequesting.value) return')
    const requests = named('requestPayment')
    expect(requests).toHaveLength(1)
    let owner: ts.Node = requests[0]!
    // 그 호출을 감싼 «함수 값» 선언까지(const response = await … 같은 안쪽 선언은 지나친다)
    while (owner.parent && !(ts.isVariableDeclaration(owner) && owner.initializer && (ts.isArrowFunction(owner.initializer) || ts.isFunctionExpression(owner.initializer))))
      owner = owner.parent
    expect(ts.isVariableDeclaration(owner) && owner.name.getText(sf)).toBe('onPay')
    // canPay 를 템플릿에서 쓰는 곳 = «첫 문장이 canPay 가드인 핸들러» 를 부르는 요소의 :disabled 뿐 · onPay 를 부르는 요소는 모두 그 :disabled 를 갖는다
    const guarded = new Set(
      decls
        .filter((d) => d.initializer && ts.isArrowFunction(d.initializer) && ts.isBlock(d.initializer.body))
        .filter((d) => {
          const first = ((d.initializer as ts.ArrowFunction).body as ts.Block).statements[0]
          return !!first && ts.isIfStatement(first) && ts.isReturnStatement(first.thenStatement) && /!canPay\.value\b/.test(first.expression.getText(sf))
        })
        .map((d) => d.name.getText(sf)),
    )
    expect(guarded.has('onPay')).toBe(true)
    // 가드한 핸들러를 부르는 다른 함수도 첫 문장 가드가 있어야 한다(가드 밖 함수가 결제 함수를 감싸 버튼을 동의 전에 켜는 길)
    const fnDecls = decls.filter((d) => d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)))
    for (const d of fnDecls) {
      const body = d.initializer!.getText(sf)
      const calls = [...guarded].filter((g) => g !== d.name.getText(sf) && new RegExp(`\\b${g}\\b`).test(body))
      if (calls.length) expect(guarded.has(d.name.getText(sf)), `${d.name.getText(sf)} 가 ${calls} 를 부르는데 가드가 없다`).toBe(true)
    }
    // 결제를 일으키는 템플릿 식 = 가드한 핸들러 이름 하나(@click="onPay" 그대로 — 호출 · 수식어 · 다른 이벤트 · 화살표 · 자식 이벤트 금지) ·
    // 그 요소의 :disabled 는 정확히 «!isConfigured || !canPay» · canPay 는 그 :disabled 에만
    for (const e of exprs) {
      const hit = [...guarded].filter((g) => new RegExp(`\\b${g}\\b`).test(e.exp))
      if (hit.length) {
        expect([e.raw, e.exp], `결제 핸들러를 부르는 식`).toEqual(['@click', hit[0]])
        expect(dir(e.node, ':disabled'), `${hit[0]} 버튼`).toBe('!isConfigured || !canPay')
      }
    }
    for (const e of exprs.filter((x) => /\bcanPay\b/.test(x.exp))) {
      expect([e.raw, e.exp]).toEqual([':disabled', '!isConfigured || !canPay'])
      expect(guarded.has(dir(e.node, '@click') ?? ''), `${dir(e.node, '@click')} 는 첫 문장에 canPay 가드가 없다`).toBe(true)
    }
    // 결제 SDK(PortOne — npm · CDN · window.PortOne 어떤 꼴이든)는 client 앱 브라우저 코드 전체에서 이 페이지 한 곳만
    // (도우미 · 컴포저블 · .js · lib/ 로 빼 가드 밖에서 부르는 길). server/ 는 결제 검증용 server-sdk 자리라 제외 · 테스트 · 설정 키(nuxt.config)는 제외
    const CLIENT = fileURLToPath(new URL('../..', import.meta.url))
    // 주석은 걷고 본다(설명 글의 «PortOne» 은 결제 경로가 아니다 — 주석 표식 뒤의 URL 글자 · 문자열 속 «//» 는 남는다)
    const codeOnly = (s: string) =>
      s
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/^\s*\/\/.*$/gm, '')
        .replace(/(?<=[;,{}()\s])\/\/(?!\S*\.(?:io|com|net)).*$/gm, '')
    const scan = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        if (/^(?:node_modules|\.nuxt|\.output|\.git|server|dist|coverage)$/.test(n)) return []
        const f = join(d, n)
        return statSync(f).isDirectory() ? scan(f) : /\.(?:[cm]?[jt]sx?|vue)$/.test(n) && !/\.test\.[jt]s$/.test(n) ? [f] : []
      })
    const sdkFiles = scan(CLIENT)
      .filter((f) => /portone/i.test(codeOnly(readFileSync(f, 'utf8'))))
      .map((f) => f.slice(CLIENT.length).replace(/^\//, ''))
    expect(sdkFiles.sort()).toEqual(['app/pages/checkout-preview.vue', 'nuxt.config.ts'])
    expect(codeOnly(readFileSync(join(CLIENT, 'nuxt.config.ts'), 'utf8')).match(/portone/gi)).toEqual(['portone']) // runtimeConfig 키 하나
    // 페이지는 법정 생성물을 직접 가져오지 않는다(05-B 는 utils 의 모델로만) · useHead 로 script · style 을 넣지 않는다
    expect(sf.statements.filter(ts.isImportDeclaration).map((d) => (d.moduleSpecifier as ts.StringLiteral).text).filter((m) => /content\/legal|\/components\//.test(m))).toEqual([])
    const headKeys: string[] = []
    const visit3 = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && /^use(?:Head|SeoMeta|ServerHead)$/.test(n.expression.getText(sf)))
        for (const a of n.arguments) if (ts.isObjectLiteralExpression(a)) for (const pr of a.properties) headKeys.push(pr.name?.getText(sf) ?? '?')
      ts.forEachChild(n, visit3)
    }
    visit3(sf)
    expect(headKeys.filter((k) => /^(?:script|style|link|noscript|\?)$/.test(k))).toEqual([])
    // Object 는 읽기 도우미만(entries · keys · values · fromEntries · freeze) — assign · defineProperty 로 체크 값을 쓰는 길
    for (const o of named('Object'))
      expect(ts.isPropertyAccessExpression(o.parent) && /^(?:entries|keys|values|fromEntries|freeze)$/.test(o.parent.name.text), o.parent.getText(sf)).toBe(true)
    // 결제 SDK 는 onPay 안의 동적 import 한 곳에서만 · PortOne 은 onPay 안에서만 · 글자 키 접근 금지 — «어떤 결제 경로든» 필수 동의 뒤
    const ownerFn = (n: ts.Node) => {
      let o: ts.Node = n
      while (o.parent && !(ts.isVariableDeclaration(o) && o.initializer && (ts.isArrowFunction(o.initializer) || ts.isFunctionExpression(o.initializer))))
        o = o.parent
      return ts.isVariableDeclaration(o) ? o.name.getText(sf) : null
    }
    const sdkImports: ts.Node[] = []
    const elementAccess: string[] = []
    const visit2 = (n: ts.Node): void => {
      if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) sdkImports.push(n)
      if (ts.isElementAccessExpression(n)) elementAccess.push(n.getText(sf))
      ts.forEachChild(n, visit2)
    }
    visit2(sf)
    expect(sdkImports.map((n) => [n.getText(sf), ownerFn(n)])).toEqual([["import('@portone/browser-sdk/v2')", 'onPay']])
    expect(sf.statements.filter(ts.isImportDeclaration).map((d) => (d.moduleSpecifier as ts.StringLiteral).text).filter((m) => /portone/i.test(m))).toEqual([])
    expect(named('PortOne').map(ownerFn).every((o) => o === 'onPay')).toBe(true)
    expect(elementAccess.filter((e) => /^PortOne\b/.test(e))).toEqual([])
    expect(
      [
        'initialConsent', 'canPayWith', 'CONSENT_ITEMS', 'CHECKOUT_NOTICE', 'reactive', 'eval', 'Function', 'Reflect', 'document', 'querySelector',
        'querySelectorAll', 'dispatchEvent', 'getElementById', 'getElementsByClassName', 'getElementsByTagName', 'parentElement', 'parentNode', 'children',
        'childNodes', 'nextElementSibling', 'previousElementSibling', 'nextSibling', 'previousSibling', 'firstChild', 'lastChild', 'firstElementChild',
        'lastElementChild', 'closest', 'click', 'style', 'innerHTML', 'outerHTML', 'insertAdjacentHTML', 'getCurrentInstance', 'proxy',
      ].filter((n) => named(n).length),
    ).toEqual([])
    // ④ 스코프 CSS — 동의 블록 · 페이지 뿌리에 닿을 수 있는 규칙(동의 클래스 · .checkout 뿌리 · 형제 결합자 · :deep/:global/:has 등)에만
    //    숨기는 속성 금지. 동의 밖 checkout__* 와 그 자손 규칙(결제 바 · 카드 등)은 자유. 전역 CSS 등 정적 검사 밖은 spec D-38(사람 판정)
    const style = src
      .slice(src.indexOf('>', src.indexOf('<style')) + 1, src.lastIndexOf('</style>'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(style).toContain('.checkout {')
    const CONSENT = /checkout__(?:agree|consent|notice|link)|\.checkout(?![\w-])/
    const SAFE = (sel: string) => /^\s*\.checkout__[\w-]+/.test(sel) && !CONSENT.test(sel) && !/[~+]|:(?:deep|global|slotted|has|is|where)\b|::v-deep/.test(sel)
    // 동의 · 뿌리 규칙 = 엄격(투명 · 필터 · 변형 · 위치 · 넘침 · 아주 작은 크기 모두). 단 상태 선택자(:hover · :focus …)만의 규칙은 완화 —
    // 불투명도 0.5 이상 · 작은 변형(링크 hover)은 허용
    const STRICT =
      /(?:^|[\s;{])(?:opacity\s*:|(?:backdrop-)?filter\s*:|transform\s*:|animation(?:-name)?\s*:|(?:max-)?(?:height|width|block-size|inline-size)\s*:\s*(?:0|\d(?:\.\d+)?px|0?\.\d+(?:px|r?em))(?![.\d])|font-size\s*:\s*0?\.[0-4]\d*r?em)/i
    const STATE = (sel: string) => /:(?:hover|focus|focus-visible|focus-within|active)\b/.test(sel)
    const HIDE =
      /(?:^|[\s;{])(?:display\s*:\s*(?:none|var\()|visibility\s*:\s*(?:hidden|collapse|var\()|content-visibility\s*:|contain\s*:\s*(?:strict|size)|opacity\s*:\s*(?:0(?![.\d])|0?\.[0-4]|[0-4]?\d(?:\.\d+)?%)|filter\s*:[^;]*opacity\(\s*0|(?:-webkit-)?mask(?:-image)?\s*:|scale\s*:\s*(?:0(?![.\d])|0?\.[0-4])|zoom\s*:\s*(?:0(?![.\d])|0?\.[0-4]|[0-4]?\d%)|rotate\s*:[^;]*9\d\s*deg|translate\s*:[^;]*(?:-\d{3,}|-?\d+(?:\.\d+)?(?:vw|vh))|transform\s*:[^;]*(?:scale[XY]?\(\s*(?:0(?![.\d])|0?\.[0-4])|translate[XYZ]?\([^)]*(?:-\d{3,}|-?\d+(?:\.\d+)?(?:vw|vh))|rotate[XY]\(\s*9\d)|inset\s*:|position\s*:\s*(?:absolute|fixed)|overflow(?:-y)?\s*:\s*(?:hidden|clip)|clip(?:-path)?\s*:|text-indent\s*:|(?:-webkit-text-fill-)?color\s*:\s*(?:transparent|rgba?\([^)]*(?:,|\/)\s*0(?:\.0+)?%?\s*\)|hsla?\([^)]*(?:,|\/)\s*0(?:\.0+)?%?\s*\)|#[0-9a-f]{3}0\b|#[0-9a-f]{6}00\b)|font\s*:\s*0|font-size\s*:\s*(?:0(?![.\d])|(?:[0-7](?:\.\d+)?|\.\d+)px|0?\.[0-2]\d*r?em|[0-4]?\d(?:\.\d+)?%)|(?:max-)?(?:height|width)\s*:\s*(?:0|1px|0?\.\d+(?:px|r?em))(?![.\d])|line-height\s*:\s*0(?![.\d])|(?:left|right|top|bottom|margin(?:-[a-z]+)?)\s*:\s*[^;]*-(?:\d{3,}(?:\.\d+)?px|\d{2,}(?:\.\d+)?r?em|\d+(?:\.\d+)?(?:vw|vh|%))|v-bind\()/i
    for (const rule of style.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      // @ 규칙 머리 · 키프레임 단계(from · to · 50%)는 규칙이 아니다 — 동의 규칙은 animation 을 쓰지 못한다(STRICT)
      if (/^\s*@/.test(rule[1]!) || /^\s*(?:from|to|\d+(?:\.\d+)?%)(?:\s*,\s*(?:from|to|\d+(?:\.\d+)?%))*\s*$/.test(rule[1]!) || rule[1]!.split(',').every(SAFE)) continue
      expect(rule[2], rule[1]!.trim()).not.toMatch(HIDE)
      if (!rule[1]!.split(',').every(STATE)) expect(rule[2], `엄격 · ${rule[1]!.trim()}`).not.toMatch(STRICT)
    }
    // ⑤ 이 페이지 템플릿의 링크는 모두 새 창 — 다녀와도 체크가 풀리지 않게(지원 기기 확인 포함 · 레이아웃 푸터는 이 파일 밖)
    const links = findAll(tpl, (n) => /^(?:a|nuxtlink|nuxt-link|routerlink|router-link)$/i.test(n.tag ?? ''))
    expect(exprs.filter((x) => /\bnavigateTo\b/.test(x.exp))).toEqual([])
    expect(links.length).toBeGreaterThanOrEqual(3)
    for (const a of links) {
      expect(a.node.tag).toBe('a')
      expect(attr(a.node, 'target')).toBe('_blank')
      expect(attr(a.node, 'rel')).toBe('noopener')
      expect(text(a.node)).toContain('(새 창)')
    }
  })

  it('«발급 후 취소 · 환불 불가» 문장이 앱 어디에도 없다 — 같은 자리는 05-A 14행(D-32)', () => {
    // 제외는 취소·환불 정책 생성물 하나 — 정본 03 의 «설치 후 단순 변심 환불 불가»(설치 뒤 이야기 · 4곳)라서.
    // 발급 팝업(05-A) · 체크아웃(05-B) 등 다른 생성물은 그대로 본다(정본 rev 로 이 문장이 들어오면 막힌다)
    const REFUND = '/content/legal/refund.ts'
    expect(code(APP).some((f) => f.endsWith(REFUND))).toBe(true)
    for (const f of code(APP).filter((f) => !f.endsWith(REFUND)))
      expect(readFileSync(f, 'utf8'), f).not.toMatch(
        /(?:취소|환불)[와과·/\s]*(?:환불)?\s*(?:이|가|은|을)?\s*(?:불가|X\b)|환불(?:이|은)?\s*안\s*(?:돼|됩)|(?:환불|취소)(?:을|를)?\s*(?:받을|할|해\s*드릴)\s*수\s*없|환불받을\s*수\s*없|환불되지\s*않아요|환불이\s*어려|취소할\s*수\s*없/,
      )
    expect(read('./supported-devices.vue')).toContain('${ISSUE_NOTICE.refund}')
    expect(read('../components/popup/ConfirmOrderModal.vue')).toContain(
      '*{{ ISSUE_NOTICE.refund }}',
    )
  })

  it('푸터(F-7) — 04 1절 줄(생성물) · 링크 줄(방침 굵게 · 색) · © 줄(생성물) · 모든 레이아웃', () => {
    const footer = read('../components/shell/SiteFooter.vue')
    expect(footer).toContain("import { BUSINESS_INFO } from '~/content/legal/business'")
    expect(footer).toMatch(/\nconst \{ lines, copyright \} = footerParts\(BUSINESS_INFO\)\n/)
    expect(template(footer)).toContain('<component :is="renderBusinessLines(lines)" />')
    expect(template(footer)).toContain('{{ copyright }}')
    expect(template(footer)).toContain("'site-footer__link--privacy': link.to === '/privacy'")
    expect(footer).toMatch(/\.site-footer__link--privacy \{[^}]*color: var\(--n-color-primary-600[^}]*font-weight: 800/)
  })

  it('/refund — 생성물을 그린다 · /business 는 없다(D-39) — 페이지 · 생성물 · 앱 코드(app · server · shared · nuxt.config — 프리렌더 · sitemap · routeRules 포함)의 경로 글자 0', () => {
    expect(template(read('./refund.vue'))).toContain('<LegalMarkdown :doc="REFUND_DOC" />')
    const files = walk(APP)
    expect(files.filter((f) => /[/\\]pages[/\\]business(?:\.vue|[/\\])/.test(f))).toEqual([])
    expect(files.filter((f) => /[/\\]content[/\\]legal[/\\]business-page\.ts$/.test(f))).toEqual([])
    for (const f of [...code(APP), ...code(SERVER), ...code(SHARED), NUXT_CONFIG])
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/(?:['"`(]|esimmany\.com)\/business\b/)
  })

  it('/my 고객센터 — 새 창으로 여는 링크(http)에는 낭독기 «(새 창)» 이 같은 조건으로 붙는다', () => {
    const tpl = parse(read('./my.vue')).descriptor.template!.ast! as unknown as TNode
    const a = find(tpl, (n) => n.tag === 'a' && dir(n, 'v-if') === 'channel.href')!
    expect(dir(a, ':target')).toBe("channel.href.startsWith('http') ? '_blank' : undefined")
    const sr = find(a, (n) => cls(n) === 'sr-only')!
    expect(dir(sr, 'v-if')).toBe("channel.href.startsWith('http')")
    expect(text(sr)).toContain('(새 창)')
  })

  it('D-36 임시 블록(`/` 하단)은 W1-2 홈에서 걷었다 — 사업자정보는 모든 화면 푸터(F-7)가 맡는다', () => {
    expect(read('./index.vue')).not.toContain('IssuerBusinessInfo')
    for (const layout of ['../layouts/default.vue', '../layouts/flow.vue'])
      expect(template(read(layout))).toContain('<SiteFooter')
  })

  it('두 페이지가 있다 — /terms · /privacy 는 각자의 생성물을 그린다 · <html lang="ko">', () => {
    for (const [page, name, mod] of [
      ['./terms.vue', 'TERMS_DOC', 'terms'],
      ['./privacy.vue', 'PRIVACY_DOC', 'privacy'],
    ] as const) {
      const src = read(page)
      expect(src).toContain(`import { ${name} } from '~/content/legal/${mod}'`)
      expect(template(src)).toContain(`<LegalMarkdown :doc="${name}" />`)
      expect(src).toContain("htmlAttrs: { lang: 'ko' }")
    }
    expect(template(read('../components/legal/LegalMarkdown.vue'))).toContain(
      '<component :is="renderDoc(doc)" />',
    )
  })

  it('번호 항 · 글머리표가 보인다 — 전역 리셋(list-style: none)을 법정 문서가 되돌린다', () => {
    const vue = read('../components/legal/LegalMarkdown.vue')
    expect(vue).toMatch(/\.legal-md \.legal-md__ol \{\s*list-style: decimal outside;/)
    expect(vue).toMatch(/\.legal-md \.legal-md__ul \{\s*list-style: disc outside;/)
  })
})

// ⛔ spec D-31 — W1-2 의 흐름 쿠키(F-15 `nomacom_flow`)가 들어와 방침 9장① 이 거짓이 됐다 → W1-2 main 머지 게이트.
// it.fails 는 «지금 실패하는 것이 정상». legal-pages 방침 rev(쿠키 한 줄 · «회사 서버에 저장하지 않음»)를 들여올 때
// 이 블록을 «방침 9장 문장 = 흐름 쿠키 실제(이름 · 보관 시간)» 대조 테스트로 바꾼다.
describe('방침 9장① «발급 화면은 쿠키를 사용하지 않습니다» 가 참이다(D-31 — W1-2 머지 게이트)', () => {
  // W1-2 의 흐름 쿠키가 들어오면 이 테스트가 실패한다 — 방침 rev(legal-pages)를 같이 들여오고 이 테스트를 고친다.
  // 읽기(server 의 getCookie — 아무도 만들지 않는 세션 쿠키 자리)는 «사용» 이 아니다 — 쿠키를 만드는 길만 본다
  it.fails('앱 · 서버 코드에 쿠키를 만드는 길이 없다(useCookie · document.cookie · setCookie · Set-Cookie)', () => {
    for (const f of [...code(APP), ...code(SERVER)])
      expect(readFileSync(f, 'utf8'), f).not.toMatch(
        /useCookie|document\.cookie|setCookie\(|set-cookie/i,
      )
  })
})
