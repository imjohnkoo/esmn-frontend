// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { countriesOf } from '#shared/catalog/derive'
import { thumbUrl, type AssetManifest } from '#shared/catalog/assets'
import { formatWon } from '#shared/catalog/format'
import { countryPageData } from '#shared/catalog/pages'
import { activeCatalog, activeRaw } from '#shared/catalog/test-data'
import manifest from '~/content/catalog-assets.json'
import ZoneCard from './ZoneCard.vue'

/**
 * catalog spec S-3 · D-11 · 불변식 2 — 국가 페이지 카드의 «N원 부터» 는 그 zone 전 옵션 K1 원본 최종가의 최솟값.
 * 기대값은 원본 JSON 에서 따로 계산한다.
 */
const cat = activeCatalog()
const raw = activeRaw()
const rawLowest = new Map<string, number>(
  raw.zones.map((z: { zone: string; products: { options: { finalWon: number }[] }[] }) => [
    z.zone,
    Math.min(...z.products.flatMap((p) => p.options.map((o) => o.finalWon))),
  ]),
)
const stubs = {
  NuxtLink: defineComponent({
    props: { to: { type: String, default: '' } },
    setup:
      (props, { slots }) =>
      () =>
        h('a', { href: props.to }, slots.default?.()),
  }),
}

describe('ZoneCard — 렌더된 최저가 = K1 원본 (실 카탈로그 · 전 국가 페이지)', () => {
  it('국가마다 카드 전부 — 가격 · 링크 · 종류 칩 · 개국 배지', () => {
    let checked = 0
    for (const c of countriesOf(cat)) {
      const d = countryPageData(cat, c.iso3)!
      for (const card of [...d.single, ...d.multi]) {
        const w = mount(ZoneCard, { props: { card }, global: { stubs } })
        expect(w.get('.zone-card__price strong').text(), `${c.iso3} ${card.zone}`).toBe(
          formatWon(rawLowest.get(card.zone)!),
        )
        expect(w.get('a').attributes('href')).toBe(`/products/${card.zone.toLowerCase()}`)
        const title = w.get('.zone-card__title').text()
        expect(title.startsWith(card.label), `${card.zone} 라벨`).toBe(true)
        expect(w.find('.zone-card__sub').exists() ? w.get('.zone-card__sub').text() : '').toBe(
          card.sub,
        )
        expect(w.get('img').attributes('src')).toBe(thumbUrl(manifest as AssetManifest, card.thumb))
        expect(w.findAll('.zone-card__kind').map((k) => k.text())).toEqual(
          card.kinds.map((k) => (k === 'U' ? '무제한' : '종량제')),
        )
        const badge = w.find('.zone-card__count')
        const wantBadge = card.countryCount > 1 && !card.label.includes('개국')
        expect(badge.exists(), `${card.zone} 배지`).toBe(wantBadge)
        if (wantBadge) expect(badge.text()).toBe(`${card.countryCount}개국`)
        checked++
        w.unmount()
      }
    }
    expect(checked).toBeGreaterThan(100)
  })
})
