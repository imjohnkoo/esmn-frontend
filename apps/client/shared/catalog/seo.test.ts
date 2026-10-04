import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { isNoindexPath } from '../utils/robots'
import { countriesOf, zoneByCode, zonesOfCountry } from './derive'
import {
  HOME_META,
  STATIC_DESCRIPTIONS,
  STATIC_ROUTES,
  buildSitemapXml,
  canonicalUrl,
  catalogRoutes,
  countryMeta,
  prerenderRoutes,
  sitemapPaths,
  zoneMeta,
} from './seo'
import { bannedIn } from './test-copy'
import { activeCatalog, fixtureCatalog, fixtureRaw, setFinalWon } from './test-data'
import { parseCatalog } from './validate'

const catalog = fixtureCatalog()

describe('정적 페이지 목록 (spec S-6)', () => {
  it('법정 3종 · 가이드 · 지원 기기 — spec 이 정한 다섯 경로(사업자정보 페이지는 없다 — client-shell D-39)', () => {
    expect([...STATIC_ROUTES].sort()).toEqual(
      ['/guide', '/privacy', '/refund', '/supported-devices', '/terms'].sort(),
    )
  })
})

describe('정적 페이지 결선 — 각 페이지가 자기 경로의 설명으로 useCatalogSeo 를 부른다 · html lang(머지에서 한쪽만 고르면 빠지는 자리)', () => {
  const page = (f: string) => readFileSync(new URL(`../../app/pages/${f}`, import.meta.url), 'utf8')
  it.each([
    ['terms.vue', '/terms'],
    ['privacy.vue', '/privacy'],
    ['refund.vue', '/refund'],
    ['supported-devices.vue', '/supported-devices'],
    ['guide/index.vue', '/guide'],
  ] as const)('%s → useCatalogSeo(설명 = STATIC_DESCRIPTIONS[%s]) 한 번', (f, route) => {
    const src = page(f)
    const calls = src.match(/useCatalogSeo\(\{[^}]*\}\)/g) ?? []
    expect(calls).toHaveLength(1)
    expect(calls[0]).toContain(`description: STATIC_DESCRIPTIONS['${route}']`)
    expect(STATIC_ROUTES as readonly string[]).toContain(route)
  })
  it('정적 경로마다 페이지가 있다 · app.vue 가 html lang="ko"', () => {
    expect([...STATIC_ROUTES].sort()).toEqual(['/guide', '/privacy', '/refund', '/supported-devices', '/terms'])
    expect(readFileSync(new URL('../../app/app.vue', import.meta.url), 'utf8')).toMatch(/htmlAttrs: \{ lang: 'ko' \}/)
  })
})

describe('프리렌더 · sitemap (catalog spec F-9 · E2E-15)', () => {
  it('프리렌더 = 홈 · 검색 · 국가 전수 · 상품 전수 · 정적 6 — 전부 소문자 · 중복 없음', () => {
    const routes = prerenderRoutes(catalog)
    expect(routes).toHaveLength(
      2 + countriesOf(catalog).length + catalog.zones.length + STATIC_ROUTES.length,
    )
    expect(new Set(routes).size).toBe(routes.length)
    for (const r of routes) expect(r).toBe(r.toLowerCase())
    expect(routes).toContain('/countries/fra')
    expect(routes).toContain('/products/eu340')
  })

  it('sitemap = 프리렌더 − noindex — /search 는 프리렌더하지만 sitemap 에는 없다', () => {
    const paths = sitemapPaths(catalog)
    expect(prerenderRoutes(catalog)).toContain('/search')
    expect(isNoindexPath('/search')).toBe(true)
    expect(paths).not.toContain('/search')
    for (const p of paths) {
      expect(isNoindexPath(p), p).toBe(false)
      expect(p).not.toMatch(/^\/(verify|details|select-date|view|my|checkout-preview)/)
    }
    expect(paths).toEqual(['/', ...catalogRoutes(catalog), ...STATIC_ROUTES])
  })

  it('정적 페이지는 전부 설명이 있다(canonical 과 함께 — sitemap URL 에 빈 메타 없음)', () => {
    expect(Object.keys(STATIC_DESCRIPTIONS).sort()).toEqual([...STATIC_ROUTES].sort())
    for (const d of Object.values(STATIC_DESCRIPTIONS)) expect(d.length).toBeGreaterThan(10)
    expect(STATIC_DESCRIPTIONS['/refund']).not.toMatch(/수수료|3,500|반품|불가|발급 후/)
  })

  it('sitemap XML — 판매 사이트 주소 · lastmod = 카탈로그 생성일', () => {
    const xml = buildSitemapXml(['/', '/countries/fra'], '2026-09-23T00:00:00+09:00')
    expect(xml).toContain('<loc>https://esimmany.com/</loc><lastmod>2026-09-23</lastmod>')
    expect(xml).toContain('<loc>https://esimmany.com/countries/fra</loc>')
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
  })

  it('canonical 은 빌드 상수 https://esimmany.com + 경로(끝 / 제거)', () => {
    expect(canonicalUrl('/')).toBe('https://esimmany.com/')
    expect(canonicalUrl('/countries/fra/')).toBe('https://esimmany.com/countries/fra')
  })
})

describe('메타 문구 (D-15)', () => {
  it('국가 — «{나라} eSIM · 무제한 데이터 {최저가}부터»', () => {
    const m = countryMeta('프랑스', zonesOfCountry(catalog, 'FRA'))
    expect(m.title).toBe('프랑스 eSIM · 무제한 데이터 900원부터')
    expect(m.description).toContain('상품 2개')
  })

  it('«무제한 데이터» 뒤에는 무제한 최저가만 — 종량제가 더 싸도 그 값을 붙이지 않는다', () => {
    const raw = fixtureRaw()
    setFinalWon(raw, 'CZE00L01D30V2', 300)
    const cat = parseCatalog(raw)
    expect(countryMeta('체코', zonesOfCountry(cat, 'CZE')).title).toBe(
      '체코 eSIM · 무제한 데이터 900원부터',
    )
  })

  it('무제한 상품이 없는 나라는 «무제한 데이터» 없이 전체 최저가', () => {
    const cze = structuredClone(zoneByCode(catalog, 'CZE00')!)
    cze.products = cze.products.filter((p) => p.kind === 'L')
    expect(countryMeta('체코', [cze]).title).toBe('체코 eSIM · 4,500원부터')
  })

  it('상품 — «{라벨} eSIM — 무제한 · 종량제», 여러 나라면 자동 연결', () => {
    expect(zoneMeta(zoneByCode(catalog, 'CZE00')!).title).toBe('체코 eSIM — 무제한 · 종량제')
    expect(zoneMeta(zoneByCode(catalog, 'FRA00')!).title).toBe('프랑스 eSIM — 무제한')
    expect(zoneMeta(zoneByCode(catalog, 'EU340')!).description).toContain('34개국에서 하나의 eSIM')
  })

  it('실 카탈로그 — 상품 설명마다 24시간 단위 · 여러 나라면 자동 연결 + 아랫줄 · 설명이 겹치지 않는다', () => {
    const active = activeCatalog()
    const seen = new Map<string, string>()
    for (const z of active.zones) {
      const d = zoneMeta(z).description
      expect(d, z.zone).toContain('처음 연결된 때부터 24시간 단위')
      expect(d.includes('나라를 옮겨도 자동으로 연결돼요'), z.zone).toBe(z.countries.length > 1)
      if (z.countries.length > 1 && z.subtitle) expect(d, z.zone).toContain(z.subtitle)
      expect(seen.get(d), `${z.zone} 설명이 ${seen.get(d)} 와 같다`).toBeUndefined()
      seen.set(d, z.zone)
    }
    expect(HOME_META.description).toContain('처음 연결된 때부터 24시간 단위')
  })

  it('메타 문구도 카피 불변식을 지킨다', () => {
    const all = [
      HOME_META.title,
      HOME_META.description,
      ...Object.values(STATIC_DESCRIPTIONS),
      ...activeCatalog().zones.flatMap((z) => Object.values(zoneMeta(z))),
      ...countriesOf(activeCatalog()).flatMap((c) =>
        Object.values(countryMeta(c.nameKr, zonesOfCountry(activeCatalog(), c.iso3))),
      ),
    ].join('\n')
    expect(bannedIn(all)).toEqual([]) // 상세 문안과 같은 금지어 목록
    expect(all).toContain('처음 연결된 때부터 24시간 단위')
  })
})
