// CSRF · 내부 인증 경계(spec F-14 · F-16 · I-7 · I-11 · AC-5.1)
import { afterEach, describe, expect, it } from 'vitest'
import { makeEvent } from '../testing/h3-event'
import { assertInternalAuth, assertSameOrigin } from './auth-guard'

const status = (fn: () => void) => {
  try {
    fn()
    return 200
  } catch (e) {
    return (e as { statusCode: number }).statusCode
  }
}

describe('assertSameOrigin', () => {
  const J = { 'content-type': 'application/json' }
  it.each([
    [{ origin: 'https://esimmany.com', ...J }, 200],
    [{ origin: 'https://app.esimmany.com', ...J }, 200],
    [{ origin: 'https://evil.example', ...J }, 403],
    [J, 403], // Origin 없음 = 거부
    // CORS 목록의 Expo LAN 패턴은 공인 IP 도 통과시킨다 — 쿠키 경로에서는 거부(QA ⑥ 2회차 · 로그인 CSRF)
    [{ origin: 'http://203.0.113.9:8081', ...J }, 403],
    [{ origin: 'exp://203.0.113.9:8081', ...J }, 403],
    // 사이트 출처여도 폼 · text/plain 본문은 거부(교차 출처 폼은 preflight 없이 온다)
    [{ origin: 'https://esimmany.com', 'content-type': 'application/x-www-form-urlencoded' }, 403],
    [{ origin: 'https://esimmany.com', 'content-type': 'text/plain' }, 403],
    [{ origin: 'https://esimmany.com' }, 403],
    [{ authorization: 'Bearer t' }, 200], // 앱 Bearer 는 쿠키를 쓰지 않는다
  ])('%j → %i', (headers, code) => {
    expect(
      status(() =>
        assertSameOrigin(makeEvent({ method: 'POST', url: '/api/v1/auth/login', headers })),
      ),
    ).toBe(code)
  })

  it('production 에서는 localhost 개발 출처도 거부 · CORS_EXTRA_ORIGINS(walk)는 허용', () => {
    const env = { ...process.env }
    try {
      process.env.NODE_ENV = 'production'
      process.env.CORS_EXTRA_ORIGINS = 'http://127.0.0.1:3097'
      const ev = (origin: string) =>
        makeEvent({
          method: 'POST',
          url: '/api/v1/auth/login',
          headers: { origin, 'content-type': 'application/json' },
        })
      expect(status(() => assertSameOrigin(ev('http://localhost:3000')))).toBe(403)
      expect(status(() => assertSameOrigin(ev('http://127.0.0.1:3097')))).toBe(200)
    } finally {
      process.env = env
    }
  })
})

describe('assertInternalAuth', () => {
  const saved = process.env.NOMACOM_MEMBER_OPS_SECRET
  afterEach(() => {
    if (saved === undefined) delete process.env.NOMACOM_MEMBER_OPS_SECRET
    else process.env.NOMACOM_MEMBER_OPS_SECRET = saved
  })

  it('서버 비밀 없음 → 맞춰 보낸 헤더도 401', () => {
    delete process.env.NOMACOM_MEMBER_OPS_SECRET
    expect(
      status(() => assertInternalAuth(makeEvent({ headers: { 'x-internal-auth': '' } }))),
    ).toBe(401)
    expect(status(() => assertInternalAuth(makeEvent()))).toBe(401)
  })

  it.each([
    [{}, 401],
    [{ 'x-internal-auth': 'wrong-secret-value' }, 401],
    [{ 'x-internal-auth': 'test-ops-secret-0' }, 401], // 길이 다름
    [{ 'x-internal-auth': 'test-ops-secret' }, 200],
  ])('%j → %i', (headers, code) => {
    process.env.NOMACOM_MEMBER_OPS_SECRET = 'test-ops-secret'
    expect(status(() => assertInternalAuth(makeEvent({ headers })))).toBe(code)
  })
})
