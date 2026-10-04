import { describe, expect, it } from 'vitest'
import { zoneByCode } from './derive'
import {
  initialSelection,
  periodOptions,
  planCards,
  purchaseSheetProps,
  selectedOption,
  selectionLabel,
  withCap,
  withDays,
  withKind,
} from './picker'
import { ACTIVE_CATALOG_FILE, activeRaw, fixtureCatalog, type RawCatalog } from './test-data'
import { parseCatalog } from './validate'

const catalog = fixtureCatalog()
const cze = zoneByCode(catalog, 'CZE00')!
const fra = zoneByCode(catalog, 'FRA00')!

describe('상세 선택기 (catalog spec D-3 · D-16 · E2E-13)', () => {
  it('기본 = 무제한 · 7일 · 매일 1GB', () => {
    expect(initialSelection(cze)).toEqual({ kind: 'U', cap: 1, days: 7 })
  })

  it('7일 카드 — 큰 용량부터, 가격 = K1 최종가, 하루 약 N원(내림)', () => {
    const cards = planCards(cze, initialSelection(cze))
    expect(cards.map((c) => [c.cap, c.option.finalWon, c.unitWon, c.selected])).toEqual([
      [3, 12700, 1814, false],
      [2, 9100, 1300, false],
      [1, 4900, 700, true],
    ])
    expect(cards.map((c) => c.option.code)).toEqual([
      'CZE00U03D07V2',
      'CZE00U02D07V2',
      'CZE00U01D07V2',
    ])
  })

  it('기간을 바꿔도 고른 용량은 유지되고 카드 가격이 그 기간 값으로 바뀐다', () => {
    const s = withDays(cze, withCap(cze, initialSelection(cze), 2), 30)
    expect(s).toEqual({ kind: 'U', cap: 2, days: 30 })
    expect(planCards(cze, s).find((c) => c.selected)!.option.code).toBe('CZE00U02D30V2')
  })

  it('드롭다운 = 무제한 1~30 · 60 · 90일(32개) / 종량제 30일 한 칸', () => {
    expect(periodOptions(cze, 'U')).toHaveLength(32)
    expect(periodOptions(cze, 'L')).toEqual([30])
  })

  it('종량제 탭 → 30일 · 가장 작은 용량, 카드 7장(총 30GB … 1GB) · 1GB당 약 N원', () => {
    const s = withKind(cze, initialSelection(cze), 'L')
    expect(s).toEqual({ kind: 'L', cap: 1, days: 30 })
    const cards = planCards(cze, withCap(cze, s, 10))
    expect(cards.map((c) => c.cap)).toEqual([30, 20, 10, 7, 5, 3, 1])
    expect(cards.find((c) => c.selected)).toMatchObject({
      cap: 10,
      unitWon: 2200,
      option: { finalWon: 22000 },
    })
  })

  it('무제한으로 돌아오면 무제한 기본값', () => {
    const s = withKind(cze, withKind(cze, initialSelection(cze), 'L'), 'U')
    expect(s).toEqual({ kind: 'U', cap: 1, days: 7 })
  })

  it('종량제가 없는 zone 에서 종량제로 바꾸려 하면 그대로', () => {
    const s = initialSelection(fra)
    expect(withKind(fra, s, 'L')).toBe(s)
  })

  it('없는 용량 · 없는 기간은 무시한다', () => {
    const s = initialSelection(cze)
    expect(withCap(cze, s, 5)).toBe(s)
    expect(withDays(cze, s, 45)).toBe(s)
  })

  it('요약 한 줄 · 고른 옵션', () => {
    const s = withCap(cze, initialSelection(cze), 2)
    expect(selectionLabel(cze, s)).toBe('체코 · 매일 2GB · 7일')
    expect(selectionLabel(cze, withKind(cze, s, 'L'))).toBe('체코 · 총 1GB · 30일')
    expect(selectedOption(cze, s)!.finalWon).toBe(9100)
  })
})

describe('선택기 경계', () => {
  it('같은 종류를 다시 고르면 선택을 그대로 둔다(용량 · 기간 유지)', () => {
    const s = withCap(cze, initialSelection(cze), 3)
    expect(withKind(cze, s, 'U')).toBe(s)
  })

  it('매일 3GB 에서 종량제로 바꾸면 30일 · 가장 작은 용량(이전 용량을 끌고 가지 않는다)', () => {
    const s = withCap(cze, initialSelection(cze), 3)
    expect(withKind(cze, s, 'L')).toEqual({ kind: 'L', cap: 1, days: 30 })
  })

  it('그 기간에 남은 용량이 여럿이면 가장 작은 것으로', () => {
    const z = structuredClone(cze)
    const u = z.products[0]!
    u.options = u.options.filter((o) => !(o.cap === 3 && o.days === 60))
    expect(withDays(z, withCap(z, initialSelection(z), 3), 60)).toEqual({
      kind: 'U',
      cap: 1,
      days: 60,
    })
  })

  it('없는 종류는 무시한다(무제한만 있는 zone 에서 종량제)', () => {
    const s = initialSelection(fra)
    expect(withKind(fra, s, 'L')).toBe(s)
  })

  it('고른 용량이 그 기간에 없으면 그 기간의 가장 작은 용량으로(검증기가 막는 경로 — 방어)', () => {
    const z = structuredClone(cze)
    const u = z.products[0]!
    u.options = u.options.filter(
      (o) => !(o.cap === 3 && o.days === 60) && !(o.cap === 1 && o.days === 60),
    )
    const s = withDays(z, withCap(z, initialSelection(z), 3), 60)
    expect(s).toEqual({ kind: 'U', cap: 2, days: 60 })
    expect(withDays(z, s, 45)).toBe(s) // 아무 용량도 없는 기간은 무시
  })
})

describe(`전 zone × 전 옵션 — 카드 가격 = K1 최종가 (spec 불변식 2 · E2E-13 · ${ACTIVE_CATALOG_FILE})`, () => {
  // 원본 JSON 과 대조한다 — 어댑터가 필드를 잘못 집어도 걸리게
  const raw = activeRaw()
  const active = parseCatalog(activeRaw())
  const rawOptions = raw.zones.flatMap((z: RawCatalog) =>
    z.products.flatMap((p: RawCatalog) =>
      p.options.map((o: RawCatalog) => ({ zone: z.zone, kind: p.kind, o })),
    ),
  )

  it('모든 옵션이 제 칸의 카드로 한 번씩 나오고 가격 · 코드가 원본과 같다', () => {
    expect(rawOptions.length).toBeGreaterThan(0)
    const seen = new Set<string>()
    for (const { zone, kind, o } of rawOptions) {
      const z = zoneByCode(active, zone)!
      const cards = planCards(z, { kind, cap: o.cap, days: o.days })
      const card = cards.find((c) => c.cap === o.cap)
      expect(card, o.code).toBeDefined()
      expect([card!.option.code, card!.option.finalWon, card!.selected]).toEqual([
        o.code,
        o.finalWon,
        true,
      ])
      expect(cards.filter((c) => c.selected)).toHaveLength(1)
      seen.add(card!.option.code)
    }
    expect(seen.size).toBe(rawOptions.length)
    if (active.fixture) expect(rawOptions).toHaveLength(494)
  })

  it('드롭다운 기간은 짧은 것부터 · 무제한은 1~30 다음 60 · 90', () => {
    for (const z of active.zones)
      for (const p of z.products) {
        const days = periodOptions(z, p.kind)
        expect(days).toEqual([...days].sort((a, b) => a - b))
        if (p.kind === 'U')
          expect(days.slice(0, 30)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1))
        else expect(days).toEqual([30])
      }
  })
})

describe(`구매 시트 값(S-5 · F-8) — K1 원본 대조 (${ACTIVE_CATALOG_FILE})`, () => {
  const raw = activeRaw()
  const active = parseCatalog(activeRaw())
  it('전 옵션(zone × 종류 × 용량 × 기간) — 가격 · 옵션명 · 링크 = K1 원본, 요약 = 라벨 · 용량 · 일수', () => {
    let checked = 0
    for (const rz of raw.zones) {
      const z = zoneByCode(active, rz.zone)!
      for (const rp of rz.products)
        for (const o of rp.options) {
          const got = purchaseSheetProps(z, { kind: rp.kind, cap: o.cap, days: o.days })
          expect(got, o.code).toEqual({
            summary: `${rz.nameKr} · ${rp.kind === 'U' ? '매일' : '총'} ${o.cap}GB · ${o.days}일`,
            price: `${o.finalWon.toLocaleString('en-US')}원`,
            optionName: `${o.optionName1} · ${o.optionName2}`,
            naverUrl: rp.naverUrl,
          })
          checked++
        }
    }
    // 건너뛴 칸 없음 — K1 meta.cellCount(검증기가 실제 칸 수와 같은지 본다)
    expect(checked).toBe(raw.meta.cellCount)
    expect(checked).toBeGreaterThan(7000)
  })

  it('없는 칸(용량 · 기간)은 null — 시트를 그리지 않는다', () => {
    expect(purchaseSheetProps(cze, { kind: 'U', cap: 9, days: 7 })).toBeNull()
    expect(purchaseSheetProps(fra, { kind: 'L', cap: 1, days: 30 })).toBeNull()
  })
})
