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
  it.each([
    [{ origin: 'https://esimmany.com' }, 200],
    [{ origin: 'https://app.esimmany.com' }, 200],
    [{ origin: 'https://evil.example' }, 403],
    [{}, 403], // Origin 없음 = 거부
    [{ authorization: 'Bearer t' }, 200], // 앱 Bearer 는 쿠키를 쓰지 않는다
  ])('%j → %i', (headers, code) => {
    expect(
      status(() =>
        assertSameOrigin(makeEvent({ method: 'POST', url: '/api/v1/auth/login', headers })),
      ),
    ).toBe(code)
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
