// 회원 서비스 — 실 Postgres(위키 SQL 로 만든 member_auth_test) 통합 테스트. 로컬 전용(test:db) · plan §3.2
// 주소는 example.com 가짜만 · 키는 member-core §4.3 테스트 벡터 키(배포 키 아님)
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { connectMemberDb, resetMemberTables } from '../testing/member-db'
import { resolveSession } from './auth-session'
import {
  checkResetToken,
  checkSignupCode,
  confirmPasswordReset,
  createAccount,
  login,
  memberSummary,
  requestPasswordReset,
  requestSignupCode,
  suspendMember,
  unissuedOrderCount,
  withdrawMember,
  withdrawWithPassword,
} from './member-auth'
import { loadMemberKeys, piiHmac, sha256Hex } from './member-pii'
import { hashPassword } from './password'

const keys = loadMemberKeys({
  PII_HMAC_KEY: 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=',
  PII_ENCRYPTION_KEY: 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=',
})
const { client, db } = connectMemberDb()
afterAll(() => client.end())
beforeEach(() => resetMemberTables(client))

const EMAIL = 'walker+1@example.com'
const PW = 'correct-horse-1'
let pwHash: string
const passwordHash = async () => (pwHash ??= await hashPassword(PW))

const count = async (table: string, where = 'true') =>
  (
    await client.unsafe<{ n: number }[]>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`)
  )[0]!.n

/** 코드 요청 → 계정 생성까지(정상 경로) */
async function signUp(email = EMAIL) {
  const req = await requestSignupCode(db, keys, email)
  if (!req.ok) throw new Error('code request failed')
  const made = await createAccount(db, keys, {
    email,
    code: req.code,
    passwordHash: await passwordHash(),
    ipHash: null,
    userAgent: 'vitest',
  })
  if (!made.ok) throw new Error(made.code)
  return made
}
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, '0')

describe('가입(F-4 ~ F-6)', () => {
  it('AC-1.1 · AC-1.5 · I-1 · I-9 — 4 테이블 한 번에 · 평문 0', async () => {
    const made = await signUp()
    const [u] = await client`SELECT * FROM service_user`
    expect(u).toMatchObject({ status: 'active', email_hash: piiHmac(EMAIL, keys) })
    expect(u!.email_enc).toMatch(/^v1:/)
    expect(u!.email_enc).not.toContain('walker')
    expect(u!.age14_confirmed_at).not.toBeNull()
    expect([
      u!.marketing_sms_agreed_at,
      u!.marketing_email_agreed_at,
      u!.marketing_kakao_agreed_at,
    ]).toEqual([null, null, null])
    const [i] = await client`SELECT * FROM service_user_identity`
    expect(i).toMatchObject({ provider: 'email', provider_subject: piiHmac(EMAIL, keys) })
    expect(i!.password_hash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    const [c] = await client`SELECT * FROM consent_log`
    expect(c).toMatchObject({
      channel: 'esimmany-web',
      consent_kind: 'signup-terms',
      text_version: 'signup-v1',
      actor: 'customer',
      service_user_id: String(made.serviceUserId), // 원시 클라이언트는 bigint 를 문자열로
      order_ref: null,
      product_order_id: null,
    })
    const [s] = await client`SELECT * FROM service_user_session`
    expect(s).toMatchObject({
      token_hash: sha256Hex(made.token),
      platform: 'web',
      revoked_at: null,
    })
    expect(
      await count('service_user_challenge', "kind='email_signup_code' AND consumed_at IS NOT NULL"),
    ).toBe(1)
    // 평문 코드 · 이메일이 어느 열에도 없다
    const dump = JSON.stringify(await client`SELECT * FROM service_user_challenge`)
    expect(dump).not.toContain('walker')
  })

  it('AC-1.2 · D-9 — 이미 가입된 이메일도 같은 응답 · 코드 행 생김 → 3단계에서 EMAIL_TAKEN · 쓰기 0', async () => {
    await signUp()
    await client`UPDATE service_user_challenge SET created_at = now() - interval '2 minutes'`
    const req = await requestSignupCode(db, keys, EMAIL)
    expect(req.ok).toBe(true)
    if (!req.ok) return
    const again = await createAccount(db, keys, {
      email: EMAIL,
      code: req.code,
      passwordHash: await passwordHash(),
      ipHash: null,
      userAgent: null,
    })
    expect(again).toEqual({ ok: false, code: 'EMAIL_TAKEN' })
    expect(await count('service_user')).toBe(1)
    expect(await count('consent_log')).toBe(1)
  })

  it('AC-1.3 · I-14 — F-5 3번 + F-6 2번 틀리면 잠김 · 그 뒤 맞는 코드도 잠김 · 계정 0', async () => {
    const req = await requestSignupCode(db, keys, EMAIL)
    if (!req.ok) throw new Error()
    const bad = wrong(req.code)
    for (let k = 0; k < 3; k++) expect((await checkSignupCode(db, keys, EMAIL, bad)).ok).toBe(false)
    const in6 = await createAccount(db, keys, {
      email: EMAIL,
      code: bad,
      passwordHash: await passwordHash(),
      ipHash: null,
      userAgent: null,
    })
    expect(in6).toEqual({ ok: false, code: 'CODE_MISMATCH' })
    const fifth = await createAccount(db, keys, {
      email: EMAIL,
      code: bad,
      passwordHash: await passwordHash(),
      ipHash: null,
      userAgent: null,
    })
    expect(fifth).toEqual({ ok: false, code: 'CODE_LOCKED' })
    expect(await checkSignupCode(db, keys, EMAIL, req.code)).toEqual({
      ok: false,
      code: 'CODE_LOCKED',
    })
    expect(await count('service_user')).toBe(0)
  })

  it('I-14 — 같은 코드에 동시 비교 12개 → 누적 예약 5 이하', async () => {
    const req = await requestSignupCode(db, keys, EMAIL)
    if (!req.ok) throw new Error()
    const bad = wrong(req.code)
    await Promise.all(Array.from({ length: 12 }, () => checkSignupCode(db, keys, EMAIL, bad)))
    expect(await count('service_user_challenge', 'attempt_count > 5')).toBe(0)
    expect((await client`SELECT attempt_count FROM service_user_challenge`)[0]!.attempt_count).toBe(
      5,
    )
  })

  it('만료 · 소비된 코드 → CODE_EXPIRED · 코드 없음 → CODE_EXPIRED', async () => {
    expect(await checkSignupCode(db, keys, EMAIL, '000000')).toEqual({
      ok: false,
      code: 'CODE_EXPIRED',
    })
    const req = await requestSignupCode(db, keys, EMAIL)
    if (!req.ok) throw new Error()
    await client`UPDATE service_user_challenge SET expires_at = now() - interval '1 second'`
    expect(await checkSignupCode(db, keys, EMAIL, req.code)).toEqual({
      ok: false,
      code: 'CODE_EXPIRED',
    })
  })

  it('F-4 한도 — 60초 안 재요청 COOLDOWN · 1시간 5통 HOURLY · 동시 10개 → 행 1', async () => {
    const r = await Promise.all(
      Array.from({ length: 10 }, () => requestSignupCode(db, keys, EMAIL)),
    )
    expect(r.filter((x) => x.ok)).toHaveLength(1)
    expect(r.filter((x) => !x.ok && x.reason === 'COOLDOWN')).toHaveLength(9)
    for (let k = 0; k < 4; k++) {
      await client`UPDATE service_user_challenge SET created_at = created_at - interval '2 minutes'`
      expect((await requestSignupCode(db, keys, EMAIL)).ok).toBe(true)
    }
    await client`UPDATE service_user_challenge SET created_at = created_at - interval '2 minutes'`
    expect(await requestSignupCode(db, keys, EMAIL)).toMatchObject({ ok: false, reason: 'HOURLY' })
    expect(await count('service_user_challenge')).toBe(5)
  })

  it('최근 코드만 유효 — 재발송 뒤 옛 코드는 MISMATCH', async () => {
    const a = await requestSignupCode(db, keys, EMAIL)
    await client`UPDATE service_user_challenge SET created_at = now() - interval '2 minutes'`
    const b = await requestSignupCode(db, keys, EMAIL)
    if (!a.ok || !b.ok || a.code === b.code) return
    expect((await checkSignupCode(db, keys, EMAIL, a.code)).ok).toBe(false)
    expect(await checkSignupCode(db, keys, EMAIL, b.code)).toMatchObject({ ok: true })
  })
})

describe('로그인(F-7)', () => {
  it('AC-2.1 — 맞는 비밀번호 → 새 세션 · 실패 카운터 0', async () => {
    const made = await signUp()
    const r = await login(db, keys, EMAIL, PW)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.token).not.toBe(made.token)
    expect(await count('service_user_session')).toBe(2)
    expect(await count('service_user_challenge', "kind='login_failure'")).toBe(0)
  })

  it('AC-2.2 · I-12 — 없는 계정 · 틀림 · 정지 · 탈퇴 = 같은 INVALID_CREDENTIALS', async () => {
    const made = await signUp()
    expect(await login(db, keys, 'nobody@example.com', PW)).toEqual({
      ok: false,
      code: 'INVALID_CREDENTIALS',
    })
    expect(await login(db, keys, EMAIL, 'wrong-password')).toEqual({
      ok: false,
      code: 'INVALID_CREDENTIALS',
    })
    await suspendMember(db, made.serviceUserId)
    expect(await login(db, keys, EMAIL, PW)).toEqual({ ok: false, code: 'INVALID_CREDENTIALS' })
    await withdrawMember(db, made.serviceUserId)
    expect(await login(db, keys, EMAIL, PW)).toEqual({ ok: false, code: 'INVALID_CREDENTIALS' })
  })

  it('AC-2.3 — 5번 실패 → 맞는 비밀번호도 LOCKED → 창이 지나면 성공 · 행 0', async () => {
    await signUp()
    for (let k = 0; k < 5; k++)
      expect((await login(db, keys, EMAIL, 'wrong-password')).ok).toBe(false)
    expect(await login(db, keys, EMAIL, PW)).toEqual({ ok: false, code: 'LOGIN_LOCKED' })
    await client`UPDATE service_user_challenge SET created_at = now() - interval '16 minutes' WHERE kind = 'login_failure'`
    expect((await login(db, keys, EMAIL, PW)).ok).toBe(true)
    expect(await count('service_user_challenge', "kind='login_failure'")).toBe(0)
  })

  it('I-14 — 같은 이메일 동시 틀린 로그인 20개 → 검증까지 가는 시도 5 · 나머지 LOCKED', async () => {
    await signUp()
    const r = await Promise.all(
      Array.from({ length: 20 }, () => login(db, keys, EMAIL, 'wrong-password')),
    )
    expect(r.filter((x) => !x.ok && x.code === 'INVALID_CREDENTIALS')).toHaveLength(5)
    expect(r.filter((x) => !x.ok && x.code === 'LOGIN_LOCKED')).toHaveLength(15)
    expect(await count('service_user_challenge', "kind='login_failure'")).toBe(5)
  })
})

describe('세션(F-3 · AC-6.3)', () => {
  it('유효 · 로그아웃 · 만료 · 정지 회원 → null', async () => {
    const made = await signUp()
    expect(await resolveSession(db, made.token)).toMatchObject({
      serviceUserId: made.serviceUserId,
      renewedUntil: null,
    })
    await client`UPDATE service_user_session SET expires_at = now() - interval '1 second'`
    expect(await resolveSession(db, made.token)).toBeNull()
    const r = await login(db, keys, EMAIL, PW)
    if (!r.ok) throw new Error()
    await suspendMember(db, made.serviceUserId)
    expect(await resolveSession(db, r.token)).toBeNull()
  })

  it('슬라이딩 — 남은 기간 < 29일이면 30일로 미룸 · 하루 안에는 다시 쓰지 않는다', async () => {
    const made = await signUp()
    await client`UPDATE service_user_session SET expires_at = now() + interval '20 days'`
    const s = await resolveSession(db, made.token)
    expect(s?.renewedUntil).toBeInstanceOf(Date)
    const [row] = await client`SELECT expires_at, last_seen_at FROM service_user_session`
    expect(new Date(row!.expires_at as string).getTime() - Date.now()).toBeGreaterThan(29.9 * 86_400_000)
    expect(row!.last_seen_at).not.toBeNull()
    expect((await resolveSession(db, made.token))?.renewedUntil).toBeNull()
  })
})

describe('재설정(F-9 · F-10)', () => {
  it('AC-3.1 — 없는 계정은 행 0 · 토큰 없음', async () => {
    expect(await requestPasswordReset(db, keys, 'nobody@example.com')).toEqual({
      token: null,
      serviceUserId: null,
    })
    expect(await count('service_user_challenge')).toBe(0)
  })

  it('AC-3.2 · AC-3.3 · I-4 — 1회용 · 세션 전부 revoke · 다른 토큰도 소비 · 실패 카운터 0 · 새 비밀번호로 로그인', async () => {
    const made = await signUp()
    await login(db, keys, EMAIL, PW)
    await login(db, keys, EMAIL, 'wrong-password')
    const a = await requestPasswordReset(db, keys, EMAIL)
    const b = await requestPasswordReset(db, keys, EMAIL)
    if (!a.token || !b.token) throw new Error()
    expect(a.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(await checkResetToken(db, keys, a.token)).toMatchObject({
      serviceUserId: made.serviceUserId,
    })
    const done = await confirmPasswordReset(
      db,
      keys,
      a.token,
      await hashPassword('correct-horse-2'),
    )
    expect(done).toEqual({ ok: true, serviceUserId: made.serviceUserId, revokedSessions: 2 })
    expect(await resolveSession(db, made.token)).toBeNull()
    expect(await confirmPasswordReset(db, keys, a.token, await passwordHash())).toEqual({
      ok: false,
      code: 'TOKEN_INVALID',
    })
    expect(await checkResetToken(db, keys, b.token)).toBeNull()
    expect(await count('service_user_challenge', "kind='login_failure'")).toBe(0)
    expect((await login(db, keys, EMAIL, PW)).ok).toBe(false)
    expect((await login(db, keys, EMAIL, 'correct-horse-2')).ok).toBe(true)
  })

  it('만료 · 1시간 5통 한도(조용히 건너뜀)', async () => {
    await signUp()
    const a = await requestPasswordReset(db, keys, EMAIL)
    await client`UPDATE service_user_challenge SET expires_at = now() - interval '1 second' WHERE kind = 'password_reset'`
    expect(await checkResetToken(db, keys, a.token!)).toBeNull()
    for (let k = 0; k < 4; k++)
      expect((await requestPasswordReset(db, keys, EMAIL)).token).not.toBeNull()
    expect((await requestPasswordReset(db, keys, EMAIL)).token).toBeNull()
  })
})

describe('탈퇴 · 정지(F-12 ~ F-14)', () => {
  it('AC-4.3 · AC-4.5 · F-13 — 삭제 3 · 암호문 NULL · 해시 남음 · consent 남음 · 멱등 · 재가입', async () => {
    const made = await signUp()
    await client`INSERT INTO service_user_order_link (service_user_id, channel, product_order_id, order_ref, match_method, matched_role)
                 VALUES (${made.serviceUserId}, 'naver-smartstore', 2026092300000102, '2026092300000101', 'phone_idv', 'orderer')`
    const w = await withdrawWithPassword(db, made.serviceUserId, PW)
    expect(w).toEqual({ ok: true, revokedSessions: 1 })
    const [u] = await client`SELECT * FROM service_user`
    expect(u).toMatchObject({
      status: 'withdrawn',
      email_enc: null,
      name_enc: null,
      phone_enc: null,
      email_hash: piiHmac(EMAIL, keys),
    })
    expect(u!.withdrawn_at).not.toBeNull()
    for (const t of [
      'service_user_session',
      'service_user_identity',
      'service_user_order_link',
      'service_user_challenge',
    ])
      expect(await count(t)).toBe(0)
    expect(await count('consent_log')).toBe(1)
    expect(await withdrawMember(db, made.serviceUserId)).toEqual({
      ok: true,
      status: 'withdrawn',
      revokedSessions: 0,
    })
    const again = await signUp()
    expect(again.serviceUserId).not.toBe(made.serviceUserId)
  })

  it('F-12 — 틀린 비밀번호는 PASSWORD_MISMATCH · 로그인과 같은 카운터로 잠김(D-18)', async () => {
    const made = await signUp()
    for (let k = 0; k < 5; k++)
      expect(await withdrawWithPassword(db, made.serviceUserId, 'wrong-password')).toEqual({
        ok: false,
        code: 'PASSWORD_MISMATCH',
      })
    expect(await withdrawWithPassword(db, made.serviceUserId, PW)).toEqual({
      ok: false,
      code: 'LOGIN_LOCKED',
    })
    expect(await login(db, keys, EMAIL, PW)).toEqual({ ok: false, code: 'LOGIN_LOCKED' })
  })

  it('AC-5.2 · AC-5.4 — 정지 2회 · withdrawn 정지 거부 · 없는 회원', async () => {
    const made = await signUp()
    expect(await suspendMember(db, made.serviceUserId)).toEqual({
      ok: true,
      status: 'suspended',
      revokedSessions: 1,
    })
    expect(await suspendMember(db, made.serviceUserId)).toEqual({
      ok: true,
      status: 'suspended',
      revokedSessions: 0,
    })
    expect(await withdrawMember(db, made.serviceUserId)).toMatchObject({
      ok: true,
      status: 'withdrawn',
    })
    expect(await suspendMember(db, made.serviceUserId)).toEqual({
      ok: false,
      code: 'ALREADY_WITHDRAWN',
    })
    expect(await suspendMember(db, 999_999)).toEqual({ ok: false, code: 'NOT_FOUND' })
    expect(await withdrawMember(db, 999_999)).toEqual({ ok: false, code: 'NOT_FOUND' })
  })

  it('AC-4.4 · D-14 — QR 전 자체 구매 주문 = paid + issue_failed', async () => {
    const made = await signUp()
    await client`INSERT INTO master_order DEFAULT VALUES`
    for (const [i, status] of ['paid', 'issued', 'issue_failed', 'refunded'].entries()) {
      await client`INSERT INTO web_order (master_order_id, service_user_id, channel, toss_order_id, amount_krw, unit_price_krw, plan_type_id, quantity, status)
                   VALUES (1, ${made.serviceUserId}, 'web', ${`walk-${i}`}, 1000, 1000, 'X', 1, ${status})`
    }
    expect(await unissuedOrderCount(db, made.serviceUserId)).toBe(2)
  })

  it('F-11 — 요약은 가린 이메일만', async () => {
    const made = await signUp()
    expect(await memberSummary(db, keys, made.serviceUserId)).toEqual({
      emailMasked: 'wa***@example.com',
      providers: ['email'],
    })
  })
})

describe('I-13 정리 경계(D-6)', () => {
  it('창 안 행은 남고 만료 1시간 넘은 행만 지운다', async () => {
    const h = 'a'.repeat(64)
    await client`INSERT INTO service_user_challenge (kind, target_hash, attempt_count, expires_at, created_at) VALUES
      ('login_failure', ${h}, 1, now() + interval '1 minute', now() - interval '14 minutes'),
      ('email_signup_code', ${h}, 0, now() - interval '49 minutes', now() - interval '59 minutes'),
      ('password_reset', ${h}, 0, now() - interval '61 minutes', now() - interval '91 minutes')`
    await requestSignupCode(db, keys, 'other@example.com')
    const left = (
      await client`SELECT kind FROM service_user_challenge WHERE target_hash = ${h} ORDER BY kind`
    ).map((r) => r.kind)
    expect(left).toEqual(['email_signup_code', 'login_failure'])
  })
})

it('DB 시각은 now() 기준 — 앱 시계 의존 0(스모크)', async () => {
  const [r] = await db.execute<{ ok: boolean }>(sql`SELECT now() IS NOT NULL AS ok`)
  expect(r!.ok).toBe(true)
})
