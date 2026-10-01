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
    // 스크롤 안 — 고지(05-A 14행 · 약관 12조③ «미리 표시») 가 요약보다 먼저 · 이용약관 보기(새 탭)
    const kids = (scroll.children ?? []).filter((c) => c.type === ELEMENT)
    const policyAt = kids.findIndex((c) => cls(c) === 'select-date-page__confirm-policy')
    const summaryAt = kids.findIndex((c) => cls(c) === 'select-date-page__confirm')
    expect(policyAt).toBe(0)
    expect(summaryAt).toBeGreaterThan(policyAt)
    expect(text(kids[policyAt]!)).toContain('{{ ISSUE_NOTICE.refund }}')
    const terms = find(kids[policyAt]!, (n) => n.tag === 'a' && attr(n, 'href') === '/terms')!
    expect([attr(terms, 'target'), attr(terms, 'rel')]).toEqual(['_blank', 'noopener'])
    expect(text(terms)).toContain('이용약관 보기')
    // 동의 체크(05-A 19행) — 둘: 보통은 스크롤 밖(늘 보임), 공간이 모자라면 스크롤 안 끝(compact). 동시에 그려지지 않는다
    const boxes = findAll(dialog!, (n) => n.tag === 'NCheckbox' && dir(n, 'v-model') === 'isPolicyAgreed')
    expect(boxes).toHaveLength(2)
    for (const b of boxes) expect(dir(b.node, ':label')).toBe('ISSUE_NOTICE.consent')
    const inside = boxes.find((b) => b.ancestors.includes(scroll))!
    const outside = boxes.find((b) => !b.ancestors.includes(scroll))!
    expect(inside.ancestors.some((a) => dir(a, 'v-if') === 'confirmCompact')).toBe(true)
    expect(outside.ancestors.some((a) => dir(a, 'v-if') === '!confirmCompact')).toBe(true)
    // 체크 전에는 발급하기 비활성 · 눌러도 막힘 · 다시 열면 체크를 지운다(D-35 — 약관 동의 자리)
    const issue = find(dialog!, (n) => n.tag === 'NButton' && text(n).includes('발급하기'))!
    expect(dir(issue, ':disabled')).toBe('isSubmitting || !isPolicyAgreed')
    expect(src).toMatch(/if \(isSubmitting\.value \|\| !isPolicyAgreed\.value\) return/)
    expect(src).toMatch(/isPolicyAgreed\.value = false\n\s*isConfirmOrderVisible\.value = true/)
    // 높이 = utils/confirm-fit(숫자는 그 테스트가 본다) · layout viewport · 열릴 때 compact 초기화 · resize
    expect(src).toMatch(/confirmScrollFit\(\s*window\.innerHeight,\s*dialog\.offsetHeight,\s*el\.offsetHeight,/)
    expect(src).toMatch(/watch\(isConfirmOrderVisible,[\s\S]*?confirmCompact\.value = false[\s\S]*?requestAnimationFrame\(fitConfirm\)/)
    expect(src).toMatch(/window\.addEventListener\('resize', fitConfirm\)/)
  })

  it('«발급 후 취소 · 환불 불가» 문장이 앱 어디에도 없다 — 같은 자리는 05-A 14행(D-32)', () => {
    for (const f of code(APP))
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
