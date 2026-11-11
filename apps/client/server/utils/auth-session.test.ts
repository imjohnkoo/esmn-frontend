// 세션 경계 — 토큰 추출 · 쿠키 속성 · 플래그 off 조회 0 · 정적 자산(spec F-3 · I-3 · I-6 · AC-6.2)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEvent, setCookieLines } from '../testing/h3-event'
import {
  detectPlatform,
  extractToken,
  resolveRequestAuth,
  setSessionCookie,
  SESSION_COOKIE,
} from './auth-session'
import { enabledMethods } from './auth-flags'

let authConfig: Record<string, unknown> = {}
vi.stubGlobal('useRuntimeConfig', () => ({ auth: authConfig }))

describe('extractToken', () => {
  it('Bearer 우선 → 쿠키', () => {
    const e = makeEvent({
      headers: { authorization: 'Bearer abc', cookie: `${SESSION_COOKIE}=xyz` },
    })
    expect(extractToken(e)).toEqual({ token: 'abc', via: 'bearer' })
    expect(extractToken(makeEvent({ headers: { cookie: `${SESSION_COOKIE}=xyz` } }))).toEqual({
      token: 'xyz',
      via: 'cookie',
    })
  })

  it('쿼리스트링 토큰 · 빈 Bearer 는 무시', () => {
    expect(
      extractToken(makeEvent({ url: `/api/v1/auth/session?token=abc&${SESSION_COOKIE}=abc` })),
    ).toBeNull()
    expect(extractToken(makeEvent({ headers: { authorization: 'Bearer   ' } }))).toBeNull()
  })
})

describe('detectPlatform', () => {
  it.each([
    [{ 'x-client-platform': 'mobile' }, 'mobile'],
    [{ 'user-agent': 'Expo/1.0' }, 'mobile'],
    [{ 'user-agent': 'Mozilla/5.0 Safari' }, 'web'],
    [{}, 'unknown'],
  ])('%j → %s', (headers, p) => {
    expect(detectPlatform(makeEvent({ headers }))).toBe(p)
  })
})

describe('쿠키 속성(I-3)', () => {
  const env = process.env.NODE_ENV
  afterEach(() => {
    process.env.NODE_ENV = env
  })

  it('HttpOnly · SameSite=Lax · Path=/ · Domain 없음 · prod 는 Secure', () => {
    process.env.NODE_ENV = 'production'
    const e = makeEvent()
    setSessionCookie(e, 'tok', new Date(Date.now() + 30 * 86_400_000))
    const [line] = setCookieLines(e)
    expect(line).toMatch(/^nomacom_session=tok;/)
    expect(line).toMatch(/HttpOnly/)
    expect(line).toMatch(/SameSite=Lax/)
    expect(line).toMatch(/Path=\//)
    expect(line).toMatch(/Secure/)
    expect(line).not.toMatch(/Domain=/)
    expect(line).toMatch(/Max-Age=259(19|20)\d\d/)
  })
})

describe('resolveRequestAuth', () => {
  const getDb = vi.fn(() => {
    throw new Error('DB 를 열면 안 된다')
  })
  beforeEach(() => {
    getDb.mockClear()
    authConfig = {}
  })

  it('플래그 off → 유효해 보이는 쿠키가 있어도 DB 조회 0 · user null(I-6)', async () => {
    const e = makeEvent({ url: '/my', headers: { cookie: `${SESSION_COOKIE}=abc` } })
    expect(await resolveRequestAuth(e, getDb)).toEqual({ user: null, platform: 'unknown' })
    expect(getDb).not.toHaveBeenCalled()
  })

  it('플래그 on 이어도 정적 자산 · 토큰 없음은 조회 0', async () => {
    authConfig = { emailEnabled: 'true' }
    for (const url of ['/_nuxt/app.js', '/favicon.ico', '/catalog/thumbs/a.webp']) {
      await resolveRequestAuth(
        makeEvent({ url, headers: { cookie: `${SESSION_COOKIE}=abc` } }),
        getDb,
      )
    }
    await resolveRequestAuth(makeEvent({ url: '/my' }), getDb)
    expect(getDb).not.toHaveBeenCalled()
  })

  it('DB 실패 → user null(사이트 500 아님)', async () => {
    authConfig = { emailEnabled: true }
    const e = makeEvent({
      url: '/api/v1/auth/session',
      headers: { cookie: `${SESSION_COOKIE}=abc` },
    })
    const out = await resolveRequestAuth(e, getDb)
    expect(out.user).toBeNull()
    expect(getDb).toHaveBeenCalledTimes(1)
  })
})

describe('enabledMethods(F-15)', () => {
  it.each([
    [undefined, []],
    [{}, []],
    [{ emailEnabled: false }, []],
    [{ emailEnabled: 'false' }, []],
    [{ emailEnabled: '1' }, []],
    [{ emailEnabled: true }, ['email']],
    [{ emailEnabled: 'true' }, ['email']],
    [{ googleEnabled: true, naverEnabled: true, kakaoEnabled: true }, []], // 코드 경로 없는 수단은 켜도 0
  ])('%j → %j', (cfg, out) => {
    expect(enabledMethods(cfg)).toEqual(out)
  })
})

describe('dbCause — 로그 한 줄(I-1)', () => {
  it('드라이버 cause 첫 줄 · drizzle «Failed query» message 는 쓰지 않는다 · 그 밖 오류는 첫 줄', async () => {
    const { dbCause } = await import('./auth-session')
    expect(
      dbCause(
        Object.assign(new Error('Failed query: x params: SECRET'), {
          cause: { message: 'timeout\nmore' },
        }),
      ),
    ).toBe('timeout')
    expect(dbCause(new Error('Failed query: select … params: login_failure,SECRET'))).toBe(
      'unknown db error',
    )
    expect(dbCause(new Error('DATABASE_URL is not configured\nstack'))).toBe(
      'DATABASE_URL is not configured',
    )
    expect(dbCause('weird')).toBe('unknown db error')
  })
})
