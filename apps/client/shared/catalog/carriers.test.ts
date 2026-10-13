import { describe, expect, it } from 'vitest'
import { countriesOf } from './derive'
import { carrierGroups } from './pages'
import { activeCatalog, activeRaw, fixtureCatalog } from './test-data'

/** client-guide-check spec F-4 · S-4 · D-5 · D-15 · DoD 4 · E2E 7 — 나라별 현지 통신사 = 판매 중인 나라 전부 · K1 값 그대로 */
describe.each([
  ['표본', fixtureCatalog],
  ['지금 빌드 카탈로그', activeCatalog],
] as const)('%s', (_name, load) => {
  const catalog = load()
  const groups = carrierGroups(catalog)
  const rows = groups.flatMap((g) => g.rows)

  it('줄 = 판매 중인 나라(iso3 중복 제거) — 가나다 순 그대로', () => {
    expect(rows.map((r) => r.iso3)).toEqual(countriesOf(catalog).map((c) => c.iso3))
    expect(new Set(rows.map((r) => r.iso3)).size).toBe(rows.length)
  })

  it('초성 머리 — 기본 자음(쌍자음 없음) · 이웃 묶음끼리 다르다 · 줄의 첫 글자 초성과 같다', () => {
    const CHO = 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'
    for (const g of groups) expect(CHO).toContain(g.head)
    for (let i = 1; i < groups.length; i++) expect(groups[i]!.head).not.toBe(groups[i - 1]!.head)
    const PLAIN: Record<string, string> = { ㄲ: 'ㄱ', ㄸ: 'ㄷ', ㅃ: 'ㅂ', ㅆ: 'ㅅ', ㅉ: 'ㅈ' }
    const choOf = (s: string) => {
      const c = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'[Math.floor((s.charCodeAt(0) - 0xac00) / 588)]!
      return PLAIN[c] ?? c
    }
    for (const g of groups) for (const r of g.rows) expect(choOf(r.nameKr), r.nameKr).toBe(g.head)
  })

  it('나라마다 통신사 · 망 = K1 의 그 나라 값(모든 zone 에서 같다 — 검증기 D-15)', () => {
    for (const r of rows) {
      const seen = catalog.zones.flatMap((z) => z.countries.filter((c) => c.iso3 === r.iso3))
      expect(seen.length, r.iso3).toBeGreaterThan(0)
      for (const c of seen) {
        expect(c.operators, r.iso3).toEqual(r.operators)
        expect(c.network, r.iso3).toBe(r.network)
      }
    }
  })

  it('줄에는 나라 · 통신사 · 망만(도시 · 상품 없음 — payload)', () => {
    for (const r of rows)
      expect(Object.keys(r).sort()).toEqual(['iso2', 'iso3', 'nameKr', 'network', 'operators'])
  })
})

describe('지금 빌드 카탈로그 원본(K1) 대조 — E2E 7', () => {
  it('줄 수 = catalog.json 나라 iso3 중복 제거 수 · 통신사 칩 = K1 operators 순서 그대로', () => {
    const raw = activeRaw()
    const byIso = new Map<string, { operators: string[] | null; network: string | null }>()
    for (const z of raw.zones) for (const c of z.countries) if (!byIso.has(c.iso3)) byIso.set(c.iso3, c)
    const rows = carrierGroups(activeCatalog()).flatMap((g) => g.rows)
    expect(rows.length).toBe(byIso.size)
    for (const r of rows) {
      const k = byIso.get(r.iso3)!
      expect(r.operators, r.iso3).toEqual(k.operators && k.operators.length > 0 ? k.operators : null)
      expect(r.network, r.iso3).toBe(k.network)
    }
  })
})
