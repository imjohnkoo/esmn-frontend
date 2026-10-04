/**
 * 검색 노출 제외(noindex) 목록 — 단일 출처.
 *
 * 이 목록 하나에서 세 출력을 만든다. 따로 적으면 셋이 어긋난다.
 *  1. `<meta name="robots">` — `app.vue` 가 `isNoindexPath(route.path)` 로 판정
 *  2. `X-Robots-Tag` 응답 헤더 — `nuxt.config.ts` 의 `routeRules` (`buildRobotsRouteRules`)
 *  3. `/robots.txt` Disallow — `server/routes/robots.txt.ts` (`buildRobotsTxt`)
 *
 * 게스트 발급 4-step 은 SSR 복원 시 HTML 페이로드에 주문 정보가 실리므로 `Cache-Control: no-store` 를
 * 함께 건다 — CloudFront 캐시 도입(K4) 뒤에도 공유 캐시가 잡으면 안 된다(Proposal P9-16).
 */

import { SITE_ORIGIN } from './site'

/** 패턴 문법: 정확히 일치하는 경로 또는 `/<prefix>/**`(그 경로 자체 + 하위 전부) */
export const NOINDEX_ROUTES = [
  '/verify/**',
  '/details/**',
  '/select-date/**',
  '/view/**',
  '/my',
  '/my/**',
  '/my-esim',
  '/checkout-preview',
  // 국가 검색 — 입력으로 그리는 얇은 페이지(catalog spec D-12). 국가 · 상품 페이지가 색인 대상이다
  '/search',
] as const

/** noindex 중에서 응답 캐시까지 금지할 경로 — 고객 주문 정보를 렌더하는 4-step */
export const NO_STORE_ROUTES = ['/verify/**', '/details/**', '/select-date/**', '/view/**'] as const

const ROBOTS_VALUE = 'noindex, nofollow'

function normalizePath(path: string): string {
  const bare = path.split(/[?#]/)[0] || '/'
  return bare.length > 1 && bare.endsWith('/') ? bare.replace(/\/+$/, '') : bare
}

function matchesRoute(pattern: string, path: string): boolean {
  const target = normalizePath(path)
  if (pattern.endsWith('/**')) {
    const base = pattern.slice(0, -3)
    return target === base || target.startsWith(`${base}/`)
  }
  return target === pattern
}

export function isNoindexPath(path: string): boolean {
  return NOINDEX_ROUTES.some((pattern) => matchesRoute(pattern, path))
}

export function buildRobotsRouteRules(): Record<string, { headers: Record<string, string> }> {
  const rules: Record<string, { headers: Record<string, string> }> = {}
  for (const pattern of NOINDEX_ROUTES) {
    rules[pattern] = { headers: { 'X-Robots-Tag': ROBOTS_VALUE } }
  }
  for (const pattern of NO_STORE_ROUTES) {
    const rule = rules[pattern] ?? { headers: {} }
    rule.headers['Cache-Control'] = 'no-store'
    rules[pattern] = rule
  }
  return rules
}

/**
 * robots.txt Disallow 는 접두 일치다. `/x/**` → `/x/`, 정확 경로 `/x` → `/x` 로 바꾼 뒤
 * 더 짧은 접두에 이미 덮이는 줄은 뺀다 — `/my` 가 `/my/` · `/my-esim` 을 덮는다.
 * ⚠️ 그래서 `/my` 로 시작하는 공개 경로를 새로 만들면 함께 막힌다(목록을 먼저 고칠 것).
 */
export function robotsDisallowPrefixes(): string[] {
  const prefixes = NOINDEX_ROUTES.map((pattern) =>
    pattern.endsWith('/**') ? `${pattern.slice(0, -3)}/` : pattern,
  )
  return prefixes.filter(
    (prefix, i) =>
      prefixes.indexOf(prefix) === i &&
      !prefixes.some((other) => other !== prefix && prefix.startsWith(other)),
  )
}

export function buildRobotsTxt(): string {
  const lines = [
    '# 생성물 — apps/client/shared/utils/robots.ts (noindex 목록과 같은 출처)',
    'User-agent: *',
    ...robotsDisallowPrefixes().map((prefix) => `Disallow: ${prefix}`),
    '',
    `Sitemap: ${SITE_ORIGIN}/sitemap.xml`,
  ]
  return `${lines.join('\n')}\n`
}
