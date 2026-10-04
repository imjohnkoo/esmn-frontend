/**
 * 카탈로그 파생값 — 화면이 쓰는 계산은 전부 여기(순수 함수 · 테스트로 잠근다).
 * 가격 문자열은 K1 최종가에서만 나온다(spec 불변식 2).
 */
import type { CatalogView, CountryView, Kind, OptionView, ProductView, ZoneView } from './types'

export function productOf(zone: ZoneView, kind: Kind): ProductView | undefined {
  return zone.products.find((p) => p.kind === kind)
}

export function kindsOf(zone: ZoneView): Kind[] {
  return zone.products.map((p) => p.kind)
}

export function optionFor(
  zone: ZoneView,
  kind: Kind,
  cap: number,
  days: number,
): OptionView | undefined {
  return productOf(zone, kind)?.options.find((o) => o.cap === cap && o.days === days)
}

/** 용량 목록 — 카드는 큰 용량부터(D-3) */
export function capsOf(product: ProductView): number[] {
  return [...new Set(product.options.map((o) => o.cap))].sort((a, b) => b - a)
}

/** 기간 목록 — 드롭다운은 짧은 기간부터 */
export function daysOf(product: ProductView): number[] {
  return [...new Set(product.options.map((o) => o.days))].sort((a, b) => a - b)
}

export function lowestWon(zone: ZoneView): number {
  return Math.min(...zone.products.flatMap((p) => p.options.map((o) => o.finalWon)))
}

/** 무제한 보조 단가 «하루 약 N원» — 내림(D-2) */
export function perDayWon(option: OptionView): number {
  return Math.floor(option.finalWon / option.days)
}

/** 종량제 보조 단가 «1GB당 약 N원» — 내림(D-2) */
export function perGbWon(option: OptionView): number {
  return Math.floor(option.finalWon / option.cap)
}

/** 구매 시트 ‹옵션명› — 스토어 옵션명 두 칸을 « · » 로 잇는다(F-8) */
export function optionLabel(option: OptionView): string {
  return `${option.name1} · ${option.name2}`
}

export function isMulti(zone: ZoneView): boolean {
  return zone.countries.length > 1
}

/** 그 나라가 들어간 zone — 단일국 먼저 → 국가 수 오름차순 → 최저가 → zone 코드(D-11) */
export function zonesOfCountry(catalog: CatalogView, iso3: string): ZoneView[] {
  return catalog.zones
    .filter((z) => z.countries.some((c) => c.iso3 === iso3))
    .sort(
      (a, b) =>
        a.countries.length - b.countries.length ||
        lowestWon(a) - lowestWon(b) ||
        a.zone.localeCompare(b.zone),
    )
}

/** 판매 중인 나라 전부(중복 없음) — 이름 가나다순 */
export function countriesOf(catalog: CatalogView): CountryView[] {
  const byIso = new Map<string, CountryView>()
  for (const z of catalog.zones)
    for (const c of z.countries) if (!byIso.has(c.iso3)) byIso.set(c.iso3, c)
  return [...byIso.values()].sort((a, b) => a.nameKr.localeCompare(b.nameKr, 'ko'))
}

export function zoneByCode(catalog: CatalogView, code: string): ZoneView | undefined {
  return catalog.zones.find((z) => z.zone === code)
}

/** 상세 기본 선택 — 무제한 · 7일 · 매일 1GB(D-16). 종량제만 있으면 가장 작은 용량 · 30일 */
export function defaultSelection(zone: ZoneView): { kind: Kind; cap: number; days: number } {
  const u = productOf(zone, 'U')
  if (u) {
    const caps = capsOf(u)
    const cap = Math.min(...caps)
    const days = daysOf(u).includes(7) ? 7 : daysOf(u)[0]!
    return { kind: 'U', cap, days }
  }
  const l = productOf(zone, 'L')!
  return { kind: 'L', cap: Math.min(...capsOf(l)), days: daysOf(l)[0]! }
}
