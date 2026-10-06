import { describe, expect, it } from 'vitest'
import {
  NOINDEX_CRAWL_ROUTES,
  NOINDEX_ROUTES,
  NO_STORE_ROUTES,
  buildRobotsRouteRules,
  buildRobotsTxt,
  isNoindexPath,
  robotsDisallowPrefixes,
} from './robots'

describe('isNoindexPath', () => {
  it.each([
    '/verify/2026092312345678',
    '/details/2026092312345678',
    '/select-date/2026092312345678',
    '/view/2026092312345678',
    '/view/1?reason=reverify',
    '/my',
    '/my/',
    '/my/orders',
    '/my-esim',
    '/checkout-preview',
    '/checkout-preview?paymentId=pv-1&code=FAILURE',
    '/search',
    '/search?q=fr',
    '/install-guide/ios',
    '/install-guide/android',
    '/install-guide',
  ])('%s 는 noindex', (path) => {
    expect(isNoindexPath(path)).toBe(true)
  })

  it.each([
    '/',
    '/terms',
    '/privacy',
    '/refund',
    '/guide',
    '/guide/ios',
    '/guide/android',
    '/supported-devices',
    '/countries/fra',
    '/products/cze00',
    '/myanmar',
    '/verifyx',
  ])('%s 는 색인 허용', (path) => {
    expect(isNoindexPath(path)).toBe(false)
  })
})

describe('buildRobotsRouteRules', () => {
  const rules = buildRobotsRouteRules()

  it('noindex 경로마다 X-Robots-Tag 를 건다', () => {
    for (const pattern of [...NOINDEX_ROUTES, ...NOINDEX_CRAWL_ROUTES]) {
      expect(rules[pattern]?.headers['X-Robots-Tag']).toBe('noindex, nofollow')
    }
    expect(Object.keys(rules)).toHaveLength(NOINDEX_ROUTES.length + NOINDEX_CRAWL_ROUTES.length)
  })

  it('4-step 경로만 no-store — 나머지 noindex 경로는 캐시 헤더를 건드리지 않는다', () => {
    for (const pattern of NOINDEX_ROUTES) {
      const expected = (NO_STORE_ROUTES as readonly string[]).includes(pattern)
        ? 'no-store'
        : undefined
      expect(rules[pattern]?.headers['Cache-Control']).toBe(expected)
    }
  })

  it('4-step 4경로는 정확히 no-store (spec 불변식 — 목록에서 빠지면 실패)', () => {
    for (const pattern of ['/verify/**', '/details/**', '/select-date/**', '/view/**']) {
      expect(rules[pattern]?.headers).toEqual({
        'X-Robots-Tag': 'noindex, nofollow',
        'Cache-Control': 'no-store',
      })
    }
    for (const pattern of ['/my', '/my/**', '/my-esim', '/checkout-preview', '/search']) {
      expect(rules[pattern]?.headers).toEqual({ 'X-Robots-Tag': 'noindex, nofollow' })
    }
  })

  it('no-store 경로는 모두 noindex 목록 안에 있다', () => {
    for (const pattern of NO_STORE_ROUTES) {
      expect(NOINDEX_ROUTES).toContain(pattern)
    }
  })
})

describe('robots.txt', () => {
  it('Disallow 는 접두가 겹치지 않는 7줄', () => {
    expect(robotsDisallowPrefixes()).toEqual([
      '/verify/',
      '/details/',
      '/select-date/',
      '/view/',
      '/my',
      '/checkout-preview',
      '/search',
    ])
  })

  it('모든 noindex 경로가 어떤 Disallow 접두에 덮인다', () => {
    const prefixes = robotsDisallowPrefixes()
    const samples = [
      '/verify/1',
      '/details/1',
      '/select-date/1',
      '/view/1',
      '/my',
      '/my/x',
      '/my-esim',
      '/checkout-preview',
      '/search',
    ]
    for (const path of samples) {
      expect(prefixes.some((prefix) => path.startsWith(prefix))).toBe(true)
    }
  })

  it('본문 형식', () => {
    const txt = buildRobotsTxt()
    expect(txt).toContain('User-agent: *\n')
    expect(txt.match(/^Disallow: /gm)).toHaveLength(7)
    expect(txt).toContain('\nSitemap: https://esimmany.com/sitemap.xml\n')
    expect(txt.endsWith('\n')).toBe(true)
  })

  it('가이드 전용판은 noindex(meta · X-Robots-Tag)이지만 robots.txt 로 막지 않는다 — 크롤러가 noindex · canonical 을 읽게(client-guide D-16)', () => {
    expect([...NOINDEX_CRAWL_ROUTES]).toEqual(['/install-guide/**'])
    expect(isNoindexPath('/install-guide/ios')).toBe(true)
    expect(buildRobotsRouteRules()['/install-guide/**']).toEqual({
      headers: { 'X-Robots-Tag': 'noindex, nofollow' },
    })
    expect(robotsDisallowPrefixes().some((p) => '/install-guide/ios'.startsWith(p))).toBe(false)
    expect(buildRobotsTxt()).not.toContain('install-guide')
    // 4-step 처럼 캐시 금지는 아니다(정적 글)
    expect(buildRobotsRouteRules()['/install-guide/**']!.headers['Cache-Control']).toBeUndefined()
  })
})
