// /api/v1/auth/* · /api/internal/members/* 배선 — 서비스 · DB · 메일은 대역(실 DB 동작은 member-auth.db.test.ts).
// spec I-2 · I-6 · I-7 · I-8 · I-11 · AC-5.1 · AC-7.1 · D-8 · F-18
import * as h3 from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEvent, setCookieLines } from '../../../testing/h3-event'

const svc = vi.hoisted(() => ({
  requestSignupCode: vi.fn(),
  checkSignupCode: vi.fn(),
  createAccount: vi.fn(),
  login: vi.fn(),
  requestPasswordReset: vi.fn(),
  checkResetToken: vi.fn(),
  confirmPasswordReset: vi.fn(),
  withdrawWithPassword: vi.fn(),
  withdrawMember: vi.fn(),
  suspendMember: vi.fn(),
  memberSummary: vi.fn(),
  unissuedOrderCount: vi.fn(),
}))
const send = vi.hoisted(() => vi.fn())
const revokeSession = vi.hoisted(() => vi.fn())
const logEvent = vi.hoisted(() => vi.fn())
vi.mock('../../../utils/member-auth', () => svc)
vi.mock('../../../utils/notify-email', () => ({
  sendMemberEmail: send,
  emailConfigured: () =>
    !!process.env.ESIM_MANAGER_INTERNAL_ENDPOINT && !!process.env.ESIM_MANAGER_INTERNAL_SECRET,
}))
vi.mock('../../../utils/issuance-log', () => ({ logEvent }))
vi.mock('../../../db', () => ({ useDB: () => ({ db: 'stub' }) }))
vi.mock('../../../utils/auth-session', async (orig) => ({
  ...(await orig<typeof import('../../../utils/auth-session')>()),
  revokeSession,
}))

let authConfig: Record<string, unknown> = {}
vi.stubGlobal('useRuntimeConfig', () => ({ auth: authConfig }))
vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
vi.stubGlobal('setResponseStatus', h3.setResponseStatus)
vi.stubGlobal('getRouterParam', h3.getRouterParam)

type Handler = (e: h3.H3Event) => Promise<unknown>
const load = async (p: string) => (await import(p)).default as Handler
const R = {
  session: await load('./session.get'),
  code: await load('./signup/code.post'),
  verify: await load('./signup/verify.post'),
  signup: await load('./signup.post'),
  login: await load('./login.post'),
  logout: await load('./logout.post'),
  reset: await load('./password-reset/index.post'),
  check: await load('./password-reset/check.post'),
  confirm: await load('./password-reset/confirm.post'),
  withdrawGet: await load('./withdraw.get'),
  withdraw: await load('./withdraw.post'),
  suspend: await load('../../internal/members/[id]/suspend.post'),
  opsWithdraw: await load('../../internal/members/[id]/withdraw.post'),
}

const KEYS = {
  PII_HMAC_KEY: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
  PII_ENCRYPTION_KEY: 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=',
  ESIM_MANAGER_INTERNAL_ENDPOINT: 'http://127.0.0.1:1',
  ESIM_MANAGER_INTERNAL_SECRET: 'test-internal',
}
const ORIGIN = { origin: 'https://esimmany.com' }
const post = (body: unknown, headers: Record<string, string> = ORIGIN) =>
  makeEvent({ method: 'POST', url: '/api/v1/auth/x', headers, body })
const withUser = (e: h3.H3Event) => (
  (e.context.auth = { user: { serviceUserId: 7, sessionId: 70 }, platform: 'web' }),
  e
)

async function call(handler: Handler, event: h3.H3Event) {
  try {
    const body = await handler(event)
    return { status: event.node.res.statusCode, body }
  } catch (e) {
    const err = e as h3.H3Error
    return { status: err.statusCode, body: err.data }
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  authConfig = { emailEnabled: 'true', linkOrigin: 'https://esimmany.com' }
  Object.assign(process.env, KEYS)
})
afterEach(() => {
  for (const k of Object.keys(KEYS)) delete process.env[k]
})

describe('플래그 off(I-6 · AC-7.1)', () => {
  it('상태를 바꾸는 auth 라우트 전부 404 · 서비스 호출 0 · session 은 빈 목록', async () => {
    authConfig = {}
    for (const h of [
      R.code,
      R.verify,
      R.signup,
      R.login,
      R.logout,
      R.reset,
      R.check,
      R.confirm,
      R.withdraw,
    ]) {
      expect((await call(h, withUser(post({ email: 'walker+1@example.com' })))).status).toBe(404)
    }
    expect((await call(R.withdrawGet, withUser(makeEvent()))).status).toBe(404)
    expect(await call(R.session, withUser(makeEvent()))).toEqual({
      status: 200,
      body: { methods: [], user: null },
    })
    expect(Object.values(svc).every((f) => f.mock.calls.length === 0)).toBe(true)
  })
})

describe('경계(I-7 · I-8)', () => {
  it('Origin 없음 · 남의 출처 → 403 · Bearer 는 Origin 없이 통과', async () => {
    expect((await call(R.login, post({}, {}))).status).toBe(403)
    expect((await call(R.login, post({}, { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await call(R.login, post({}, { authorization: 'Bearer t' }))).status).toBe(401)
  })

  it('상태를 바꾸는 auth 라우트 전부 — 남의 출처 · LAN 패턴 출처 · 폼 본문은 403 · 서비스 0(F-16 · QA ⑥ 2회차)', async () => {
    const routes = [
      R.code,
      R.verify,
      R.signup,
      R.login,
      R.logout,
      R.reset,
      R.check,
      R.confirm,
      R.withdraw,
    ]
    const bad: Record<string, string>[] = [
      { origin: 'https://evil.example' },
      { origin: 'http://203.0.113.9:8081' },
      { origin: 'https://esimmany.com', 'content-type': 'application/x-www-form-urlencoded' },
    ]
    for (const h of routes) {
      for (const headers of bad) {
        const e = makeEvent({ method: 'POST', url: '/api/v1/auth/x', headers })
        expect((await call(h, withUser(e))).status).toBe(403)
      }
    }
    expect(Object.values(svc).every((f) => f.mock.calls.length === 0)).toBe(true)
    expect(revokeSession).not.toHaveBeenCalled()
  })

  it('키 없음 → 503 MEMBER_KEYS_UNAVAILABLE · 서비스 0', async () => {
    delete process.env.PII_HMAC_KEY
    expect(await call(R.code, post({ email: 'walker+1@example.com' }))).toEqual({
      status: 503,
      body: { code: 'MEMBER_KEYS_UNAVAILABLE' },
    })
    expect(svc.requestSignupCode).not.toHaveBeenCalled()
    expect(logEvent).toHaveBeenCalledWith('AUTH_KEYS_UNAVAILABLE', 'error', expect.any(String), {
      key: 'HMAC',
    })
  })
})

describe('가입', () => {
  it('코드: 형식 400 · 메일 미설정 503 · 한도 429 · 발송 실패 502 · 성공 202(같은 본문)', async () => {
    expect((await call(R.code, post({ email: 'nope' }))).status).toBe(400)
    delete process.env.ESIM_MANAGER_INTERNAL_ENDPOINT
    expect(await call(R.code, post({ email: 'walker+1@example.com' }))).toEqual({
      status: 503,
      body: { code: 'EMAIL_UNAVAILABLE' },
    })
    process.env.ESIM_MANAGER_INTERNAL_ENDPOINT = KEYS.ESIM_MANAGER_INTERNAL_ENDPOINT
    svc.requestSignupCode.mockResolvedValueOnce({
      ok: false,
      code: 'TOO_MANY_REQUESTS',
      reason: 'COOLDOWN',
    })
    expect((await call(R.code, post({ email: 'walker+1@example.com' }))).status).toBe(429)
    svc.requestSignupCode.mockResolvedValue({ ok: true, code: '123456' })
    send.mockResolvedValueOnce({ ok: false, upstreamStatus: 502, ms: 3 })
    expect(await call(R.code, post({ email: 'walker+1@example.com' }))).toEqual({
      status: 502,
      body: { code: 'EMAIL_SEND_FAILED' },
    })
    send.mockResolvedValueOnce({ ok: true, result: 'STUBBED', ms: 3 })
    expect(await call(R.code, post({ email: ' Walker+1@Example.com ' }))).toEqual({
      status: 202,
      body: {},
    })
    expect(send).toHaveBeenLastCalledWith('signup_code', 'walker+1@example.com', { code: '123456' })
    // 로그에 주소 · 코드 0
    expect(JSON.stringify(logEvent.mock.calls)).not.toMatch(/walker|123456/)
  })

  it('계정 생성: 동의 없음 400 · 짧은 비밀번호 400 · EMAIL_TAKEN 409 · 성공 201 + 세션 쿠키', async () => {
    const body = {
      email: 'walker+1@example.com',
      code: '123456',
      password: 'correct-horse-1',
      age14: true,
      consent: { kind: 'signup-terms', textVersion: 'signup-v1', textHash: 'x' },
    }
    expect(await call(R.signup, post(body))).toEqual({
      status: 400,
      body: { code: 'CONSENT_REQUIRED' },
    })
    const { SIGNUP_CONSENT } = await import('../../../../shared/consent/signup-consent')
    const good = { ...body, consent: SIGNUP_CONSENT }
    expect(await call(R.signup, post({ ...good, age14: false }))).toEqual({
      status: 400,
      body: { code: 'CONSENT_REQUIRED' },
    })
    expect(await call(R.signup, post({ ...good, password: 'short' }))).toEqual({
      status: 400,
      body: { code: 'WEAK_PASSWORD' },
    })
    svc.createAccount.mockResolvedValueOnce({ ok: false, code: 'EMAIL_TAKEN' })
    expect((await call(R.signup, post(good))).status).toBe(409)
    svc.createAccount.mockResolvedValueOnce({
      ok: true,
      serviceUserId: 1,
      token: 'tok',
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    const e = post(good)
    expect(await call(R.signup, e)).toEqual({ status: 201, body: {} })
    expect(setCookieLines(e)[0]).toMatch(/^nomacom_session=tok;.*HttpOnly/)
  })
})

describe('로그인 · 로그아웃', () => {
  it('형식 오류는 서비스 없이 401 · LOCKED 429 · 성공 쿠키', async () => {
    expect(await call(R.login, post({ email: 'x', password: 'y' }))).toEqual({
      status: 401,
      body: { code: 'INVALID_CREDENTIALS' },
    })
    expect(svc.login).not.toHaveBeenCalled()
    svc.login.mockResolvedValueOnce({ ok: false, code: 'LOGIN_LOCKED' })
    expect(
      (await call(R.login, post({ email: 'walker+1@example.com', password: 'p' }))).status,
    ).toBe(429)
    svc.login.mockResolvedValueOnce({ ok: false, code: 'INVALID_CREDENTIALS' })
    expect(
      (await call(R.login, post({ email: 'walker+1@example.com', password: 'p' }))).status,
    ).toBe(401)
    svc.login.mockResolvedValueOnce({
      ok: true,
      serviceUserId: 7,
      token: 'tok',
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    const e = post({ email: 'walker+1@example.com', password: 'correct-horse-1' })
    expect((await call(R.login, e)).status).toBe(200)
    expect(setCookieLines(e)[0]).toMatch(/^nomacom_session=tok;/)
  })

  it('로그아웃 — 세션 있으면 그 세션만 revoke · 없어도 204 · 쿠키 삭제', async () => {
    const e = withUser(post({}))
    expect((await call(R.logout, e)).status).toBe(204)
    expect(revokeSession).toHaveBeenCalledWith({ db: 'stub' }, 70)
    expect(setCookieLines(e)[0]).toMatch(/^nomacom_session=;.*Max-Age=0/)
    expect((await call(R.logout, post({}))).status).toBe(204)
  })
})

describe('재설정(I-2 · D-8)', () => {
  it('있는 계정 · 없는 계정 모두 같은 202 본문 · 링크는 프래그먼트', async () => {
    svc.requestPasswordReset.mockResolvedValueOnce({ token: null, serviceUserId: null })
    const a = await call(R.reset, post({ email: 'nobody@example.com' }))
    svc.requestPasswordReset.mockResolvedValueOnce({ token: 'T'.repeat(43), serviceUserId: 7 })
    send.mockResolvedValueOnce({ ok: true, result: 'SENT', ms: 1 })
    const b = await call(R.reset, post({ email: 'walker+1@example.com' }))
    expect(a).toEqual(b)
    expect(a).toEqual({ status: 202, body: {} })
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
    expect(send.mock.calls[0]![2]).toEqual({
      resetUrl: `https://esimmany.com/password/reset/new#${'T'.repeat(43)}`,
    })
    expect(JSON.stringify(logEvent.mock.calls)).not.toContain('T'.repeat(43))
  })

  it('check · confirm — 형식 다르면 DB 없이 410 · 짧은 비밀번호 400 · 성공 204', async () => {
    expect((await call(R.check, post({ token: 'short' }))).status).toBe(410)
    expect(svc.checkResetToken).not.toHaveBeenCalled()
    svc.checkResetToken.mockResolvedValueOnce(null)
    expect((await call(R.check, post({ token: 'a'.repeat(43) }))).status).toBe(410)
    expect((await call(R.confirm, post({ token: 'a'.repeat(43), password: 'short' }))).status).toBe(
      400,
    )
    svc.checkResetToken.mockResolvedValueOnce({ challengeId: 1, target: 'x', serviceUserId: 7 })
    svc.confirmPasswordReset.mockResolvedValueOnce({
      ok: true,
      serviceUserId: 7,
      revokedSessions: 2,
    })
    const ok = post({ token: 'a'.repeat(43), password: 'correct-horse-2' })
    expect((await call(R.confirm, ok)).status).toBe(204)
    // 재설정 성공은 이 브라우저의 쿠키도 지운다
    expect(setCookieLines(ok)[0]).toMatch(/^nomacom_session=;.*Max-Age=0/)
  })

  it('confirm — 무효 토큰이면 Argon2 · 서비스 소비 없이 410(QA ⑥ 1회차)', async () => {
    svc.checkResetToken.mockResolvedValueOnce(null)
    expect(
      (await call(R.confirm, post({ token: 'b'.repeat(43), password: 'correct-horse-2' }))).status,
    ).toBe(410)
    expect(svc.confirmPasswordReset).not.toHaveBeenCalled()
  })

  it('I-2 — 재설정 요청은 계정 확인 · 발송을 기다리지 않고 202(시간 차 0)', async () => {
    svc.requestPasswordReset.mockReturnValueOnce(new Promise(() => {}))
    const res = await Promise.race([
      call(R.reset, post({ email: 'walker+1@example.com' })),
      new Promise((resolve) => setTimeout(() => resolve('timeout'), 500)),
    ])
    expect(res).toEqual({ status: 202, body: {} })
  })
})

describe('예상 밖 오류(D-24 · I-1)', () => {
  it('DB 오류는 500 + 원인 한 줄만 — drizzle message 의 쿼리 · 파라미터는 로그 0', async () => {
    const err = Object.assign(
      new Error('Failed query: select … params: login_failure,SECRET-HASH-PARAM'),
      {
        cause: { message: 'connection refused' },
      },
    )
    svc.login.mockRejectedValueOnce(err)
    expect(await call(R.login, post({ email: 'walker+1@example.com', password: 'p' }))).toEqual({
      status: 500,
      body: { code: 'INTERNAL' },
    })
    expect(logEvent).toHaveBeenCalledWith('AUTH_INTERNAL_ERROR', 'error', 'connection refused', {
      path: '/api/v1/auth/x',
    })
    expect(JSON.stringify(logEvent.mock.calls)).not.toContain('SECRET-HASH-PARAM')
  })

  it('세션 조회 DB 실패는 AUTH_SESSION_LOOKUP_FAILED(키 사고로 기록하지 않는다) · 비로그인으로', async () => {
    svc.memberSummary.mockRejectedValueOnce(
      Object.assign(new Error('Failed query'), { cause: { message: 'timeout' } }),
    )
    expect(await call(R.session, withUser(makeEvent()))).toEqual({
      status: 200,
      body: { methods: ['email'], user: null },
    })
    expect(logEvent).toHaveBeenCalledWith('AUTH_SESSION_LOOKUP_FAILED', 'error', 'timeout')
    expect(logEvent.mock.calls.some((c) => c[0] === 'AUTH_KEYS_UNAVAILABLE')).toBe(false)
  })
})

describe('탈퇴', () => {
  it('비로그인 401 · 틀림 401 · 잠김 429 · 성공 204', async () => {
    expect(await call(R.withdraw, post({ password: 'p' }))).toEqual({
      status: 401,
      body: { code: 'UNAUTHENTICATED' },
    })
    svc.withdrawWithPassword.mockResolvedValueOnce({ ok: false, code: 'PASSWORD_MISMATCH' })
    expect((await call(R.withdraw, withUser(post({ password: 'p' })))).status).toBe(401)
    svc.withdrawWithPassword.mockResolvedValueOnce({ ok: false, code: 'LOGIN_LOCKED' })
    expect((await call(R.withdraw, withUser(post({ password: 'p' })))).status).toBe(429)
    svc.withdrawWithPassword.mockResolvedValueOnce({ ok: true, revokedSessions: 1 })
    const done = withUser(post({ password: 'correct-horse-1' }))
    expect((await call(R.withdraw, done)).status).toBe(204)
    expect(setCookieLines(done)[0]).toMatch(/^nomacom_session=;.*Max-Age=0/)
    svc.unissuedOrderCount.mockResolvedValueOnce(2)
    expect(await call(R.withdrawGet, withUser(makeEvent()))).toEqual({
      status: 200,
      body: { unissuedOrderCount: 2 },
    })
  })
})

describe('운영 조치 내부 endpoint(AC-5.1 · AC-5.3 · I-11 · 플래그 무관)', () => {
  const ops = (id: string, headers: Record<string, string>) => {
    const e = makeEvent({ method: 'POST', url: `/api/internal/members/${id}/suspend`, headers })
    e.context.params = { id }
    return e
  }
  afterEach(() => delete process.env.NOMACOM_MEMBER_OPS_SECRET)

  it('비밀 없음 · 헤더 없음 · 틀림 → 401 · 서비스 0', async () => {
    expect((await call(R.suspend, ops('1', { 'x-internal-auth': 'x' }))).status).toBe(401)
    process.env.NOMACOM_MEMBER_OPS_SECRET = 'test-ops-secret'
    expect((await call(R.suspend, ops('1', {}))).status).toBe(401)
    expect(
      (await call(R.opsWithdraw, ops('1', { 'x-internal-auth': 'wrong-ops-secre' }))).status,
    ).toBe(401)
    expect(svc.suspendMember).not.toHaveBeenCalled()
  })

  it('플래그 off 여도 동작 · 잘못된 id 404 · 응답에 PII 0', async () => {
    authConfig = {}
    process.env.NOMACOM_MEMBER_OPS_SECRET = 'test-ops-secret'
    const h = { 'x-internal-auth': 'test-ops-secret' }
    expect((await call(R.suspend, ops('abc', h))).status).toBe(404)
    svc.suspendMember.mockResolvedValueOnce({ ok: true, status: 'suspended', revokedSessions: 2 })
    expect(await call(R.suspend, ops('7', h))).toEqual({
      status: 200,
      body: { serviceUserId: 7, status: 'suspended', revokedSessions: 2 },
    })
    svc.suspendMember.mockResolvedValueOnce({ ok: false, code: 'ALREADY_WITHDRAWN' })
    expect((await call(R.suspend, ops('7', h))).status).toBe(409)
    svc.suspendMember.mockResolvedValueOnce({ ok: false, code: 'NOT_FOUND' })
    expect((await call(R.suspend, ops('8', h))).status).toBe(404)
    svc.withdrawMember.mockResolvedValueOnce({ ok: false, code: 'NOT_FOUND' })
    expect((await call(R.opsWithdraw, ops('8', h))).status).toBe(404)
    svc.withdrawMember.mockResolvedValueOnce({ ok: true, status: 'withdrawn', revokedSessions: 0 })
    expect(await call(R.opsWithdraw, ops('7', h))).toEqual({
      status: 200,
      body: { serviceUserId: 7, status: 'withdrawn', revokedSessions: 0 },
    })
  })
})
