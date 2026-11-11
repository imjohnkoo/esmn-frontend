// 미들웨어 쿠키 동작(F-3 · D-5 · QA ⑥ 3회차) — 실 DB 로 세션을 만들고 resolveRequestAuth 가 쿠키를 갱신 · 삭제하는지 본다(로컬 전용)
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeEvent, setCookieLines } from '../testing/h3-event'
import { connectMemberDb, resetMemberTables } from '../testing/member-db'
import { issueSession, resolveRequestAuth, SESSION_COOKIE } from './auth-session'

vi.stubGlobal('useRuntimeConfig', () => ({ auth: { emailEnabled: 'true' } }))
const { client, db } = connectMemberDb()
afterAll(() => client.end())
beforeEach(() => resetMemberTables(client))

async function member() {
  const [u] =
    await client`INSERT INTO service_user (status, age14_confirmed_at) VALUES ('active', now()) RETURNING service_user_id`
  return Number(u!.service_user_id)
}

describe('resolveRequestAuth — 쿠키', () => {
  it('슬라이딩 갱신이면 같은 토큰으로 Max-Age 30일 쿠키를 다시 쓴다 · user 를 채운다', async () => {
    const id = await member()
    const { token } = await issueSession(db, id, 'web')
    await client`UPDATE service_user_session SET expires_at = now() + interval '20 days'`
    const e = makeEvent({ url: '/my', headers: { cookie: `${SESSION_COOKIE}=${token}` } })
    const auth = await resolveRequestAuth(e, () => db)
    expect(auth.user?.serviceUserId).toBe(id)
    const [line] = setCookieLines(e)
    expect(line).toMatch(new RegExp(`^${SESSION_COOKIE}=${token};`))
    expect(Number(line!.match(/Max-Age=(\d+)/)![1])).toBeGreaterThan(29.9 * 86_400)
  })

  it('갱신이 필요 없으면 쿠키를 쓰지 않는다', async () => {
    const id = await member()
    const { token } = await issueSession(db, id, 'web')
    const e = makeEvent({ url: '/my', headers: { cookie: `${SESSION_COOKIE}=${token}` } })
    expect((await resolveRequestAuth(e, () => db)).user?.serviceUserId).toBe(id)
    expect(setCookieLines(e)).toEqual([])
  })

  it('만료 · 모르는 쿠키는 지운다(Max-Age=0) · user null', async () => {
    const e = makeEvent({ url: '/my', headers: { cookie: `${SESSION_COOKIE}=unknown-token` } })
    expect((await resolveRequestAuth(e, () => db)).user).toBeNull()
    expect(setCookieLines(e)[0]).toMatch(new RegExp(`^${SESSION_COOKIE}=;.*Max-Age=0`))
  })

  it('세션이 살아 있어도 회원이 active 가 아니면(정지 · 탈퇴) user null · 쿠키 삭제', async () => {
    for (const status of ['suspended', 'withdrawn']) {
      await resetMemberTables(client)
      const id = await member()
      const { token } = await issueSession(db, id, 'web')
      await client`UPDATE service_user SET status = ${status}`
      const e = makeEvent({ url: '/my', headers: { cookie: `${SESSION_COOKIE}=${token}` } })
      expect((await resolveRequestAuth(e, () => db)).user).toBeNull()
      expect(setCookieLines(e)[0]).toMatch(new RegExp(`^${SESSION_COOKIE}=;.*Max-Age=0`))
    }
  })

  it('Bearer 는 갱신 · 무효여도 쿠키를 쓰지 않는다', async () => {
    const id = await member()
    const { token } = await issueSession(db, id, 'web')
    await client`UPDATE service_user_session SET expires_at = now() + interval '20 days'`
    const ok = makeEvent({
      url: '/api/v1/auth/session',
      headers: { authorization: `Bearer ${token}` },
    })
    expect((await resolveRequestAuth(ok, () => db)).user?.serviceUserId).toBe(id)
    expect(setCookieLines(ok)).toEqual([])
    const bad = makeEvent({
      url: '/api/v1/auth/session',
      headers: { authorization: 'Bearer nope' },
    })
    expect((await resolveRequestAuth(bad, () => db)).user).toBeNull()
    expect(setCookieLines(bad)).toEqual([])
  })
})
