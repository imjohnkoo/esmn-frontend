// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { flagUrl, type AssetManifest } from '#shared/catalog/assets'
import { buildSearchIndex } from '#shared/catalog/search'
import { activeCatalog } from '#shared/catalog/test-data'
import manifest from '~/content/catalog-assets.json'
import { COUNTRY_ALIASES } from '~/content/catalog-search'
import upcomingJson from '~/content/catalog-upcoming.json'
import { errorView, pickChips, type ErrorView } from '~/utils/error-view'
import ErrorPanel from './ErrorPanel.vue'

/** catalog spec S-7 — 오류 화면 본문(목업 E-1 ~ E-4). 기대값은 spec 표 그대로 적는다 */
const en = new Intl.DisplayNames('en', { type: 'region' })
const index = buildSearchIndex(
  activeCatalog(),
  upcomingJson.countries,
  COUNTRY_ALIASES,
  (iso2) => en.of(iso2) ?? iso2,
)
const chipSets = pickChips(index)
const stubs = {
  NuxtLink: defineComponent({
    props: { to: { type: String, default: '' } },
    setup:
      (props, { slots }) =>
      () =>
        h('a', { href: props.to }, slots.default?.()),
  }),
}
const render = (view: ErrorView) =>
  mount(ErrorPanel, {
    props: { view, chips: view.chips ? chipSets[view.chips] : [] },
    global: { stubs },
  })
const links = (w: ReturnType<typeof render>) =>
  w.findAll('a').map((a) => [a.text().replace(/\s+/g, ' ').trim(), a.attributes('href')])

describe('ErrorPanel — 갈래별 화면(S-7)', () => {
  it('없는 주소(E-1) — 제목 · 두 줄 · 나라 찾기/홈으로 · 인기 국가 칩 8', () => {
    const w = render(errorView(404, '/abc'))
    expect(w.get('h1').text()).toBe('찾는 페이지가 없어요')
    expect(w.get('.error-panel__desc').text()).toBe(
      '주소가 바뀌었거나 없어진 페이지예요. 가려던 나라를 다시 찾아보세요.',
    )
    expect(w.find('.error-panel__ill').exists()).toBe(true)
    expect(w.find('.error-panel__badge').exists()).toBe(false)
    expect(w.get('h2').text()).toBe('인기 국가')
    expect(links(w)).toEqual([
      ['나라 찾기', '/search'],
      ['홈으로', '/'],
      ['네덜란드', '/countries/nld'],
      ['크로아티아', '/countries/hrv'],
      ['프랑스', '/countries/fra'],
      ['그리스', '/countries/grc'],
      ['폴란드', '/countries/pol'],
      ['노르웨이', '/countries/nor'],
      ['독일', '/countries/deu'],
      ['오스트리아', '/countries/aut'],
    ])
    // 칩마다 국기(자체 호스팅 SVG · 장식)
    const flags = w.findAll('.error-panel__chip img')
    expect(flags).toHaveLength(8)
    expect(flags[0]!.attributes('src')).toBe(flagUrl(manifest as AssetManifest, 'NL'))
    expect(flags[0]!.attributes('alt')).toBe('')
  })

  it('준비 중 나라(E-2) — 국기 72 + «준비 중» · 나라 이름 제목 · 고객센터 · 아시아 칩 5(상자)', () => {
    const w = render(errorView(404, '/countries/jpn'))
    const flag = w.get('.error-panel__flag img')
    expect(flag.attributes('src')).toBe(flagUrl(manifest as AssetManifest, 'JP'))
    expect(flag.attributes('width')).toBe('72')
    expect(w.get('.error-panel__badge').text()).toBe('준비 중')
    expect(w.find('.error-panel__ill').exists()).toBe(false)
    expect(w.get('h1').text()).toBe('일본 eSIM은 아직 준비 중이에요')
    expect(w.get('.error-panel__desc').text()).toBe(
      '지금은 판매하지 않는 나라예요. 궁금한 점은 고객센터로 물어봐 주세요.',
    )
    expect(w.get('h2').text()).toBe('지금 살 수 있는 아시아 나라')
    expect(w.find('.error-panel__chips-wrap--box').exists()).toBe(true)
    expect(links(w)).toEqual([
      ['다른 나라 찾기', '/search'],
      ['고객센터', '/my#cs'],
      ['베트남', '/countries/vnm'],
      ['태국', '/countries/tha'],
      ['싱가포르', '/countries/sgp'],
      ['인도네시아', '/countries/idn'],
      ['홍콩', '/countries/hkg'],
    ])
  })

  it('없는 상품(E-3) — 제목 · 두 줄만 다르고 버튼 · 칩은 E-1 과 같다', () => {
    const w = render(errorView(404, '/products/xxx00'))
    expect(w.get('h1').text()).toBe('찾는 상품이 없어요')
    expect(w.get('.error-panel__desc').text()).toBe(
      '상품 구성이 바뀌었을 수 있어요. 가려는 나라로 다시 찾아보세요.',
    )
    expect(links(w)).toEqual(links(render(errorView(404, '/abc'))))
  })

  it('잠시 오류(E-4) — «다시 시도» 는 버튼(누르면 retry) · 홈으로 · 칩 없음 · 오류 코드 없음', async () => {
    const view = errorView(500, '/countries/fra')
    // 칩을 넘겨도 그리지 않는다
    const w = mount(ErrorPanel, { props: { view, chips: chipSets.popular }, global: { stubs } })
    expect(w.get('h1').text()).toBe('잠시 문제가 생겼어요')
    expect(w.get('.error-panel__desc').text()).toBe(
      '잠시 뒤에 다시 시도해 주세요. 계속되면 고객센터로 알려 주세요.',
    )
    expect(links(w)).toEqual([['홈으로', '/']])
    const retry = w.get('button')
    expect(retry.text()).toBe('다시 시도')
    expect(retry.attributes('type')).toBe('button')
    await retry.trigger('click')
    expect(w.emitted('retry')).toHaveLength(1)
    expect(w.find('.error-panel__chips-wrap').exists()).toBe(false)
    expect(w.text()).not.toMatch(/\d{3}|error/i)
  })

  it('칩 데이터가 비면(색인을 못 읽음) 칩 영역만 없다 — 제목 · 버튼은 그대로', () => {
    const view = errorView(404, '/abc')
    const w = mount(ErrorPanel, { props: { view, chips: [] }, global: { stubs } })
    expect(w.find('.error-panel__chips-wrap').exists()).toBe(false)
    expect(w.get('h1').text()).toBe('찾는 페이지가 없어요')
    expect(links(w)).toEqual([
      ['나라 찾기', '/search'],
      ['홈으로', '/'],
    ])
  })

  it('검색으로 가는 주 버튼에만 돋보기 · 제목은 h1 하나', () => {
    for (const [status, path, icon] of [
      [404, '/abc', true],
      [404, '/countries/jpn', true],
      [500, '/abc', false],
    ] as const) {
      const w = render(errorView(status, path))
      expect(w.find('.error-panel__btn--primary .error-panel__btn-icon').exists(), path).toBe(icon)
      expect(w.findAll('h1')).toHaveLength(1)
    }
  })
})

describe('ErrorPanel — 구조(목업 E-1 ~ E-4)', () => {
  const upcomingViews = upcomingJson.countries.map((c) =>
    errorView(404, `/countries/${c.iso3.toLowerCase()}`),
  )
  const all: ErrorView[] = [
    errorView(404, '/abc'),
    errorView(404, '/products/xxx00'),
    errorView(500, '/abc'),
    ...upcomingViews,
  ]

  it('설명은 두 줄 — 줄바꿈 하나로 나뉜 문안 두 줄', () => {
    for (const view of all) {
      const desc = render(view).get('.error-panel__desc')
      expect(desc.findAll('br'), view.copy.title).toHaveLength(1)
      const [first, second] = desc.element.innerHTML.split(/<br\b[^>]*>/)
      expect(first!.trim()).toBe(view.copy.lines[0])
      expect(second!.trim()).toBe(view.copy.lines[1])
    }
  })

  it('점선 상자는 준비 중 나라(아시아 칩)만 — 인기 국가 칩은 상자 없이', () => {
    expect(render(errorView(404, '/abc')).find('.error-panel__chips-wrap--box').exists()).toBe(
      false,
    )
    expect(
      render(errorView(404, '/products/xxx00')).find('.error-panel__chips-wrap--box').exists(),
    ).toBe(false)
    for (const view of upcomingViews)
      expect(render(view).find('.error-panel__chips-wrap--box').exists(), view.copy.title).toBe(
        true,
      )
  })

  it('일러스트 표식 — 없는 주소 · 없는 상품은 «?» · 잠시 오류는 «!»', () => {
    const marks = (view: ErrorView) =>
      render(view)
        .findAll('.error-panel__ill .error-panel__ill-mark')
        .map((p) => p.attributes('d'))
    const question = 'M75.5 76a4.5 4.5 0 1 1 6.3 4.1c-1.1.5-1.8 1.4-1.8 2.6v.8'
    expect(marks(errorView(404, '/abc'))).toEqual([question])
    expect(marks(errorView(404, '/products/xxx00'))).toEqual([question])
    expect(marks(errorView(500, '/abc'))).toEqual(['M80 72v10'])
  })

  it('칩마다 국기(자체 호스팅 · 장식) — 인기 8 · 아시아 5', () => {
    for (const [view, n] of [
      [errorView(404, '/abc'), 8],
      [errorView(404, '/countries/jpn'), 5],
    ] as const) {
      const w = render(view)
      const chips = w.findAll('.error-panel__chip')
      expect(chips).toHaveLength(n)
      for (const chip of chips) {
        const img = chip.get('img')
        expect(img.attributes('src')).toMatch(/^\/catalog\/flags\/[A-Z]{2}\.[0-9a-f]{8}\.svg$/)
        expect(img.attributes('alt')).toBe('')
      }
    }
  })

  it('모든 갈래 · 준비 중 7개국 — 화면 글자에 상태 코드 · 오류 · 알림 약속 · 판매 종료가 없다', () => {
    for (const view of all)
      expect(render(view).text(), view.copy.title).not.toMatch(
        /\d{3}|error|not found|알림|출시되면|열리면|판매 종료|단종/i,
      )
  })
})
