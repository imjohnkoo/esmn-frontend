import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
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
  props?: { type: number; name: string; rawName?: string; value?: { content: string }; exp?: { content: string } }[]
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
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const code = (dir: string) =>
  walk(dir).filter((f) => /\.(vue|ts)$/.test(f) && !/\.test\.ts$/.test(f))

describe('발급기 법정 링크(F-20)', () => {
  it('verify — 개인정보처리방침(굵게 · 색 구분 클래스) · 이용약관 → 하단 시트(D-46 — 새 탭 아님 · href 유지)', () => {
    const src = read('./verify/[orderId].vue')
    const tpl = parse(src).descriptor.template!.ast! as unknown as TNode
    const links = findAll(tpl, (n) => n.tag === 'a' && /^\/(privacy|terms)$/.test(attr(n, 'href') ?? '')).map((l) => l.node)
    expect(links.map((l) => [cls(l), attr(l, 'href'), attr(l, 'target'), attr(l, 'aria-haspopup'), dir(l, '@click.prevent')])).toEqual([
      ['verify-page__policy-link verify-page__policy-link--privacy', '/privacy', undefined, 'dialog', "legalSheet = 'privacy'"],
      ['verify-page__policy-link', '/terms', undefined, 'dialog', "legalSheet = 'terms'"],
    ])
    expect(text(links[0]!)).toContain('>개인정보처리방침</a')
    expect(text(links[1]!)).toContain('>이용약관</a')
    // 시트 하나 · v-model = 링크가 고르는 키 · ref 는 공용 키 타입
    const sheets = findAll(tpl, (n) => n.tag === 'DocSheet')
    expect(sheets.map((x) => dir(x.node, 'v-model'))).toEqual(['legalSheet'])
    expect(src).toMatch(/const legalSheet = ref<DocSheetKey \| null>\(null\)/)
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

  it('발급 필수 동의 문구(D-44 · D-51) — 글자 그대로 · «이용약관» · «취소·환불 정책» 링크는 하단 시트를 연다(D-45 — 새 탭 아님 · href 는 남김)', () => {
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
    expect(shown).toBe('(필수) 이용약관과 취소·환불 정책을 확인했으며 QR 발급 후 환불 시 환불 비용이 발생하는 것에 동의합니다.')
  })

  it('약관 · 환불 정책 · 지원 기기 하단 시트(D-45 · D-48) — 확인 팝업 안 공용 DocSheet · 두 동의 자리 모두 시트를 연다 · 안내 줄 «지원 기기 확인» 도 · 팝업을 닫으면 시트도', () => {
    const src = read('./select-date/[orderId].vue')
    const tpl = parse(src).descriptor.template!.ast! as unknown as TNode
    const dialog = find(tpl, (n) => n.tag === 'NAlertDialog' && dir(n, 'v-model') === 'isConfirmOrderVisible')!
    expect(findAll(dialog, (n) => n.tag === 'DocSheet').map((x) => dir(x.node, 'v-model'))).toEqual(['legalSheet'])
    expect(findAll(tpl, (n) => n.tag === 'DocSheet')).toHaveLength(1) // 팝업 밖에는 없다(중첩 레이어)
    // 안내 줄의 «지원 기기 확인» 만 시트로(D-48) — 그 밖 주소는 렌더러 기본
    expect(src).toMatch(/const noticeSheet = \(href: string\) => \(href === '\/supported-devices' \? \(\) => openLegalSheet\('devices'\) : undefined\)/)
    const labels = findAll(dialog, (n) => n.tag === 'IssueConsentLabel').map((l) => dir(l.node, '@open'))
    expect(labels).toEqual(['openLegalSheet', 'openLegalSheet'])
    expect(src).toMatch(/watch\(isConfirmOrderVisible, \(open\) => \{\s*if \(!open\) legalSheet\.value = null/)
  })

  it('공용 DocSheet(D-45 · D-46 · D-48) — 법정 3종 = 생성물 · 지원 기기 = 페이지와 같은 컴포넌트 · X(closable) · 제목 · 본문만 스크롤 · 본문 h1 숨김', () => {
    const src = read('../components/legal/DocSheet.vue')
    const tpl = parse(src).descriptor.template!.ast! as unknown as TNode
    const sheet = find(tpl, (n) => n.tag === 'NBottomSheet')!
    expect(dir(sheet, 'v-model')).toBe('isOpen')
    expect(dir(sheet, ':title')).toBe('title')
    expect(src).toMatch(/const title = computed\(\(\) => doc\.value\?\.title \?\? DEVICES_TITLE\)/)
    expect(src).toMatch(/const DEVICES_TITLE = 'eSIM 지원 기기'/)
    const devices = find(sheet, (n) => n.tag === 'SupportedDevicesContent')!
    expect(devices.props!.some((p) => p.type === 7 && p.rawName === 'v-else')).toBe(true)
    expect(sheet.props!.some((p) => p.type === 6 && p.name === 'closable')).toBe(true)
    const md = find(sheet, (n) => n.tag === 'LegalMarkdown')!
    expect([dir(md, ':doc'), dir(md, 'v-if')]).toEqual(['doc', 'doc'])
    expect(src).toMatch(/const DOCS = \{ terms: TERMS_DOC, privacy: PRIVACY_DOC, refund: REFUND_DOC \} as const/)
    expect(src).toMatch(/import \{ TERMS_DOC \} from '~\/content\/legal\/terms'/)
    expect(src).toMatch(/import \{ PRIVACY_DOC \} from '~\/content\/legal\/privacy'/)
    expect(src).toMatch(/import \{ REFUND_DOC \} from '~\/content\/legal\/refund'/)
    expect(src).toMatch(/\.legal-sheet \{[^}]*overflow-y: auto;[^}]*\}/)
    expect(src).toMatch(/\.legal-sheet :deep\(\.legal-md__title\) \{[^}]*display: none;/)
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
    // F-21 · D-43 · D-49 — 05-A 제목 + 안내 «지원 기기 확인» 1줄만(John 2026-10-03) · 굵은 줄 없음
    expect(text(kids[policyAt]!)).toContain('{{ ISSUE_NOTICE.heading }}')
    expect(text(kids[policyAt]!)).toContain('<component :is="renderNoticeList(NOTICE_LINES, [], { sheet: noticeSheet })" />')
    expect(src).toMatch(/const NOTICE_LINES = \[ISSUE_NOTICE\.device\]/)
    expect(src.match(/ISSUE_NOTICE\.(?:start|refund|period|trouble)\b/g) ?? []).toEqual([])
    // 안내 줄은 글머리 점 · 들여쓰기 없이 제목과 같은 폭으로 한 줄씩(John 2026-10-03)
    expect(src).toMatch(/\.select-date-page__confirm-policy :deep\(\.issue-notice__list\) \{[^}]*padding: 0;[^}]*list-style: none;[^}]*\}/)
    // 안내 줄 링크(«지원 기기 확인»)는 링크로 보인다 — 렌더러가 그린 a 라 :deep 규칙(색 · 밑줄)
    expect(src).toMatch(/\.select-date-page__confirm-policy :deep\(\.legal-md__link\) \{[^}]*color: #6239ff;[^}]*text-decoration: underline;/)
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
    const issue = find(dialog!, (n) => n.tag === 'NButton' && text(n).includes('발급하기'))! // main 판 버튼 글자 «발급하기»(W1-2 는 «eSIM 발급하기»)
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

  it('«발급 후 취소 · 환불 불가» 문장이 앱 어디에도 없다 — 같은 자리는 05-A 14행(D-32)', () => {
    // 제외는 취소·환불 정책 생성물 하나 — 정본 03 의 «설치 후 단순 변심 환불 불가»(설치 뒤 이야기)라서(D-50 으로 main 에 들어옴 · W1-2 와 같은 규칙).
    // 발급 팝업(05-A) 등 다른 생성물은 그대로 본다(정본 rev 로 이 문장이 들어오면 막힌다)
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

  it('발급기 첫 화면 `/` — 사업자정보 · 방침 · 약관 블록(D-36 임시)', () => {
    expect(template(read('./index.vue'))).toContain('<IssuerBusinessInfo')
    expect(template(read('../components/legal/IssuerBusinessInfo.vue'))).toContain(
      'renderBusinessInfo(Object.values(BUSINESS_INFO))',
    )
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

describe('방침 9장① «발급 화면은 쿠키를 사용하지 않습니다» 가 참이다(D-31)', () => {
  // W1-2 의 흐름 쿠키가 들어오면 이 테스트가 실패한다 — 방침 rev(legal-pages)를 같이 들여오고 이 테스트를 고친다.
  // 읽기(server 의 getCookie — 아무도 만들지 않는 세션 쿠키 자리)는 «사용» 이 아니다 — 쿠키를 만드는 길만 본다
  it('앱 · 서버 코드에 쿠키를 만드는 길이 없다(useCookie · document.cookie · setCookie · Set-Cookie)', () => {
    for (const f of [...code(APP), ...code(SERVER)])
      expect(readFileSync(f, 'utf8'), f).not.toMatch(
        /useCookie|document\.cookie|setCookie\(|set-cookie/i,
      )
  })
})
