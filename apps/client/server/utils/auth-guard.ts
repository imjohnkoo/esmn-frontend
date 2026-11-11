import { timingSafeEqual } from 'node:crypto'
import { createError, getRequestHeader, type H3Event } from 'h3'
import { SITE_ORIGIN } from '../../shared/utils/site'
import { parseExtraOrigins } from './cors-origins'
import { logEvent } from './issuance-log'

// 요청 경계의 판정 둘(spec F-14 · F-16 · I-7 · I-11)

/** 쿠키로 로그인 상태를 바꾸는 요청을 받아도 되는 출처 — 사이트 두 호스트 + walk · 환경 추가분(CORS_EXTRA_ORIGINS).
 *  CORS 목록(cors-origins.ts)을 쓰지 않는다 — 그 목록의 Expo LAN 패턴(`http://<IP>:8081`)은 공인 IP 도 통과시켜 로그인 CSRF 가 된다.
 *  개발 서버(localhost:3000)는 production 이 아닐 때만 */
export function siteOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const dev =
    env.NODE_ENV !== 'production' ? ['http://localhost:3000', 'http://127.0.0.1:3000'] : []
  return [
    SITE_ORIGIN,
    'https://app.esimmany.com',
    ...dev,
    ...parseExtraOrigins(env.CORS_EXTRA_ORIGINS),
  ]
}

/**
 * 쿠키 경로의 상태 변경 요청(spec F-16 · I-7) — ① 사이트 출처의 Origin 필수(헤더 없음 = 거부) ② 본문은 JSON 만
 * (교차 출처 폼 · text/plain 은 preflight 없이 오지만 JSON 은 preflight 가 CORS 에 막힌다). SameSite=Lax 가 세 번째 층.
 * Bearer 면제 없음(spec F-16) — A2 는 앱 토큰을 발급하지 않는다. Bearer 헤더를 붙이면 LAN 패턴 출처의 preflight 가 통과해
 * 출처 검사를 건너뛰고 쿠키를 받던 길이 있었다. 면제는 B1 이 쿠키를 다루지 않는 라우트에 한해 다시 정한다
 */
export function assertSameOrigin(event: H3Event): void {
  const origin = getRequestHeader(event, 'origin')
  const json = /^application\/json\b/i.test(getRequestHeader(event, 'content-type') ?? '')
  const isPost = event.method === 'POST'
  if (origin && siteOrigins().includes(origin) && (!isPost || json)) return
  logEvent('AUTH_CSRF_REJECTED', 'warn', 'origin rejected', {
    path: event.path.split('?')[0],
    reason: !origin || !siteOrigins().includes(origin) ? 'ORIGIN' : 'CONTENT_TYPE',
  })
  throw createError({
    statusCode: 403,
    statusMessage: 'Forbidden',
    data: { code: 'ORIGIN_REJECTED' },
  })
}

/** 운영 조치 내부 endpoint — X-Internal-Auth 를 NOMACOM_MEMBER_OPS_SECRET 와 상수 시간 대조. 비밀 미설정 = 전부 401 */
export function assertInternalAuth(event: H3Event): void {
  const secret = process.env.NOMACOM_MEMBER_OPS_SECRET
  const header = getRequestHeader(event, 'x-internal-auth')
  const ok =
    !!secret &&
    !!header &&
    Buffer.byteLength(header) === Buffer.byteLength(secret) &&
    timingSafeEqual(Buffer.from(header), Buffer.from(secret))
  if (ok) return
  logEvent('MEMBER_OPS_UNAUTHORIZED', 'warn', 'internal auth rejected', {
    reason: secret ? 'BAD_HEADER' : 'NO_SECRET',
  })
  throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
}
