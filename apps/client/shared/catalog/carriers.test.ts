import { describe, expect, it } from 'vitest'
import { countriesOf } from './derive'
import { carrierGroups } from './pages'
import { activeCatalog, activeRaw, fixtureCatalog } from './test-data'
import type { CatalogView } from './types'

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

describe('경계 — 실데이터에 없는 경우(합성)', () => {
  const country = (iso3: string, nameKr: string, operators: string[] | null, network: string | null) => ({
    iso3,
    iso2: iso3.slice(0, 2),
    nameKr,
    operators,
    network,
  })
  const synth = (countries: ReturnType<typeof country>[]) =>
    ({ zones: [{ countries }] }) as unknown as CatalogView

  it('쌍자음으로 시작하는 나라는 기본 자음 머리에 묶인다(spec S-4 — «ㄲ» 머리 없음)', () => {
    const g = carrierGroups(
      synth([
        country('AAA', '가나', ['A'], null),
        country('BBB', '까나다', ['B'], null),
        country('CCC', '따이완', ['C'], null),
        country('DDD', '빠라과', ['D'], null),
        country('EEE', '싸모아', ['E'], null),
        country('FFF', '짜드', ['F'], null),
      ]),
    )
    expect(g.map((x) => [x.head, x.rows.map((r) => r.nameKr)])).toEqual([
      ['ㄱ', ['가나', '까나다']],
      ['ㄷ', ['따이완']],
      ['ㅂ', ['빠라과']],
      ['ㅅ', ['싸모아']],
      ['ㅈ', ['짜드']],
    ])
  })

  it('빈 통신사(null) · 빈 망(null)은 그대로 넘긴다(화면이 «현지 대표 통신사» 대체 칩을 그리게)', () => {
    const [row] = carrierGroups(synth([country('AAA', '가나', null, null)]))[0]!.rows
    expect(row).toEqual({ iso3: 'AAA', iso2: 'AA', nameKr: '가나', operators: null, network: null })
  })
})
