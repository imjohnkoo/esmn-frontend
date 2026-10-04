/**
 * SSR · SEO(catalog spec F-9 · S-6 · D-15 · D-17) — 프리렌더 라우트 목록 · sitemap · 메타를 카탈로그에서 만든다.
 * canonical · og:url 은 빌드 상수 `https://esimmany.com`(호스트 판정 0 — app.esimmany.com 에서 떠도 canonical 은 판매 사이트).
 * 와일드카드 routeRules 는 페이지를 생성하지 않으므로 라우트를 **명시**한다(조사 확인).
 */
import { isNoindexPath } from '../utils/robots'
import { SITE_ORIGIN } from '../utils/site'
import { countriesOf, lowestWon, productOf } from './derive'
import { formatWon } from './format'
import type { CatalogView, ZoneView } from './types'

export { SITE_ORIGIN }

/** 카탈로그와 무관한 정적 페이지 — 법정 3종(사업자정보 페이지는 없다 — client-shell D-39) · 가이드 · 지원 기기 */
export const STATIC_ROUTES = [
  '/terms',
  '/privacy',
  '/refund',
  '/guide',
  '/supported-devices',
] as const

export function catalogRoutes(catalog: CatalogView): string[] {
  return [
    ...countriesOf(catalog).map((c) => `/countries/${c.iso3.toLowerCase()}`),
    ...catalog.zones.map((z) => `/products/${z.zone.toLowerCase()}`),
  ]
}

/** nitro.prerender.routes — 홈 · 검색(noindex 지만 payload 를 고정한다) · 카탈로그 · 정적 */
export function prerenderRoutes(catalog: CatalogView): string[] {
  return ['/', '/search', ...catalogRoutes(catalog), ...STATIC_ROUTES]
}

/** sitemap = 프리렌더한 페이지 − noindex(`/search` 등 — noindex 목록 단일 출처로 거른다) */
export function sitemapPaths(catalog: CatalogView): string[] {
  return prerenderRoutes(catalog).filter((p) => !isNoindexPath(p))
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildSitemapXml(paths: string[], lastmod: string): string {
  const day = lastmod.slice(0, 10)
  const urls = paths
    .map((p) => `  <url><loc>${xmlEscape(SITE_ORIGIN + p)}</loc><lastmod>${day}</lastmod></url>`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export function canonicalUrl(path: string): string {
  return SITE_ORIGIN + (path === '/' ? '/' : path.replace(/\/+$/, ''))
}

export interface PageMeta {
  title: string
  description: string
}

/**
 * 국가 페이지 — «{나라} eSIM · 무제한 데이터 {무제한 최저가}부터»(제목 템플릿이 « · 이심마니» 를 붙인다).
 * «무제한 데이터» 뒤에는 무제한 옵션의 최저가만 쓴다(종량제가 더 싸도 그 값을 붙이지 않는다). 무제한이 없으면 전체 최저가.
 */
export function countryMeta(nameKr: string, zones: ZoneView[]): PageMeta {
  const unlimited = zones.flatMap((z) => productOf(z, 'U')?.options ?? []).map((o) => o.finalWon)
  const low = unlimited.length ? Math.min(...unlimited) : Math.min(...zones.map(lowestWon))
  return {
    title: `${nameKr} eSIM · ${unlimited.length ? '무제한 데이터 ' : ''}${formatWon(low)}부터`,
    description:
      `${nameKr}에서 쓰는 eSIM 상품 ${zones.length}개. 사용일수는 현지에서 처음 연결된 때부터 24시간 단위로 세요. ` +
      '테더링 가능 · 보통 1~2분 안에 카카오톡으로 발급 링크를 보내 드려요.',
  }
}

/** 상품 상세 — «{라벨} eSIM — 무제한 · 종량제» */
export function zoneMeta(zone: ZoneView): PageMeta {
  const kinds = zone.products.map((p) => (p.kind === 'U' ? '무제한' : '종량제')).join(' · ')
  const multi = zone.countries.length > 1
  return {
    title: `${zone.label} eSIM — ${kinds}`,
    description:
      `${zone.label} eSIM ${formatWon(lowestWon(zone))}부터. ` +
      // 여러 나라면 썸네일 아랫줄을 넣는다 — 같은 라벨 zone(«발칸 5개국» 둘)의 설명이 겹치지 않게(S-6)
      (multi
        ? `${zone.subtitle ? `${zone.subtitle} — ` : ''}${zone.countries.length}개국에서 하나의 eSIM 으로, 나라를 옮겨도 자동으로 연결돼요. `
        : '') +
      '사용일수는 처음 연결된 때부터 24시간 단위 · 테더링 가능.',
  }
}

/** 정적 페이지 설명 — canonical 과 함께 넣는다(sitemap 에 든 URL 은 전부 canonical · description 이 있다) */
export const STATIC_DESCRIPTIONS: Record<(typeof STATIC_ROUTES)[number], string> = {
  '/terms': '이심마니 해외여행 eSIM 서비스 이용약관이에요.',
  '/privacy': '이심마니가 주문 · 발급에 쓰는 개인정보와 보관 기간을 안내해요.',
  '/refund': '발급 전이면 전액 환불해 드려요. 신청 방법과 처리 기한을 안내해요.',
  '/guide': 'eSIM 설치 가이드와 지원 기기 확인으로 가는 길을 모아 두었어요.',
  '/supported-devices': 'eSIM 을 쓸 수 있는 아이폰 · 갤럭시 기종을 확인해 보세요.',
}

export const HOME_META: PageMeta = {
  title: '해외여행 eSIM',
  description:
    '가는 나라를 고르고 용량 · 기간별 가격을 비교해 보세요. 사용일수는 현지에서 처음 연결된 때부터 24시간 단위 · 테더링 가능.',
}
