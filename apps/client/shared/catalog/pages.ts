/**
 * 페이지별 데이터 조각 — 페이지 전용 라우트(`server/api/catalog/*`)가 이것만 응답한다(plan §2.1 — 옵션 전체를
 * 브라우저 번들 · payload 에 싣지 않는다). 순수 함수라 테스트로 모양을 잠근다.
 */
import { lowestWon, zoneByCode, zonesOfCountry } from './derive'
import { countryMeta, type PageMeta } from './seo'
import type { CatalogView, Kind, ZoneView } from './types'

export interface ZoneCardData {
  zone: string
  to: string
  label: string
  /** 부제 — 단일국 · 5개국 이상 = 썸네일 아랫줄, 2~4개국 = 나라 이름 « · »(라벨이 이미 나라 나열이면 아랫줄) */
  sub: string
  countryCount: number
  kinds: Kind[]
  lowestWon: number
  /** 논리 경로 — 자산 매니페스트로 푼다 */
  thumb: string
}

export interface CountryPageData {
  country: { iso3: string; iso2: string; nameKr: string }
  meta: PageMeta
  single: ZoneCardData[]
  multi: ZoneCardData[]
}

/**
 * 카드 부제(S-3) — 2~4개국은 나라 나열, 단일국 · 5개국 이상은 썸네일 아랫줄.
 * 라벨이 이미 나라 나열이면(«·» 로 나눈 칸 수 = 나라 수 — «미국·캐나다» · «터키·그리스») 되풀이하지 않고 아랫줄을 쓴다.
 * 이름을 글자로 대조하지 않는다 — 라벨은 «터키» 처럼 다른 표기를 쓰기도 한다.
 */
function cardSub(z: ZoneView): string {
  const n = z.countries.length
  if (n < 2 || n > 4) return z.subtitle
  const parts = z.label.split(/[·・,]/).filter((x) => x.trim() !== '')
  const listed = parts.length === n
  return listed ? z.subtitle : z.countries.map((c) => c.nameKr).join(' · ')
}

/** 국가 페이지(spec S-3 · D-11) — 판매하지 않는 나라면 null(→ 404) */
export function countryPageData(catalog: CatalogView, iso3: string): CountryPageData | null {
  const zones = zonesOfCountry(catalog, iso3)
  const country = zones[0]?.countries.find((c) => c.iso3 === iso3)
  if (!country) return null
  const cards = zones.map(
    (z): ZoneCardData => ({
      zone: z.zone,
      to: `/products/${z.zone.toLowerCase()}`,
      label: z.label,
      sub: cardSub(z),
      countryCount: z.countries.length,
      kinds: z.products.map((p) => p.kind),
      lowestWon: lowestWon(z),
      thumb: z.products[0]!.thumb,
    }),
  )
  return {
    country: { iso3, iso2: country.iso2, nameKr: country.nameKr },
    meta: countryMeta(country.nameKr, zones),
    single: cards.filter((c) => c.countryCount === 1),
    multi: cards.filter((c) => c.countryCount > 1),
  }
}

/** 상품 상세(spec S-4) — zone 하나(옵션 ≤ 103개). 모르는 zone 이면 null(→ 404). 판매가 · 즉시할인은 화면 모델에 없다 */
export function zonePageData(catalog: CatalogView, code: string): ZoneView | null {
  return zoneByCode(catalog, code) ?? null
}
