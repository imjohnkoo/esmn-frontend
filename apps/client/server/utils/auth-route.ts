import {
  createError,
  defineEventHandler,
  getRequestHeader,
  isError,
  readBody,
  setResponseHeader,
  type H3Event,
} from 'h3'
import { useDB } from '../db'
import { assertSameOrigin } from './auth-guard'
import { requireAuthEnabled } from './auth-flags'
import { hashIp, viewerIp } from './issue-consent'
import { logEvent } from './issuance-log'
import { loadMemberKeys, MemberKeysUnavailable, type MemberKeys } from './member-pii'
import { dbCause } from './auth-session'

// /api/v1/auth/* 라우트 공용 경계(member-client-auth F-15 · F-16 · I-6 · I-7 · I-8) — 순서: 플래그(404) → Origin(403) → 키(503)

/**
 * auth · 내부 라우트 공용 래퍼(spec D-24 · I-1) — 의도한 h3 오류는 그대로 통과, 그 밖(DB 등)은 원인 한 줄만 로그하고 500.
 * drizzle 오류 message 는 쿼리 파라미터(이메일 해시 · UA · ip_hash · 암호문)를 싣는다 — Nitro 기본 오류 로그로 새지 않게 여기서 끊는다.
 */
export function defineMemberHandler<T>(fn: (event: H3Event) => Promise<T>) {
  return defineEventHandler(async (event) => {
    try {
      return await fn(event)
    } catch (e) {
      if (isError(e)) throw e
      logEvent('AUTH_INTERNAL_ERROR', 'error', dbCause(e), { path: event.path.split('?')[0] })
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error',
        data: { code: 'INTERNAL' },
      })
    }
  })
}

export function authFail(statusCode: number, code: string): never {
  throw createError({ statusCode, statusMessage: code, data: { code } })
}

/** 키 로드 — 없으면 503(평문으로 떨어지지 않는다 · write 0) */
export function memberKeys(): MemberKeys {
  try {
    return loadMemberKeys()
  } catch (e) {
    if (!(e instanceof MemberKeysUnavailable)) throw e
    logEvent('AUTH_KEYS_UNAVAILABLE', 'error', 'member PII key missing', { key: e.key })
    return authFail(503, 'MEMBER_KEYS_UNAVAILABLE')
  }
}

/** 상태를 바꾸는 auth 라우트의 진입 — 플래그 · Origin · 키 · DB · 본문(객체가 아니면 빈 객체) */
export async function memberPost(event: H3Event) {
  requireAuthEnabled(event)
  assertSameOrigin(event)
  const keys = memberKeys()
  const raw = await readBody(event).catch(() => null)
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return { keys, db: useDB(), body }
}

/** 로그인 필요 — 미들웨어가 채운 회원(없으면 401) */
export function requireUser(event: H3Event) {
  const user = event.context.auth?.user
  if (!user) return authFail(401, 'UNAUTHENTICATED')
  return user
}

export function noStore(event: H3Event): void {
  setResponseHeader(event, 'Cache-Control', 'no-store')
}

/** consent_log.ip_hash — 발급 동의와 같은 규칙(XFF 맨 오른쪽 · HMAC) */
export function requestIpHash(event: H3Event): string | null {
  const ip = viewerIp(
    getRequestHeader(event, 'x-forwarded-for'),
    event.node.req.socket?.remoteAddress,
  )
  return ip ? hashIp(ip, process.env.PII_HMAC_KEY) : null
}

/** 재설정 토큰 형식 — 32바이트 base64url(43자). 형식이 다르면 DB 를 보지 않는다 */
export const RESET_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/

/** 운영 조치 경로의 회원 id — 양의 안전 정수만 */
export function memberIdParam(raw: string | undefined): number | null {
  const n = Number(raw)
  return raw && /^\d+$/.test(raw) && Number.isSafeInteger(n) && n > 0 ? n : null
}
