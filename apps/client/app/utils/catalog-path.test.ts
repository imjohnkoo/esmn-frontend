import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { elementAttrs, readSource } from '#shared/catalog/test-source'
import { catalogPageError, isCatalogParam, lowercaseRedirect } from './catalog-path'

describe('lowercaseRedirect (catalog spec D-13)', () => {
  it.each([
    ['/countries/FRA', '/countries/fra'],
    ['/countries/Fra', '/countries/fra'],
    ['/countries/FRA/', '/countries/fra'],
    ['/products/EU340', '/products/eu340'],
    ['/products/Cze00', '/products/cze00'],
  ])('%s → 301 %s', (path, target) => {
    expect(lowercaseRedirect(path)).toBe(target)
  })

  it.each([
    '/countries/fra',
    '/products/cze00',
    '/',
    '/search',
    '/verify/1',
    '/countries',
    '/products/cze00/x',
  ])('%s → 그대로', (path) => {
    expect(lowercaseRedirect(path)).toBeNull()
  })
})

describe('isCatalogParam', () => {
  it('나라 = 소문자 3자 · zone = 소문자 · 숫자 5자', () => {
    expect(isCatalogParam('countries', 'fra')).toBe(true)
    expect(isCatalogParam('products', 'cze00')).toBe(true)
    expect(isCatalogParam('products', 'eu340')).toBe(true)
  })

  it.each([
    ['countries', 'fr'],
    ['countries', 'fra1'],
    ['countries', 'FRA'],
    ['countries', '../x'],
    ['products', 'cze0'],
    ['products', 'cze000'],
    ['products', 'CZE00'],
    ['products', 'cze-0'],
  ] as const)('%s/%s → 404', (section, param) => {
    expect(isCatalogParam(section, param)).toBe(false)
  })
})

describe('catalogPageError (spec F-10 — 404 가 아닌 오류는 500)', () => {
  it.each([
    [{ statusCode: 404 }, false, 404],
    [null, false, 404],
    [undefined, false, 404],
    [{ statusCode: 500 }, false, 500],
    [{ statusCode: 502 }, false, 500],
    [{}, false, 500],
    [{ statusCode: 500 }, true, 500],
    [null, true, null],
  ] as const)('error %j · data %s → %s', (error, hasData, want) => {
    expect(catalogPageError(error, hasData)).toBe(want)
  })
})

describe('국가 · 상품 페이지가 catalogPageError 로 던진다(F-10 결선)', () => {
  const APP = fileURLToPath(new URL('../../', import.meta.url))
  it.each(['app/pages/products/[zone].vue', 'app/pages/countries/[iso3].vue'])('%s', (file) => {
    const t = readSource(`${APP}${file}`).script.map((x) => x.text)
    const at = t.findIndex((x, i) => x === 'catalogPageError' && t[i + 1] === '(')
    expect(at, '호출이 없다').toBeGreaterThan(-1)
    expect(t.slice(at, at + 4)).toEqual(['catalogPageError', '(', 'error', '.'])
    // 판정 결과를 그대로 던진다 — 호출부터 createError 의 statusCode 까지 토큰 그대로
    const run = t.slice(at - 3, at + 28).join(' ')
    expect(run).toContain(
      'const failed = catalogPageError ( error . value , ! ! data . value ) if ( failed ) throw createError ( { statusCode : failed',
    )
  })
})

describe('상품 페이지 결선 — 가격 카드 · 구매 시트는 계산한 값을 그대로 넘긴다', () => {
  const APP = fileURLToPath(new URL('../../', import.meta.url))
  const PAGE = `${APP}app/pages/products/[zone].vue`
  const { script } = readSource(PAGE)
  it('PlanCards 는 고른 종류 · 그 기간 카드를, PurchaseSheet 는 purchaseSheetProps 결과를 받는다', () => {
    // 속성 목록 전체 — `v-bind="purchase"` 뒤에 덧붙인 속성(`:naver-url=…`)은 그 값을 덮는다(Vue 3)
    expect(elementAttrs(PAGE, 'PlanCards')).toEqual([
      [
        { name: 'v-model', value: 'cap' },
        { name: 'name', value: 'cap' },
        { name: ':kind', value: 'kind' },
        { name: ':cards', value: 'cards' },
        { name: 'labelledby', value: 'cap-label' },
      ],
    ])
    expect(elementAttrs(PAGE, 'PurchaseSheet')).toEqual([
      [
        { name: 'v-if', value: 'purchase' },
        { name: 'v-model', value: 'sheetOpen' },
        { name: 'v-bind', value: 'purchase' },
      ],
    ])
    const code = script.map((x) => x.text).join(' ')
    expect(code).toContain('const cards = computed ( ( ) => planCards ( zone , sel . value ) )')
    expect(code).toContain(
      'const purchase = computed ( ( ) => purchaseSheetProps ( zone , sel . value ) )',
    )
  })
})
