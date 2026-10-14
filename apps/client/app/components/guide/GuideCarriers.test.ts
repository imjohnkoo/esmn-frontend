// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { carrierGroups } from '#shared/catalog/pages'
import { fixtureCatalog } from '#shared/catalog/test-data'
import { OPERATOR_FALLBACK } from '~/content/product-detail'
import GuideCarriers from './GuideCarriers.vue'

/** client-guide-check spec S-4 · D-5 — 초성 머리 · 국기 · 나라 · 통신사 칩 · 망 칩 · «(추천)» 없음 */
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

describe('GuideCarriers', () => {
  const groups = carrierGroups(fixtureCatalog())
  const w = mount(GuideCarriers, { props: { groups } })

  it('초성 머리 = 묶음 순서 · 줄 수 = 나라 수', () => {
    expect(w.findAll('.g-carriers__h').map((h) => h.text())).toEqual(groups.map((g) => g.head))
    expect(w.findAll('.g-carriers__row').length).toBe(groups.flatMap((g) => g.rows).length)
  })

  it('줄마다 국기 1 · 나라 이름 · 통신사 칩(K1 순서) · 망 칩(흐린 글자)', () => {
    const rows = groups.flatMap((g) => g.rows)
    w.findAll('.g-carriers__row').forEach((li, i) => {
      const r = rows[i]!
      expect(li.findAll('img').length, r.iso3).toBe(1)
      expect(li.find('img').attributes('width'), r.iso3).toBe('20')
      expect(norm(li.find('.g-carriers__name').text())).toBe(r.nameKr)
      const ops = li.findAll('.g-carriers__op:not(.g-carriers__op--muted)').map((o) => o.text())
      expect(ops).toEqual(r.operators ?? [OPERATOR_FALLBACK])
      const net = li.findAll('.g-carriers__op--muted').map((o) => o.text())
      expect(net).toEqual(r.network ? [r.network] : [])
    })
  })

  it('통신사가 없는 나라는 «현지 대표 통신사» 칩(상품 상세와 같은 대체 글자)', () => {
    const one = [
      { head: 'ㅍ', rows: [{ iso3: 'FRA', iso2: 'FR', nameKr: '프랑스', operators: null, network: null }] },
    ]
    const x = mount(GuideCarriers, { props: { groups: one } })
    expect(x.findAll('.g-carriers__op').map((o) => o.text())).toEqual([OPERATOR_FALLBACK])
  })

  it('«(추천)» · 링크 없음(목록은 읽기 전용)', () => {
    expect(w.text()).not.toMatch(/추천/)
    expect(w.findAll('a').length).toBe(0)
  })
})
