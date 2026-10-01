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

  it('select-date 확인 팝업(템플릿 AST) — 고지 먼저 · 스크롤 영역 배선 · 동의 체크는 밖(compact 면 안) · 체크 전 발급 비활성', () => {
    const src = read('./select-date/[orderId].vue')
    const tpl = parse(src).descriptor.template!.ast! as unknown as TNode
    const dialog = find(tpl, (n) => n.tag === 'NAlertDialog' && dir(n, 'v-model') === 'isConfirmOrderVisible')
    expect(dialog).toBeTruthy()
    const scroll = find(dialog!, (n) => cls(n).split(/\s+/).includes('select-date-page__confirm-scroll'))!
    // 높이 맞춤 배선 — ref · :style · @scroll 중 하나만 빠져도 높이 맞춤 · 흐림이 꺼진다
    expect(attr(scroll, 'ref')).toBe('confirmScrollEl')
    expect(dir(scroll, ':style')).toBe('confirmScrollStyle')
    expect(dir(scroll, '@scroll')).toBe('updateConfirmMore')
    // 스크롤 안 — 고지(05-A 원문 · 약관 12조③ «미리 표시») 가 요약보다 먼저
    const kids = (scroll.children ?? []).filter((c) => c.type === ELEMENT)
    const policyAt = kids.findIndex((c) => cls(c) === 'select-date-page__confirm-policy')
    const summaryAt = kids.findIndex((c) => cls(c) === 'select-date-page__confirm')
    expect(policyAt).toBe(0)
    expect(summaryAt).toBeGreaterThan(policyAt)
    // F-21 — 05-A 제목 + 안내 5줄(정본 순서) · 설치 전 3,500원 줄(둘째)은 굵게(D-32 «팝업 본문(굵게)»)
    expect(text(kids[policyAt]!)).toContain('{{ ISSUE_NOTICE.heading }}')
    expect(text(kids[policyAt]!)).toContain('<component :is="renderNoticeList(NOTICE_LINES, [1])" />')
    expect(src).toMatch(
      /const NOTICE_LINES = \[\s*ISSUE_NOTICE\.start,\s*ISSUE_NOTICE\.refund,\s*ISSUE_NOTICE\.period,\s*ISSUE_NOTICE\.device,\s*ISSUE_NOTICE\.trouble,\s*\]/,
    )
    // 동의 체크(05-A 19행) — 둘: 보통은 스크롤 밖(늘 보임), 공간이 모자라면 스크롤 안 끝(compact). 동시에 그려지지 않는다
    const boxes = findAll(dialog!, (n) => n.tag === 'NCheckbox' && dir(n, 'v-model') === 'isPolicyAgreed')
    expect(boxes).toHaveLength(2)
    for (const b of boxes) expect(dir(b.node, ':label')).toBe('ISSUE_NOTICE.consent')
    // 05-A 링크 줄 — 동의 체크 바로 아래(안 · 밖 둘 다) · 이용약관 보기 · 취소·환불 정책 보기 · 새 창
    for (const b of boxes) {
      const agree = b.ancestors[b.ancestors.length - 1]!
      const links = findAll(agree, (n) => n.tag === 'a').map((l) => [attr(l.node, 'href'), attr(l.node, 'target'), text(l.node)])
      expect(links.map(([h]) => h)).toEqual(['/terms', '/refund'])
      for (const [, target, t] of links) {
        expect(target).toBe('_blank')
        expect(t).toContain('(새 창)')
      }
      expect(links[0]![2]).toContain('이용약관 보기')
      expect(links[1]![2]).toContain('취소·환불 정책 보기')
    }
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

  it('체크아웃(템플릿 AST · F-22) — 동의는 05-B 항목 목록(CONSENT_ITEMS)만 그린다 · 처음 값 해제 · 결제는 필수 뒤 · 링크는 새 창', () => {
    const src = read('./checkout-preview.vue')
    const tpl = parse(src).descriptor.template!.ast! as unknown as TNode
    const agree = find(tpl, (n) => cls(n) === 'checkout__agree')!
    // 체크박스는 하나뿐 — 항목 목록을 돌며 그린다(문구 · 필수 여부 · 링크 · 알릴 사항은 utils 의 05-B 모델이 정한다)
    const boxes = findAll(tpl, (n) => n.tag === 'NCheckbox')
    expect(boxes).toHaveLength(1)
    const item = boxes[0]!.ancestors.find((a) => dir(a, 'v-for') !== undefined)!
    expect(dir(item, 'v-for')).toBe('item in CONSENT_ITEMS')
    expect(boxes[0]!.ancestors).toContain(agree)
    expect(dir(boxes[0]!.node, 'v-model')).toBe('agreed[item.key]')
    expect(dir(boxes[0]!.node, ':label')).toBe('item.label')
    // 항목의 링크 · 알릴 사항(선택 동의의 항목 · 목적 · 보유)이 그 항목 안에서 그려진다
    const itemLinks = find(item, (n) => n.tag === 'a')!
    expect(dir(itemLinks, 'v-for')).toBe('link in item.links')
    const info = find(item, (n) => dir(n, 'v-if') === 'item.info')!
    expect(text(info)).toContain('{{ item.info }}')
    // 처음 값 · 결제 조건은 utils 에서만 — 페이지가 체크 값을 쓰지 않는다(미리 체크 금지)
    expect(src).toMatch(/const agreed = reactive\(initialConsent\(\)\)/)
    expect(src).toMatch(/const canPay = computed\(\(\) => canPayWith\(agreed\)\)/)
    expect(src).not.toMatch(/agreed(?:\.\w+|\[[^\]]*\])\s*=(?!=)|Object\.assign\(\s*agreed/)
    const pay = find(tpl, (n) => n.tag === 'NButton' && /결제하기/.test(text(n)))!
    expect(dir(pay, ':disabled')).toBe('!isConfigured || !canPay')
    expect(src).toMatch(/if \(!isConfigured \|\| !canPay\.value \|\| isRequesting\.value\) return/)
    // 개인정보 «안내» — 체크 없음(2026-10-01 John (b) — 계약 이행 근거) · 제목 · 링크 · 알릴 사항은 PRIVACY_NOTICE
    const privacy = find(agree, (n) => cls(n) === 'checkout__notice')!
    expect(findAll(privacy, (n) => n.tag === 'NCheckbox')).toHaveLength(0)
    expect(text(privacy)).toContain('{{ PRIVACY_NOTICE.label }}')
    expect(dir(find(privacy, (n) => n.tag === 'a')!, 'v-for')).toBe('link in PRIVACY_NOTICE.links')
    expect(text(privacy)).toContain('{{ PRIVACY_NOTICE.info }}')
    // 결제 전 안내 — 제목 + 줄 전부
    const before = findAll(agree, (n) => cls(n) === 'checkout__notice')[1]!.node
    expect(text(before)).toContain('{{ BEFORE_NOTICE.title }}')
    expect(text(before)).toContain('<component :is="renderNoticeList(BEFORE_NOTICE.lines)" />')
    // 이 화면의 링크는 모두 새 창 — 다녀와도 체크가 풀리지 않게(지원 기기 확인 포함)
    const links = findAll(tpl, (n) => n.tag === 'a' || n.tag === 'NuxtLink')
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
    expect(footer).toMatch(/const \{ copyright, \.\.\.info \} = BUSINESS_INFO\nconst lines = Object\.values\(info\)\n/)
    expect(template(footer)).toContain('<component :is="renderBusinessLines(lines)" />')
    expect(template(footer)).toContain('{{ copyright }}')
    expect(template(footer)).toContain("'site-footer__link--privacy': link.to === '/privacy'")
    expect(footer).toMatch(/\.site-footer__link--privacy \{[^}]*color: var\(--n-color-primary-600[^}]*font-weight: 800/)
  })

  it('/refund · /business — 생성물을 그린다 · /business 는 공정위 조회를 푸터와 같은 주소로', () => {
    expect(template(read('./refund.vue'))).toContain('<LegalMarkdown :doc="REFUND_DOC" />')
    const biz = read('./business.vue')
    expect(template(biz)).toContain('<LegalMarkdown :doc="BUSINESS_DOC" />')
    expect(biz).toContain('const ftcUrl = ftcCheckUrl(BUSINESS_INFO.registration)')
    expect(template(biz)).toMatch(/:href="ftcUrl" target="_blank" rel="noopener"/)
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
