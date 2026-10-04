// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { daysOf } from '#shared/catalog/derive'
import { formatWon } from '#shared/catalog/format'
import { planCards } from '#shared/catalog/picker'
import { activeCatalog, activeRaw } from '#shared/catalog/test-data'
import PlanCards from './PlanCards.vue'

/**
 * catalog spec 불변식 2 · D-2 · D-3 · E2E-13 — 화면에 그려진 카드 가격은 K1 원본의 최종가 그대로, 보조 단가는 내림.
 * 기대값은 화면 모델이 아니라 원본 JSON 에서 따로 읽는다(어댑터 · 선택기 · 컴포넌트 어디서 가격을 바꿔도 걸리게).
 */
const cat = activeCatalog()
const raw = activeRaw()
const rawFinal = new Map<string, number>()
for (const z of raw.zones)
  for (const p of z.products)
    for (const o of p.options) rawFinal.set(`${p.sku}/${o.cap}/${o.days}`, o.finalWon)

describe('PlanCards — 렌더된 가격 = K1 원본 최종가 (실 카탈로그)', () => {
  it('전 zone × 종류 × 대표 기간(1 · 7 · 30 · 60 · 90일 / 종량제 30일)', () => {
    let checked = 0
    for (const z of cat.zones)
      for (const p of z.products) {
        const periods =
          p.kind === 'U' ? [1, 7, 30, 60, 90].filter((d) => daysOf(p).includes(d)) : [30]
        for (const days of periods) {
          const cards = planCards(z, { kind: p.kind, cap: 1, days })
          const w = mount(PlanCards, {
            props: {
              name: 'cap',
              kind: p.kind,
              cards,
              labelledby: 'cap-label',
              modelValue: cards[0]!.cap,
            },
          })
          // 기대 문구는 문안 함수를 쓰지 않고 따로 조립한다(제목 · 가격 · 단가가 제 카드에 붙었는지까지)
          const expected = cards.map((c) => {
            const won = rawFinal.get(`${p.sku}/${c.cap}/${days}`)!
            const unit = formatWon(Math.floor(won / (p.kind === 'U' ? days : c.cap)))
            return {
              title: p.kind === 'U' ? `매일 ${c.cap}GB` : `총 ${c.cap}GB`,
              price: formatWon(won),
              sub:
                p.kind === 'U'
                  ? `다 쓰면 512kbps 로 계속 · 하루 약 ${unit}`
                  : `30일 동안 나눠 쓰기 · 1GB당 약 ${unit}`,
            }
          })
          const shown = w.findAll('.plan-card').map((card) => ({
            title: card.get('.plan-card__title').text(),
            price: card.get('.plan-card__price').text(),
            sub: card.get('.plan-card__sub').text(),
          }))
          expect(shown, `${p.sku} ${days}일`).toEqual(expected)
          checked += cards.length
          w.unmount()
        }
      }
    expect(checked).toBeGreaterThan(1000)
  })

  it('고른 용량만 선택 · 다른 카드를 누르면 그 용량으로', async () => {
    const z = cat.zones.find((x) => x.zone === 'CZE00')!
    const cards = planCards(z, { kind: 'U', cap: 1, days: 7 })
    const updates: number[] = []
    const w = mount(PlanCards, {
      props: {
        name: 'cap',
        kind: 'U',
        cards,
        labelledby: 'cap-label',
        modelValue: 1,
        'onUpdate:modelValue': (v: number) => updates.push(v),
      },
    })
    const radios = w.findAll('input[type="radio"]')
    expect(radios.map((r) => (r.element as HTMLInputElement).checked)).toEqual([false, false, true])
    await radios[0]!.setValue(true)
    expect(updates.at(-1)).toBe(3)
    w.unmount()
  })
})
