import { randomBytes } from 'node:crypto'
import { and, eq, gt, isNull, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { deleteCookie, getCookie, getRequestHeader, setCookie, type H3Event } from 'h3'
import * as schema from '../db/schema'
import { authMethods } from './auth-flags'
import { logEvent } from './issuance-log'
import { sha256Hex } from './member-pii'
import type { AuthContext, ClientPlatform } from './types'

// 회원 세션 — 한 곳(spec F-3 · F-8 · D-5 · D-12 · I-3 · I-4 · I-6). 미들웨어(server/middleware/auth.ts)는 resolveRequestAuth 만 부른다.
// 토큰 = 32바이트 base64url · DB 는 SHA-256 hex 만 · 웹 = HttpOnly 쿠키 / 앱 = Authorization Bearer(쿼리 0)

export type Db = PostgresJsDatabase<typeof schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type Executor = Db | Tx

export const SESSION_COOKIE = 'nomacom_session'
const DAY_MS = 86_400_000
export const SESSION_TTL_MS: Record<'web' | 'mobile', number> = {
  web: 30 * DAY_MS,
  mobile: 90 * DAY_MS,
}

/** 헤더(X-Client-Platform) 또는 User-Agent 로 추정 — E-2 자리표시자에서 옮김 */
export function detectPlatform(event: H3Event): ClientPlatform {
  const explicit = getRequestHeader(event, 'x-client-platform')?.toLowerCase()
  if (explicit === 'web' || explicit === 'mobile') return explicit
  const ua = getRequestHeader(event, 'user-agent') ?? ''
  if (/Expo|okhttp|CFNetwork/i.test(ua)) return 'mobile'
  if (/Mozilla|Chrome|Safari|Firefox|Edge/i.test(ua)) return 'web'
  return 'unknown'
}

/** Bearer 우선 → 쿠키. 쿼리스트링 토큰은 보지 않는다 */
export function extractToken(event: H3Event): { token: string; via: 'bearer' | 'cookie' } | null {
  const auth = getRequestHeader(event, 'authorization')
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim()
    return token ? { token, via: 'bearer' } : null
  }
  const cookie = getCookie(event, SESSION_COOKIE)
  return cookie ? { token: cookie, via: 'cookie' } : null
}

export function setSessionCookie(event: H3Event, token: string, expiresAt: Date): void {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000)),
  })
}

export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE, { path: '/' })
}

export async function issueSession(
  db: Executor,
  serviceUserId: number,
  platform: 'web' | 'mobile',
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS[platform])
  await db
    .insert(schema.serviceUserSession)
    .values({ serviceUserId, tokenHash: sha256Hex(token), platform, expiresAt })
  return { token, expiresAt }
}

export interface ResolvedSession {
  serviceUserId: number
  sessionId: number
  /** 슬라이딩으로 새로 정한 만료(갱신하지 않았으면 null) */
  renewedUntil: Date | null
}

/** 유효 세션(미폐기 · 미만료 · 회원 active)만. 남은 기간이 TTL − 1일보다 짧으면 만료를 TTL 만큼 미룬다(하루 최대 1회 쓰기) */
export async function resolveSession(
  db: Executor,
  token: string,
  now = new Date(),
): Promise<ResolvedSession | null> {
  const [row] = await db
    .select({
      sessionId: schema.serviceUserSession.serviceUserSessionId,
      serviceUserId: schema.serviceUserSession.serviceUserId,
      platform: schema.serviceUserSession.platform,
      expiresAt: schema.serviceUserSession.expiresAt,
    })
    .from(schema.serviceUserSession)
    .innerJoin(
      schema.serviceUser,
      eq(schema.serviceUser.serviceUserId, schema.serviceUserSession.serviceUserId),
    )
    .where(
      and(
        eq(schema.serviceUserSession.tokenHash, sha256Hex(token)),
        isNull(schema.serviceUserSession.revokedAt),
        gt(schema.serviceUserSession.expiresAt, now),
        eq(schema.serviceUser.status, 'active'),
      ),
    )
    .limit(1)
  if (!row) return null
  const ttl = SESSION_TTL_MS[row.platform === 'mobile' ? 'mobile' : 'web']
  let renewedUntil: Date | null = null
  if (row.expiresAt.getTime() - now.getTime() < ttl - DAY_MS) {
    renewedUntil = new Date(now.getTime() + ttl)
    await db
      .update(schema.serviceUserSession)
      .set({ expiresAt: renewedUntil, lastSeenAt: now })
      .where(eq(schema.serviceUserSession.serviceUserSessionId, row.sessionId))
  }
  return { serviceUserId: row.serviceUserId, sessionId: row.sessionId, renewedUntil }
}

export async function revokeSession(db: Executor, sessionId: number): Promise<void> {
  await db
    .update(schema.serviceUserSession)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(schema.serviceUserSession.serviceUserSessionId, sessionId),
        isNull(schema.serviceUserSession.revokedAt),
      ),
    )
}

/** 그 회원의 살아 있는 세션 전부 무효 — 비밀번호 재설정 · 탈퇴 · 정지(I-4). 무효로 만든 수 */
export async function revokeAllSessions(db: Executor, serviceUserId: number): Promise<number> {
  const rows = await db
    .update(schema.serviceUserSession)
    .set({ revokedAt: sql`now()` })
    .where(
      and(
        eq(schema.serviceUserSession.serviceUserId, serviceUserId),
        isNull(schema.serviceUserSession.revokedAt),
      ),
    )
    .returning({ id: schema.serviceUserSession.serviceUserSessionId })
  return rows.length
}

/** 로그용 DB 오류 원인 한 줄 — drizzle message(쿼리 · 파라미터) 대신 드라이버 cause 만 */
export function dbCause(e: unknown): string {
  const cause = (e as { cause?: { message?: string } }).cause?.message
  if (cause) return cause.split('\n')[0]!
  // drizzle 이 감싼 오류(«Failed query: … params: …»)는 cause 가 없어도 message 를 쓰지 않는다 — 그 밖(설정 누락 등)은 첫 줄
  const msg = e instanceof Error ? e.message : ''
  return msg && !/^Failed query/i.test(msg) ? msg.split('\n')[0]!.slice(0, 200) : 'unknown db error'
}

// 정적 자산 — 쿠키가 실려 와도 세션을 조회하지 않는다
function isAssetPath(path: string): boolean {
  const p = path.split('?')[0]!
  if (p.startsWith('/_nuxt/') || p.startsWith('/__nuxt')) return true
  return !p.startsWith('/api/') && /\.[a-z0-9]+$/i.test(p)
}

/**
 * 미들웨어 본체 — event.context.auth 값. 회원 수단이 하나도 켜져 있지 않으면 DB 를 보지 않는다(I-6).
 * DB 조회가 실패하면 user=null + 로그(사이트 전체가 쿠키 하나로 500 이 되지 않게).
 */
export async function resolveRequestAuth(
  event: H3Event,
  getDb: () => Executor,
): Promise<AuthContext> {
  const platform = detectPlatform(event)
  if (isAssetPath(event.path) || authMethods(event).length === 0) return { user: null, platform }
  const found = extractToken(event)
  if (!found) return { user: null, platform }
  try {
    const s = await resolveSession(getDb(), found.token)
    if (!s) {
      // 만료 · 폐기 · 모르는 쿠키는 지운다 — 요청마다 같은 조회를 되풀이하지 않게
      if (found.via === 'cookie') clearSessionCookie(event)
      return { user: null, platform }
    }
    if (s.renewedUntil && found.via === 'cookie')
      setSessionCookie(event, found.token, s.renewedUntil)
    return { user: { serviceUserId: s.serviceUserId, sessionId: s.sessionId }, platform }
  } catch (e) {
    // drizzle 오류 message 는 쿼리 · 파라미터(토큰 해시)를 싣는다 — DB 원인(cause)만
    logEvent('AUTH_SESSION_LOOKUP_FAILED', 'error', dbCause(e))
    return { user: null, platform }
  }
}
