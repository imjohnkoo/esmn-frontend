import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { APP_DIR } from './test-data'
import {
  parseSource,
  readSource,
  scanScript,
  stringsOf,
  type SourceParts,
  type Token,
} from './test-source'

/**
 * spec 불변식 2 · DoD 2 «가격 리터럴 0» — 화면에 나가는 가격은 K1 최종가에서만 나온다.
 * 앱 소스(app · shared · server · modules · nuxt.config · CSS)를 토큰으로 읽어(주석 제외 — test-source.ts) 찾는다.
 *  1. 금액 글자 — 문자열 · 템플릿(태그 · &nbsp; 를 걷고) · 스타일(`content:`) · JSON 문자열의
 *     «4,900원» · «50원» · «₩4,900» · «KRW 4,900» · «4900 KRW» · «1만원»(전각 숫자 포함)
 *  2. 가격 문맥의 숫자 — 가격 · 금액 이름(`…Won` · `…price(s)` · `…amount`)에 대입 · 속성으로 이어지는 식(여러 줄 포함)
 *     안의 10 이상 숫자 · 숫자 모양 문자열(`amount: 4900` · `lowestWon: number =\n 4900` · `price: f\n ? 4900\n : 9100` ·
 *     `fallbackPrice = '4,900'` · `:price="+4900"` · `price="4900"`)
 *  3. 가격 함수 인자의 숫자 — `formatWon(4900)` · `formatWon(x ?? 4900)` · 여러 줄 인자
 *  4. «원» 으로 이어지는 숫자 — `${4900}원` · `${'4,900'}원` · `4900 + '원'` · `(4900).toLocaleString() + '원'` · `{{ 4900 }}원`
 *  5. 템플릿 디렉티브 — 모든 `v-*` · `:` · `.` · `@` · `#` 속성 값(따옴표 · 작은따옴표 · 따옴표 없음)을 식으로 읽는다,
 *     `v-text` · `v-html` · `v-for` 에 박힌 100 이상 숫자
 *  6. JSON 의 가격 키 아래(중첩 포함) 숫자 · 숫자 모양 문자열
 * 테스트 · 테스트 도우미 · 카탈로그 데이터 · 자산 매니페스트는 대상이 아니다. 0 · 한 자리는 가격으로 보지 않는다(누적 초기값).
 * 이것은 휴리스틱이다 — 가격을 그리는 곳은 따로 K1 원본과 대조한다: PlanCards · ZoneCard(컴포넌트 행동 테스트) ·
 * 구매 시트 값(`purchaseSheetProps` — picker.test · 페이지는 그 결과를 그대로 넘긴다 — catalog-path.test 결선).
 */
const ROOTS = ['app', 'shared', 'server', 'modules']
const EXTRA = ['nuxt.config.ts']
const EXT = /\.(ts|vue|json|css)$/
const SKIP = [
  /\.test\.ts$/,
  /^shared\/catalog\/test-(data|source|copy)\.ts$/,
  /^server\/data\//,
  /^app\/content\/catalog-assets\.json$/,
]

const nfkc = (s: string) => s.normalize('NFKC')
const WON =
  /₩\s*\d|KRW\s*\d|\d+\s*[만천]\s*원|(?<![\w.,])(?:\d{1,3}(?:,\d{3})+|\d{2,})\s*(?:원|KRW)/i
const wonIn = (s: string) => nfkc(s).match(WON)?.[0]
const PRICE_NAME = /(won|price|amount)s?$/i
const PRICE_FN = /^(formatWon|perDayWon|perGbWon)$/
const ASSIGN = new Set([':', '=', '||=', '??=', '&&=', '+=', '-=', '*='])
const OPEN = new Set(['(', '[', '{'])
const CLOSE = new Set([')', ']', '}'])
/** 문장을 새로 여는 키워드 — 여러 줄 식은 이어 보되 여기서 끊는다 */
const STATEMENT = new Set([
  'const',
  'let',
  'var',
  'return',
  'if',
  'else',
  'for',
  'while',
  'export',
  'import',
  'function',
  'class',
  'type',
  'interface',
  'throw',
])
const priceNumber = (t: Token | undefined) => t?.kind === 'number' && Number(t.value) >= 10
const numericString = (t: Token | undefined) =>
  t?.kind === 'string' && /^\s*\d[\d,]{1,}\s*$/.test(nfkc(t.value))
const startsWithWon = (t: Token | undefined) =>
  t?.kind === 'string' && nfkc(t.value).trimStart().startsWith('원')

/**
 * from 부터 식 한 덩어리(같은 깊이의 `;` · `,` · 닫는 괄호 · 새 문장 키워드까지 — 줄바꿈은 넘는다)에서
 * 10 이상 숫자나 숫자 모양 문자열(«'4,900'»)을 찾는다. from 이 `(` 이면 그 괄호가 닫힐 때까지(함수 인자)
 */
function numberInExpression(tokens: Token[], from: number, args = false): Token | undefined {
  let depth = 0
  for (let j = from; j < tokens.length; j++) {
    const t = tokens[j]!
    // 속성 이름으로 쓰인 키워드(`o.type` · `{ type: … }`)는 새 문장이 아니다
    const keyword =
      t.kind === 'ident' &&
      STATEMENT.has(t.text) &&
      tokens[j - 1]?.text !== '.' &&
      tokens[j + 1]?.text !== ':'
    const stop = t.text === ';' || t.text === ',' || keyword
    if (j > from && depth === 0 && stop) return undefined
    if (OPEN.has(t.text)) depth++
    else if (CLOSE.has(t.text)) {
      depth--
      // 함수 인자(args — 가격 함수의 여는 괄호부터)는 그 괄호가 닫히면 끝, 대입식의 괄호는 묶음일 뿐이다
      if (depth < 0 || (args && depth === 0)) return undefined
    } else if (priceNumber(t) || numericString(t)) return t
  }
  return undefined
}

export function scriptOffenders(tokens: Token[]): string[] {
  const out: string[] = []
  tokens.forEach((t, i) => {
    const next = tokens[i + 1]
    if (t.kind === 'string') {
      const w = wonIn(t.value)
      if (w) out.push(`문자열 «${w}»`)
      // '4,900' + '원' · `${'4,900'}원`
      const joined =
        (next?.text === '+' && startsWithWon(tokens[i + 2])) ||
        (next?.text.startsWith('}') && startsWithWon(next))
      if (numericString(t) && joined) out.push(`'${t.value}' … «원»`)
    }
    const name = t.kind === 'ident' ? t.text : t.kind === 'string' ? t.value : ''
    if (name && PRICE_NAME.test(name) && ASSIGN.has(next?.text ?? '')) {
      const n = numberInExpression(tokens, i + 2)
      if (n) out.push(`${name} ${next!.text} … ${n.text}`)
    }
    if (t.kind === 'ident' && PRICE_FN.test(t.text) && next?.text === '(') {
      const n = numberInExpression(tokens, i + 1, true) // 여는 괄호부터 — 인자 안의 줄바꿈 · 괄호를 넘는다
      if (n) out.push(`${t.text}(… ${n.text} …)`)
    }
    if (priceNumber(t)) {
      // 같은 문장 안에서 숫자 뒤에 «원» 이 붙는 두 모양 — 템플릿 이어짐(`${4900}원`) · `+ '원'`.
      // 그 사이의 함수 인자 문자열(`toLocaleString('ko-KR')`)은 건너뛴다
      for (let k = 1; k <= 12; k++) {
        const u = tokens[i + k]
        if (!u || u.text === ';' || u.newline) break
        const joins =
          u.kind === 'string' && (u.text.startsWith('}') || tokens[i + k - 1]?.text === '+')
        if (joins) {
          if (startsWithWon(u)) out.push(`${t.text} … «원»`)
          break
        }
      }
    }
  })
  return out
}

const INTERP = /\{\{([\s\S]*?)\}\}/g
/** 모든 디렉티브 · 바인딩 · 이벤트 · 슬롯 속성(수식어 포함) — 값은 큰따옴표 · 작은따옴표 · 따옴표 없음 */
const DIRECTIVE =
  /(?:^|\s)((?:v-[\w-]+(?::[\w.-]+)?|:[\w.-]+|\.[\w-]+|@[\w.-]+|#[\w.-]+))\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/g
const STATIC_PRICE_ATTR =
  /(?:^|\s)(?![:@#.])([\w-]*(?:won|price|amount)[\w-]*)\s*=\s*["']?\s*[\d₩]/i
/** 태그 · 공백 엔티티를 걷은 글자 — «4,900<small>원</small>» · «4,900&nbsp;원» 을 붙여 읽는다.
 *  보간식 `{{ }}` 안은 식이라 건드리지 않는다(`{{ n < 3 ? … }}` 의 `<` 를 태그로 읽지 않게) */
const stripTags = (html: string) =>
  html.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
const visibleText = (template: string) =>
  template
    .split(/(\{\{[\s\S]*?\}\})/)
    .map((part) => (part.startsWith('{{') ? part : stripTags(part)))
    .join('')

export function templateOffenders(template: string): string[] {
  const out: string[] = []
  const w = wonIn(visibleText(template))
  if (w) out.push(`템플릿 «${w}»`)
  for (const m of template.matchAll(INTERP)) {
    const tokens = scanScript(m[1]!)
    out.push(...scriptOffenders(tokens).map((o) => `{{ }} ${o}`))
    // {{ 4900 }}원 · {{ '4,900' }}원 · {{ 4900 }}<small>원</small>
    const after = visibleText(template.slice(m.index! + m[0].length))
    const literal = tokens.some(
      (t) => priceNumber(t) || (t.kind === 'string' && /\d{2,}/.test(t.value)),
    )
    if (/^\s*원/.test(after) && literal) out.push(`{{ ${m[1]!.trim()} }}원`)
  }
  for (const m of template.matchAll(DIRECTIVE)) {
    const name = m[1]!
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    const tokens = scanScript(value)
    out.push(...scriptOffenders(tokens).map((o) => `${name} ${o}`))
    const bare = name
      .replace(/^(v-bind:|v-[\w-]+:|[:.@#])/, '')
      .replace(/\.[\w-]+$/, '')
      .replace(/-/g, '')
    if (PRICE_NAME.test(bare) && tokens.some((t) => priceNumber(t) || numericString(t)))
      out.push(`${name}="${value}"`)
    // 값을 그대로 화면에 쓰거나 목록을 만드는 디렉티브에 박힌 금액(v-text="4900" · v-for="p in [4900]")
    if (
      /^v-(text|html|for)$/.test(name) &&
      tokens.some((t) => t.kind === 'number' && Number(t.value) >= 100)
    )
      out.push(`${name}="${value}"`)
  }
  const attr = template.match(STATIC_PRICE_ATTR)?.[0]
  if (attr) out.push(`속성 ${attr.trim()}`)
  return out
}

/** JSON — 문자열 속 금액 · 가격 키 아래(중첩 포함)의 숫자 · 숫자 모양 문자열 */
export function jsonOffenders(v: unknown, at = '', inPrice = false): string[] {
  if (typeof v === 'string') {
    const w = wonIn(v)
    if (w) return [`${at}: «${w}»`]
    return inPrice && /^\s*\d[\d,]{1,}\s*$/.test(nfkc(v)) ? [`${at}: "${v}"`] : []
  }
  if (typeof v === 'number') return inPrice && v >= 10 ? [`${at}: ${v}`] : []
  if (Array.isArray(v)) return v.flatMap((x, i) => jsonOffenders(x, `${at}[${i}]`, inPrice))
  if (v && typeof v === 'object')
    return Object.entries(v).flatMap(([k, x]) =>
      jsonOffenders(x, `${at}.${k}`, inPrice || PRICE_NAME.test(k)),
    )
  return []
}

function partsOffenders({ script, template, style }: SourceParts): string[] {
  const out = [...scriptOffenders(script), ...templateOffenders(template)]
  const w = wonIn(style)
  if (w) out.push(`스타일 «${w}»`)
  return out
}

/** 파일 한 개 — 확장자로 길을 고른다(대조군이 글자로 같은 길을 탄다) */
export function offendersOf(file: string, content: string): string[] {
  if (file.endsWith('.json')) return jsonOffenders(JSON.parse(content))
  return partsOffenders(parseSource(file, content))
}

const offenders = (file: string) => offendersOf(file, readFileSync(file, 'utf8'))

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? files(full) : EXT.test(name) ? [full] : []
  })
}

const sources = [
  ...ROOTS.flatMap((r) => files(join(APP_DIR, r))),
  ...EXTRA.map((f) => join(APP_DIR, f)),
]
  .map((f) => relative(APP_DIR, f))
  .filter((f) => !SKIP.some((re) => re.test(f)))

describe('가격 리터럴 0 (spec 불변식 2 · DoD 2)', () => {
  it('대상 파일을 실제로 읽는다(상세 · 홈 · 체크아웃 · 빌드 모듈 · 설정 · CSS 포함)', () => {
    expect(sources.length).toBeGreaterThan(50)
    for (const f of [
      'app/pages/products/[zone].vue',
      'app/pages/index.vue',
      'app/pages/checkout-preview.vue',
      'app/content/product-detail.ts',
      'app/content/catalog-upcoming.json',
      'app/assets/css/main.css',
      'shared/utils/robots.ts',
      'modules/catalog.ts',
      'nuxt.config.ts',
    ])
      expect(sources).toContain(f)
  })

  it('읽는 길이 실제로 내용을 꺼낸다(.ts 문자열 · .vue 템플릿 · <script setup> · <style>)', () => {
    const at = (f: string) => readSource(join(APP_DIR, f))
    expect(stringsOf(at('app/content/product-detail.ts').script)).toContain(
      '사용일수는 이렇게 계산해요',
    )
    const zone = at('app/pages/products/[zone].vue')
    expect(zone.template).toContain('구매하기')
    expect(stringsOf(zone.script)).toContain('Catalog zone unavailable')
    expect(at('app/components/catalog/ZoneMap.vue').style).toContain('.zone-map')
    expect(at('app/assets/css/main.css').style.length).toBeGreaterThan(0)
  })

  // 예외 하나(spec 불변식 2 · client-shell D-28): 법정 문서 생성물(legal-pages 정본)의 폐기 비용 «3,500원» — 상품 가격이 아니라 공제 문장.
  // 그 파일에서도 다른 금액 글자는 잡는다(정본 rev 가 금액을 더 넣으면 여기서 멈춰 사람이 다시 정한다)
  const LEGAL_GENERATED = /^app\/content\/legal\/[^/]+\.ts$/
  const LEGAL_FEE = '문자열 «3,500원»'
  // 법정 문서는 문서 전체가 문자열 하나라 offenders(문자열마다 첫 금액)로는 «3,500원» 뒤의 다른 금액이 가려진다 — 파일의 금액을 전부 센다
  const allWon = (text: string) =>
    [...nfkc(text).matchAll(new RegExp(WON.source, 'gi'))].map((m) => m[0].replace(/\s+/g, ''))
  const legalAmounts = (text: string) => allWon(text).filter((w) => w !== '3,500원')
  it('앱 소스에 금액 글자 · 가격 문맥의 숫자가 없다(법정 생성물의 폐기 비용 «3,500원» 만 예외)', () => {
    const found = sources.flatMap((f) =>
      offenders(join(APP_DIR, f))
        .filter((o) => !(LEGAL_GENERATED.test(f) && o === LEGAL_FEE))
        .map((o) => `${f}: ${o}`),
    )
    expect(found).toEqual([])
  })
  it('예외는 실제로 법정 생성물에만 · 폐기 비용 글자에만 걸린다(대조군)', () => {
    const legal = sources.filter((f) => LEGAL_GENERATED.test(f))
    expect(legal).toEqual(
      expect.arrayContaining(['app/content/legal/refund.ts', 'app/content/legal/terms.ts']),
    )
    expect(legal.flatMap((f) => offenders(join(APP_DIR, f)))).toContain(LEGAL_FEE)
    expect(
      offendersOf('app/content/legal/x.ts', "export const A = { t: '폐기 비용 4,900원' }"),
    ).toEqual(['문자열 «4,900원»'])
    expect(LEGAL_GENERATED.test('app/content/product-detail.ts')).toBe(false)
  })
  it('법정 생성물의 금액은 전부 «3,500원» — 같은 문자열 안 둘째 · 셋째 금액도 센다(정본 rev 가 금액을 더 넣으면 멈춘다)', () => {
    const legal = sources.filter((f) => LEGAL_GENERATED.test(f))
    const others = legal.flatMap((f) =>
      legalAmounts(readFileSync(join(APP_DIR, f), 'utf8')).map((w) => `${f}: ${w}`),
    )
    expect(others).toEqual([])
    expect(
      legal.flatMap((f) => allWon(readFileSync(join(APP_DIR, f), 'utf8'))).length,
    ).toBeGreaterThan(0)
    // 대조군 — 3,500원 뒤에 다른 금액이 같은 문자열에 있어도 잡는다
    expect(
      legalAmounts(
        'export const A = { markdown: `폐기 비용 3,500원 · 변경 수수료 9,900원 · 2만 원` }',
      ),
    ).toEqual(['9,900원', '2만원'])
  })

  describe('검사식이 실제로 잡는다(대조군)', () => {
    it.each([
      "const a = '12700 원'",
      "const a = '50원'",
      "const a = '₩4,900'",
      "const a = '4900 KRW'",
      "const a = 'KRW 4,900'",
      "const a = '1만원'",
      "const a = '４,９００원'",
      'const x = { amount: 4900 }',
      "const x = { 'amount': 4900 }",
      'let lowestWon = 900',
      'const b01Won: number = 4900',
      'const lowestWon: number =\n  4900',
      'b09Won ||= 4900',
      'totalWon += 900',
      'const t = { perDayWon: 900, unitPrice: 900 }',
      'const t = { lowestWon: flag ? 4900 : 9100 }',
      'const lowestWon = flag\n  ? 4900\n  : 9100',
      'const t = {\n  price:\n    kind === 1\n      ? 4900\n      : 9100,\n}',
      'const prices = [4900, 9100]',
      "const fallbackPrice = '4,900'",
      'formatWon(4900)',
      'formatWon((4900))',
      'formatWon(x ?? 4900)',
      'formatWon(\n  x.days === 7\n    ? 4900\n    : x.finalWon,\n)',
      'const s = `${4900}원`',
      "const s = `${'4,900'}원`",
      "const s = 4900 + '원'",
      "const s = '4,900' + '원'",
      "const s = `${(4900).toLocaleString('ko-KR')}원`",
      // 괄호로 시작하는 대입식 · 속성 이름으로 쓰인 키워드(5회차 리뷰 — 예전 판이 잡던 모양)
      'const lowestWon = (flag) ? 4900 : 9100',
      'const price = (base) + 4900',
      "lowestWon = o.type === 'U' ? 4900 : 9100",
      'amount = el.class ? 4900 : 0',
      'const t = { lowestWon: { type: 1 }.type ? 4900 : 0 }',
      // 한 줄에 정규식 속 따옴표 — 정규식으로 다시 읽지 않으면 뒤 문자열의 짝이 어긋나 금액을 놓친다
      "const r = /'/; const a = '4,900원'",
    ])('스크립트 %j', (code) => {
      expect(scriptOffenders(scanScript(code)).length).toBeGreaterThan(0)
    })

    it.each([
      '<p>4,900원부터</p>',
      '<p>{{ 4900 }}원</p>',
      "<p>{{ '4,900' }}원</p>",
      '<p>{{ (4900).toLocaleString() }}원</p>',
      '<p>{{ formatWon(4900) }}</p>',
      '<p>{{\n  formatWon(\n    x.days === 7\n      ? 4900\n      : x.finalWon,\n  )\n}}</p>',
      '<PlanCard :price="4900" />',
      '<PlanCard :price="+4900" />',
      "<PlanCard :price='4900' />",
      '<PlanCard :price=4900 />',
      '<PlanCard :price.prop="4900" />',
      '<PlanCard .price="4900" />',
      '<PlanCard :final-won="9100" />',
      '<PlanCard v-bind="{ price: 4900 }" />',
      '<PlanCard price="4900" />',
      '<span v-text="formatWon(4900)" />',
      '<span v-text="4900" />',
      '<li v-for="p in [4900, 9100]" :key="p">{{ formatWon(p) }}</li>',
      '<p>₩4,900</p>',
      '<strong>4,900<small>원</small></strong>',
      '<p>4,900&nbsp;원</p>',
      '<p>{{ 4900 }}<small>원</small></p>',
      // 보간식 속 비교 `<` 를 태그로 읽지 않는다(5회차 리뷰 — 예전 판이 잡던 모양)
      "<p>{{ n <= 3 ? '4,900원' : '' }}</p>",
      "<p>{{ a<b ? '9,100원' : '' }}</p>",
      '<p>{{ formatWon(a < b ? 4900 : x) }}</p>',
      '<p>{{ n < 10 ? 4900 : 0 }}원</p>',
    ])('템플릿 %j', (tpl) => {
      expect(templateOffenders(tpl).length).toBeGreaterThan(0)
    })

    it('SFC 전체 길 — 템플릿 · <script setup> · 일반 <script> · <style> 을 각각 본다', () => {
      const sfc = (body: string) => partsOffenders(parseSource('x.vue', body))
      expect(sfc('<template><p>4,900원</p></template>')).toHaveLength(1)
      expect(
        sfc('<template><p/></template><script setup lang="ts">const a = { amount: 4900 }</script>'),
      ).toHaveLength(1)
      expect(
        sfc('<template><p/></template><script lang="ts">export const a = "9,100원"</script>'),
      ).toHaveLength(1)
      expect(
        sfc('<template><p/></template><style>.a::after { content: "9,100원" }</style>'),
      ).toHaveLength(1)
      expect(partsOffenders(parseSource('x.css', '.a::after { content: "4,900원" }'))).toHaveLength(
        1,
      )
    })

    it('JSON — 가격 키 아래 숫자(중첩 · 숫자 문자열) · 문자열 속 금액', () => {
      expect(jsonOffenders(JSON.parse('{"items":[{"finalWon": 4900}]}'))).toEqual([
        '.items[0].finalWon: 4900',
      ])
      expect(jsonOffenders(JSON.parse('{"note":"일본은 곧 4,900원부터"}'))).toEqual([
        '.note: «4,900원»',
      ])
      expect(jsonOffenders(JSON.parse('{"price":"4900"}'))).toHaveLength(1)
      expect(jsonOffenders(JSON.parse('{"price":{"value":4900}}'))).toHaveLength(1)
      expect(jsonOffenders(JSON.parse('{"lowestWon":"4,900"}'))).toHaveLength(1)
      expect(jsonOffenders(JSON.parse('{"iso2":"FR","cities":["파리"],"days":30}'))).toEqual([])
    })

    it('파일 길 — 확장자대로 JSON · SFC · TS · CSS 를 읽는다', () => {
      expect(offendersOf('x.json', '{"note":"4,900원"}')).toHaveLength(1)
      expect(
        offendersOf('x.vue', '<template><p>{{ formatWon(4900) }}</p></template>'),
      ).toHaveLength(1)
      expect(offendersOf('x.ts', 'export const amount = 4900')).toHaveLength(1)
      expect(offendersOf('x.css', '.a::after { content: "9,100원" }')).toHaveLength(1)
    })

    it.each([
      "const a = 'K2 원문'",
      "const a = '0원 금지'",
      '// 4,900원 은 주석 — 설명 속 예시는 허용',
      '/* 9,100원 */ const a = 1',
      'const x = { amount: option.finalWon }',
      'let totalWon = 0',
      'let totalWon = 0\nconst width = 400',
      'const priceLabel = kind === 1 ? label : other',
      'const s = `${won}원`',
      "const a = ['/verify/**']",
      'const t = { width: 400, status: 404 }',
      'formatWon(option.finalWon)',
    ])('허용 — 스크립트 %j', (code) => {
      expect(scriptOffenders(scanScript(code))).toEqual([])
    })

    it.each([
      '{{ formatWon(option.finalWon) }}',
      '<PlanCard :price="formatWon(o.finalWon)" />',
      '<p>512kbps · 30일</p>',
      '<p>{{ won }}원</p>',
      '<img width="400" height="400" />',
      '<PlanCard :price="0" />',
      '<li v-for="d in 30" :key="d">{{ d }}일</li>',
      '<span v-text="label" />',
    ])('허용 — 템플릿 %j', (tpl) => {
      expect(templateOffenders(tpl)).toEqual([])
    })
  })
})
