/**
 * CORS 허용 origin 판정 — `server/middleware/cors.ts` 가 쓴다(테스트할 수 있게 분리).
 *
 * `esimmany.com`(판매 사이트)과 `app.esimmany.com`(게스트 발급)은 같은 배포판의 두 호스트다(Proposal K3).
 * same-origin POST 에도 브라우저가 Origin 헤더를 붙이므로, 두 호스트 모두 여기 있어야 각자의 `/api/**` 호출이 403 을 피한다.
 * `www.esimmany.com` 은 만들지 않는다(D6) — 목록에 넣지 않는다.
 */

export const STATIC_ORIGINS: readonly string[] = [
  // 웹 Nuxt dev
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  // Expo dev server (web)
  'http://localhost:8081',
  'http://localhost:19006',
  // prod (CloudFront — A-4 결과)
  'https://d3un5i1lmp1eem.cloudfront.net',
  // prod 커스텀 도메인 — 게스트 발급 호스트
  'https://app.esimmany.com',
  // prod 커스텀 도메인 — 판매 사이트 호스트 (W1-2 · K3)
  'https://esimmany.com',
]

/** Expo 네이티브 dev 의 origin 패턴 — exp:// 또는 http://192.168.x.x:8081 등 LAN IP */
export const ORIGIN_PATTERNS: readonly RegExp[] = [
  /^exp:\/\//,
  /^http:\/\/(?:\d{1,3}\.){3}\d{1,3}:(?:8081|19006|19000)$/,
]

/** 런타임 ENV `CORS_EXTRA_ORIGINS`(쉼표 구분) 해석 */
export function parseExtraOrigins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function isOriginAllowed(origin: string, extraOrigins: readonly string[]): boolean {
  if (STATIC_ORIGINS.includes(origin)) return true
  if (extraOrigins.includes(origin)) return true
  return ORIGIN_PATTERNS.some((re) => re.test(origin))
}
