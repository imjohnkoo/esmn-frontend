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

  it('체크아웃(템플릿 AST · F-22) — 동의는 useCheckoutConsent 하나(항목 · 처음 값 · 결제 조건 — 행동은 utils 테스트) · 결제는 필수 뒤 · 링크는 새 창', () => {
    const src = read('./checkout-preview.vue')
    const tpl = parse(src).descriptor.template!.ast! as unknown as TNode
    const agree = find(tpl, (n) => cls(n) === 'checkout__agree')!
    // 체크박스는 하나뿐 — 항목 목록을 돌며 그린다(문구 · 필수 여부 · 링크 · 알릴 사항은 utils 의 05-B 모델이 정한다)
    const boxes = findAll(tpl, (n) => n.tag === 'NCheckbox')
    expect(boxes).toHaveLength(1)
    const item = boxes[0]!.ancestors.find((a) => dir(a, 'v-for') !== undefined)!
    expect(dir(item, 'v-for')).toBe('item in consentItems')
    expect(boxes[0]!.ancestors).toContain(agree)
    expect(dir(boxes[0]!.node, 'v-model')).toBe('agreed[item.key]')
    expect(dir(boxes[0]!.node, ':label')).toBe('item.label')
    // 항목의 링크 · 알릴 사항(선택 동의의 항목 · 목적 · 보유)이 그 항목 안에서 그려진다
    const itemLinks = find(item, (n) => n.tag === 'a')!
    expect(dir(itemLinks, 'v-for')).toBe('link in item.links')
    const info = find(item, (n) => dir(n, 'v-if') === 'item.info')!
    expect(text(info)).toContain('{{ item.info }}')
    // 동의 상태는 utils 의 useCheckoutConsent 하나에서 — 페이지는 받아서 그리기만 한다(미리 체크 · 필수 해제 · 결제 조건 바꾸기 금지).
    // 검사는 전부 TypeScript 구문 트리 위에서 — 기준 줄 · 가드 · 이름 수가 같은 대상을 본다(글자 검색은 주석 · 문자열에 속는다)
    const script = src.slice(src.indexOf('<script setup lang="ts">') + '<script setup lang="ts">'.length, src.indexOf('</script>'))
    const sf = ts.createSourceFile('checkout-preview.ts', script, ts.ScriptTarget.Latest, true)
    const idents: string[] = []
    const aliased: string[] = []
    const declared: string[] = [] // 변수 · 함수 · 매개변수 · 구조 분해로 선언된 이름(구조 분해 안의 이름 포함)
    const visit = (n: ts.Node): void => {
      if (ts.isIdentifier(n)) idents.push(n.text)
      if (ts.isImportSpecifier(n) && n.propertyName) aliased.push(n.propertyName.getText(sf))
      if ((ts.isVariableDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && ts.isIdentifier(n.name)) declared.push(n.name.text)
      if ((ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n)) && n.name) declared.push(n.name.text)
      ts.forEachChild(n, visit)
    }
    visit(sf)
    const count = (name: string) => idents.filter((i) => i === name).length
    const decls = sf.statements.filter(ts.isVariableStatement).flatMap((s) => [...s.declarationList.declarations])
    const consentDecl = decls.filter(
      (d) => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(sf) === 'useCheckoutConsent',
    )
    expect(consentDecl).toHaveLength(1)
    expect(consentDecl[0]!.name.getText(sf)).toBe('{ items: consentItems, agreed, canPay }')
    expect(consentDecl[0]!.initializer!.getText(sf)).toBe('useCheckoutConsent()')
    // 세 이름은 그 구조 분해에서만 선언된다(같은 이름의 const · 함수 · 매개변수로 가리지 못한다)
    expect(['agreed', 'canPay', 'consentItems', 'useCheckoutConsent'].map((n) => declared.filter((d) => d === n).length)).toEqual([1, 1, 1, 0])
    expect([count('useCheckoutConsent'), count('agreed'), count('consentItems'), count('canPay')]).toEqual([2, 1, 1, 2])
    expect(['initialConsent', 'canPayWith', 'CONSENT_ITEMS', 'reactive', 'eval', 'Function'].map(count)).toEqual([0, 0, 0, 0, 0, 0])
    expect(aliased).toEqual([])
    // onPay 의 첫 문장이 결제 조건 가드(그 함수에서 canPay 를 읽는 유일한 곳)
    const onPay = decls.find((d) => d.name.getText(sf) === 'onPay')!
    expect(onPay.initializer && ts.isArrowFunction(onPay.initializer) && ts.isBlock(onPay.initializer.body)).toBe(true)
    const payBody = (onPay.initializer as ts.ArrowFunction).body as ts.Block
    expect(payBody.statements[0]!.getText(sf)).toBe('if (!isConfigured || !canPay.value || isRequesting.value) return')
    // 템플릿 이름 수 — 템플릿 AST 의 식(지시자 · 보간)만 센다(HTML 주석 · 글자에 속지 않는다)
    const exprs: string[] = []
    const walkTpl = (n: TNode & { content?: { content?: string } }): void => {
      for (const p of n.props ?? []) if (p.exp) exprs.push(p.exp.content)
      if (n.type === 5 && n.content?.content) exprs.push(n.content.content)
      for (const c of n.children ?? []) walkTpl(c)
    }
    walkTpl(tpl)
    const tcount = (name: string) => exprs.join('\n').match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0
    expect([tcount('agreed'), tcount('consentItems'), tcount('canPay')]).toEqual([1, 1, 1])
    // 동의 영역을 숨기지 않는다(05-B 글자 · 체크가 화면에서 사라진다) — ① 템플릿: 동의 영역과 그 조상 · 자손 요소에 숨기는 속성
    // (hidden · style · class 동적 · inert · popover · aria-hidden · innerHTML/textContent/innerText — 대소문자 · 수식어 · 동적 인자 · 객체 v-bind 무관) ·
    // v-html/v-text · 수명 주기 이벤트(@vue:…) · 숨김 유틸 클래스(반응형 · ! 포함 · 임의 값 [..] 전부) · 숨기는 태그(details · dialog · canvas …,
    // 지시자 없는 template) 금지. sr-only 는 링크 안 «(새 창)» 낭독 안내만
    // ② 스코프 CSS: 동의 영역 · 페이지 뿌리(.checkout) · 구조 선택자(nth- · > · section …) 규칙에 숨기는 속성 금지 — 다른 checkout__* 규칙
    // (결제 버튼 바 등)은 자유. 전역 CSS · 레이아웃 등 정적 검사 밖은 spec D-38(사람 판정)
    const HIDE_ATTR = /^(?:hidden|style|class|inert|popover|aria-hidden|innerhtml|outerhtml|textcontent|innertext)$/
    const HIDE_CLASS =
      /^(?:hidden|invisible|collapse|sr-only|contents|absolute|fixed|opacity-|h-0|h-px|w-0|w-px|size-0|size-px|max-h-0|max-h-px|max-w-0|text-transparent|text-white|scale-|translate-|inset-|top-|left-|right-|bottom-|overflow-hidden|overflow-clip|indent-|truncate|line-clamp-|blur)/
    const HIDE_TAG = /^(?:details|summary|dialog|noscript|iframe|object|slot|canvas|teleport|keep-alive|keepalive)$/
    const agreeAt = findAll(tpl, (n) => n === agree)[0]!
    for (const node of [...agreeAt.ancestors, ...findAll(agree, () => true).map((x) => x.node)]) {
      const where = text(node).slice(0, 40)
      const tag = (node.tag ?? '').toLowerCase()
      expect(HIDE_TAG.test(tag), `태그 ${node.tag} · ${where}`).toBe(false)
      if (tag === 'template')
        expect(node.props?.some((p) => p.type === 7 && ['slot', 'for'].includes(p.name)), `지시자 없는 template · ${where}`).toBe(true)
      for (const p of node.props ?? []) {
        const name = p.name.toLowerCase()
        if (p.type === 6) expect(name !== 'class' && HIDE_ATTR.test(name), `속성 ${p.name} · ${where}`).toBe(false)
        if (p.type === 7 && p.name === 'bind')
          expect(!p.arg || p.arg.isStatic === false || HIDE_ATTR.test(p.arg.content.toLowerCase()), `v-bind ${p.rawName} · ${where}`).toBe(false)
        if (p.type === 7) expect(['html', 'text'].includes(p.name), `v-${p.name} · ${where}`).toBe(false)
        if (p.type === 7 && p.name === 'on') expect(/^vue:/.test(p.arg?.content ?? ''), `수명 주기 이벤트 ${p.rawName} · ${where}`).toBe(false)
      }
      const classAttr = node.props?.find((p) => p.type === 6 && p.name.toLowerCase() === 'class')?.value?.content ?? ''
      for (const token of classAttr.split(/\s+/).filter(Boolean)) {
        expect(token.includes('['), `임의 값 클래스 ${token}`).toBe(false)
        const base = token.split(':').pop()!.replace(/^!|!$/g, '').replace(/^-/, '')
        if (token === 'sr-only') expect(text(node)).toBe('<span class="sr-only"> (새 창)</span>')
        else expect(HIDE_CLASS.test(base), `숨김 클래스 ${token} · ${where}`).toBe(false)
      }
    }
    const style = src
      .slice(src.indexOf('>', src.indexOf('<style')) + 1, src.lastIndexOf('</style>'))
      .replace(/\/\*[\s\S]*?\*\//g, '')
    expect(style).toContain('.checkout {')
    const CONSENT_SEL = /\.checkout__(?:agree|consent|notice|link)|\.checkout(?![\w-])/
    const PLAIN_SEL = /^\s*\.checkout__[\w-]+(?:::?[\w-]+(?:\([^)]*\))?)*\s*$/ // 다른 checkout__* 한 개(의사 클래스 허용) — 동의 영역에 닿지 않는다
    for (const rule of style.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sels = rule[1]!.split(',')
      const risky = CONSENT_SEL.test(rule[1]!) || sels.some((s) => !PLAIN_SEL.test(s))
      if (!risky || /^\s*@/.test(rule[1]!)) continue
      expect(rule[2], rule[1]!.trim()).not.toMatch(
        /(?:^|[\s;{])(?:display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|content-visibility\s*:|opacity\s*:|filter\s*:|mask(?:-image)?\s*:|(?:scale|zoom|translate|inset|transform)\s*:|position\s*:\s*(?:absolute|fixed)|overflow(?:-[xy])?\s*:\s*(?:hidden|clip)|clip(?:-path)?\s*:|text-indent\s*:|color\s*:\s*(?:transparent|rgba?\([^)]*(?:,|\/)\s*0(?:\.0+)?\s*\)|#[0-9a-f]{3}0\b|#[0-9a-f]{6}00\b)|font-size\s*:\s*(?:0|[1-7](?:\.\d+)?px|0?\.\d+(?:r?em|px))|(?:max-)?(?:height|width)\s*:\s*(?:0|1px|0?\.\d+(?:px|r?em))(?![.\d])|line-height\s*:\s*0(?![.\d])|(?:left|right|top|bottom|margin(?:-[a-z]+)?)\s*:\s*[^;]*-(?:\d{3,}(?:\.\d+)?px|\d{2,}(?:\.\d+)?r?em|\d+(?:\.\d+)?(?:vw|vh|%))|v-bind\()/i,
      )
    }
    // 체크박스에는 v-model · :label 만 — :disabled · v-if · v-show 등이 붙으면 필수 체크를 못 하거나 숨는다
    expect(boxes[0]!.node.props!.map((p) => p.rawName ?? p.name)).toEqual(['v-model', ':label'])
    // 동의 영역 안의 조건부 표시는 «알릴 사항이 있는 항목만» 하나 — 05-B 글자를 숨기는 v-if · v-show · <template v-if> 금지
    const conditional = (n: TNode) =>
      n.props?.some((p) => p.type === 7 && ['if', 'else-if', 'else', 'show'].includes(p.name)) ?? false
    expect(findAll(agree, conditional).map((c) => dir(c.node, 'v-if'))).toEqual(['item.info'])
    for (const up of agreeAt.ancestors) expect(conditional(up), text(up).slice(0, 40)).toBe(false)
    const pay = find(tpl, (n) => n.tag === 'NButton' && /결제하기/.test(text(n)))!
    expect(dir(pay, ':disabled')).toBe('!isConfigured || !canPay')
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
    // 이 페이지 템플릿의 링크는 모두 새 창 — 다녀와도 체크가 풀리지 않게(지원 기기 확인 포함 · 레이아웃 푸터는 이 파일 밖)
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
    expect(footer).toMatch(/\nconst \{ lines, copyright \} = footerParts\(BUSINESS_INFO\)\n/)
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
    // 공정위 조회 줄은 주소가 있을 때만 — 조건은 그것 하나(숨기는 조건 · v-show 금지)
    const btpl = parse(biz).descriptor.template!.ast! as unknown as TNode
    const ftc = find(btpl, (n) => cls(n) === 'business-page__ftc')!
    expect(ftc.props!.map((p) => p.rawName ?? p.name)).toEqual(['v-if', 'class'])
    expect(dir(ftc, 'v-if')).toBe('ftcUrl')
    const link = find(ftc, (n) => n.tag === 'a')!
    expect(link.props!.map((p) => p.rawName ?? p.name)).toEqual([':href', 'target', 'rel'])
    expect(dir(link, ':href')).toBe('ftcUrl')
    expect(text(link)).toContain('사업자정보확인')
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
