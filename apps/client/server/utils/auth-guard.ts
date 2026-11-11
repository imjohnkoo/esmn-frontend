import { timingSafeEqual } from 'node:crypto'
import { createError, getRequestHeader, type H3Event } from 'h3'
import { isOriginAllowed, parseExtraOrigins } from './cors-origins'
import { logEvent } from './issuance-log'

// 요청 경계의 판정 둘(spec F-14 · F-16 · I-7 · I-11)

/** Bearer 로 인증하는 요청(앱) — 쿠키를 쓰지 않으므로 CSRF 판정 대상이 아니다 */
export function isBearerRequest(event: H3Event): boolean {
  return getRequestHeader(event, 'authorization')?.startsWith('Bearer ') === true
}

/** 쿠키 경로의 상태 변경 요청은 허용 Origin 필수(헤더 없음 = 거부). SameSite=Lax 가 두 번째 층 */
export function assertSameOrigin(event: H3Event): void {
  if (isBearerRequest(event)) return
  const origin = getRequestHeader(event, 'origin')
  if (origin && isOriginAllowed(origin, parseExtraOrigins(process.env.CORS_EXTRA_ORIGINS))) return
  logEvent('AUTH_CSRF_REJECTED', 'warn', 'origin rejected', { path: event.path.split('?')[0] })
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
