/**
 * 홈 «인기국가 · 다국가» 격자 해석 — spec D-5. 목록(`app/content/popular.ts`)의 코드를 카탈로그로 푼다.
 * 목록에 있는데 카탈로그에 없으면 `missing` 에 적는다 — 서버 라우트가 실 카탈로그에서는 500 을 던지고
 * 홈 페이지가 그 에러를 페이지 500 으로 다시 던져 프리렌더(빌드)가 멈춘다. 표본 픽스처(5 zone)에서는 건너뛴다.
 */
import { zoneByCode } from './derive'
import type { CatalogView, ZoneView } from './types'

export interface HomeTile {
  to: string
  /** 국기 — 인기국가 1개, 다국가는 앞 3개 */
  iso2s: string[]
  label: string
  /** 칸 라벨 — 무제한 상품이 있으면 «무제한», 종량제만 있으면 «종량제»(가격은 싣지 않는다) */
  badge: '무제한' | '종량제'
}

function badgeOf(zone: ZoneView): HomeTile['badge'] {
  return zone.products.some((p) => p.kind === 'U') ? '무제한' : '종량제'
}

export function resolveHome(
  catalog: CatalogView,
  countries: readonly string[],
  zones: readonly string[],
): { popular: HomeTile[]; multi: HomeTile[]; missing: string[] } {
  const missing: string[] = []
  const popular: HomeTile[] = []
  for (const iso3 of countries) {
    const zone = zoneByCode(catalog, `${iso3}00`)
    if (!zone || zone.countries.length !== 1) {
      missing.push(`인기국가 ${iso3}(단일국 zone ${iso3}00 없음)`)
      continue
    }
    // zone 코드와 나라가 어긋나면(«CZE00» 에 프랑스) 엉뚱한 국기 · 국가 페이지 칸이 생긴다
    if (zone.countries[0]!.iso3 !== iso3) {
      missing.push(`인기국가 ${iso3}(zone ${iso3}00 의 나라가 ${zone.countries[0]!.iso3})`)
      continue
    }
    popular.push({
      to: `/countries/${iso3.toLowerCase()}`,
      iso2s: [zone.countries[0]!.iso2],
      label: zone.label,
      badge: badgeOf(zone),
    })
  }
  const multi: HomeTile[] = []
  for (const code of zones) {
    const zone = zoneByCode(catalog, code)
    if (!zone || zone.countries.length < 2) {
      missing.push(`다국가 ${code}(여러 나라 zone 없음)`)
      continue
    }
    multi.push({
      to: `/products/${code.toLowerCase()}`,
      iso2s: zone.countries.slice(0, 3).map((c) => c.iso2),
      label: zone.label,
      badge: badgeOf(zone),
    })
  }
  return { popular, multi, missing }
}
