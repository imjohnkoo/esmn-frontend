// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { zoneByCode } from '#shared/catalog/derive'
import { activeCatalog } from '#shared/catalog/test-data'
import type { Kind, ZoneView } from '#shared/catalog/types'
import { HOW_TO, OPERATOR_FALLBACK, OPERATOR_NOTE } from '~/content/product-detail'
import ProductSections from './ProductSections.vue'

/**
 * catalog spec S-4 · F-7 · D-4 — 상세 안내 6섹션이 고른 종류를 따르는지, 경계(6/7개국)와 대체 문구가 맞는지.
 * 지도 · 국기 · 링크는 가짜로 끼운다(자산 해석과 라우터는 이 테스트의 대상이 아니다).
 */
const cat = activeCatalog()
const stubs = {
  NuxtLink: defineComponent({
    props: { to: { type: String, default: '' } },
    setup:
      (props, { slots }) =>
      () =>
        h('a', { href: props.to }, slots.default?.()),
  }),
  ZoneMap: defineComponent({ setup: () => () => h('figure', { class: 'map-stub' }) }),
  FlagIcon: defineComponent({ setup: () => () => h('i', { class: 'flag-stub' }) }),
}

function render(zone: ZoneView, initial: Kind) {
  const kind = ref<Kind>(initial)
  const Host = defineComponent({
    setup: () => () => h(ProductSections, { zone, kind: kind.value }),
  })
  const w = mount(Host, { global: { stubs } })
  return { w, kind, text: () => w.text().replace(/\s+/g, ' ') }
}

describe('ProductSections', () => {
  it('종류를 바꾸면 FAQ · 사용일수 예시가 따라 바뀐다(종량제 화면에 무제한 문구 없음)', async () => {
    const { w, kind, text } = render(zoneByCode(cat, 'CZE00')!, 'U')
    expect(text()).toContain('다음 24시간이 시작될 때까지 512kbps 로 계속 연결돼요')
    expect(text()).toContain('3일 상품을 3월 1일 오후 3시에 처음 연결한 경우')
    kind.value = 'L'
    await nextTick()
    expect(text()).not.toMatch(/512kbps|무제한|소진\s?후/)
    expect(text()).toContain('30일 총량을 다 쓰면 사용이 끝나요')
    expect(text()).toContain('30일 상품을 3월 1일 오후 3시에 처음 연결한 경우')
    expect(text()).toContain('3월 31일 오후 3시 끝')
    w.unmount()
  })

  it('사용일수 타임라인은 모든 점에 날짜와 시각이 함께 있다', () => {
    const { w } = render(zoneByCode(cat, 'FRA00')!, 'U')
    const items = w.findAll('.sec__timeline li').map((li) => li.text().replace(/\s+/g, ' '))
    expect(items).toHaveLength(4)
    for (const t of items) expect(t).toMatch(/^3월 \d+일 오후 3시/)
    w.unmount()
  })

  it('여러 나라 — 커버리지 문구 · 자동 전환 FAQ · 6개국 이하는 나라별 카드(대표 도시 1개 · 통신사 칩 · 단서)', () => {
    const z = zoneByCode(cat, 'EU061')!
    expect(z.countries).toHaveLength(6)
    const { w, text } = render(z, 'U')
    expect(text()).toContain('6개국에서 하나의 eSIM 으로')
    expect(text()).toContain('나라를 옮겨도 같은 eSIM 을 그대로 써요')
    expect(text()).toContain('나라를 옮기면 다시 설정해야 하나요?')
    expect(w.findAll('.sec__country')).toHaveLength(6)
    expect(w.find('.sec__grid').exists()).toBe(false)
    // 나라마다 대표 도시 하나 = K1 도시 목록의 첫 값(검색용 목록이라 같은 도시의 다른 표기가 섞여 있다)
    const shown = w.findAll('.sec__country').map((li) => li.find('.sec__cities').text())
    const sorted = [...z.countries].sort((a, b) => a.nameKr.localeCompare(b.nameKr, 'ko'))
    expect(shown).toEqual(sorted.map((c) => c.cities[0]))
    expect(text()).toContain(OPERATOR_NOTE)
    w.unmount()
  })

  it('7개국부터는 나라 목록 격자(통신사 칩 없음)', () => {
    const eu = zoneByCode(cat, 'EU340')!
    const seven = { ...eu, countries: eu.countries.slice(0, 7) }
    const { w, text } = render(seven, 'U')
    expect(w.findAll('.sec__grid li')).toHaveLength(7)
    expect(w.find('.sec__countries').exists()).toBe(false)
    expect(text()).not.toContain(OPERATOR_NOTE)
    w.unmount()
  })

  it('단일국 — 소제목 «현지 통신사» · 단서 · 통신사가 미확정(null)이면 대체 문구', () => {
    const fra = zoneByCode(cat, 'FRA00')!
    const unknown = { ...fra, countries: [{ ...fra.countries[0]!, operators: null }] }
    const { w, text } = render(unknown, 'U')
    expect(w.get('.sec__sub').text()).toBe('현지 통신사')
    expect(text()).toContain(OPERATOR_NOTE)
    expect(w.findAll('.sec__op').map((o) => o.text())).toContain(OPERATOR_FALLBACK)
    expect(text()).not.toContain('나라를 옮기면 다시 설정해야 하나요?')
    w.unmount()
  })

  it('이용 방법 — 도착 안내와 요금 경고 두 줄 · 환불은 «발급 전 전액» 만 · 안내 링크', () => {
    const { w, text } = render(zoneByCode(cat, 'CZE00')!, 'U')
    for (const s of HOW_TO.steps) expect(text()).toContain(s)
    expect(w.findAll('.sec__warnings li').map((li) => li.text())).toEqual([...HOW_TO.warnings])
    expect(text()).toContain('발급 전이면 전액 환불해 드려요.')
    expect(text()).not.toMatch(/수수료|3,500|반품|발급 후/)
    expect(w.findAll('a').map((a) => a.attributes('href'))).toEqual([
      '/guide',
      '/supported-devices',
      '/refund',
    ])
    w.unmount()
  })
})
