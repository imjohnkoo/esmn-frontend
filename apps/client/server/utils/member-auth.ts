import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, inArray, isNull, lt, sql } from 'drizzle-orm'
import type { PgInsertValue } from 'drizzle-orm/pg-core'
import * as schema from '../db/schema'
import { SIGNUP_CONSENT } from '../../shared/consent/signup-consent'
import { issueSession, revokeAllSessions, type Executor, type Tx, type Db } from './auth-session'
import { decryptV1, encryptV1, maskEmail, piiHmac, secretHash, type MemberKeys } from './member-pii'
import { hashPassword, verifyPassword } from './password'

// 회원 서비스(member-client-auth spec F-4 ~ F-14 · §4.2 · §4.3 · D-6 · D-19 · I-2 · I-4 · I-9 · I-13 · I-14).
// h3 를 모른다 — 입력은 경계에서 검증된 값(정규화 이메일 · 정책 통과 비밀번호 해시), 결과는 판별 유니온. 라우트가 상태 코드 · 문구 · 로그로 바꾼다.
// 시각 비교는 전부 DB now() — 앱 시계와 섞지 않는다.

const C = schema.serviceUserChallenge
const U = schema.serviceUser
const I = schema.serviceUserIdentity

export const MAX_ATTEMPTS = 5
const CODE_TTL = sql`now() + interval '10 minutes'`
const RESET_TTL = sql`now() + interval '30 minutes'`
const LOGIN_WINDOW = sql`now() - interval '15 minutes'`
const LOGIN_FAILURE_TTL = sql`now() + interval '15 minutes'`
const HOUR_AGO = sql`now() - interval '1 hour'`
const RESEND_COOLDOWN = sql`now() - interval '60 seconds'`
const HOURLY_SEND_LIMIT = 5

type ChallengeKind = 'email_signup_code' | 'password_reset' | 'login_failure'
type Fail<C extends string> = { ok: false; code: C }

/**
 * 대상별 짧은 트랜잭션 + advisory 잠금(D-19) — 같은 대상의 «셈 + 시도 행 INSERT» 를 직렬화한다.
 * 키 = hashtextextended('<kind>:<target>') 단일 bigint(발급 락 2-int 키와 겹치지 않는다). Argon2 · 메일은 이 밖에서.
 */
async function withTargetLock<T>(
  db: Db,
  kind: ChallengeKind,
  target: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${`${kind}:${target}`}, 0))`)
    return fn(tx)
  })
}

/** challenge INSERT + 정리(D-6 · I-13) — 만료된 지 1시간 넘은 행만 지운다(15분 잠금 창 · 1시간 재발송 창 안의 행은 남는다) */
async function insertChallenge(tx: Executor, row: PgInsertValue<typeof C>): Promise<number> {
  const [inserted] = await tx.insert(C).values(row).returning({ id: C.serviceUserChallengeId })
  // 잠긴 행은 건너뛴다(SKIP LOCKED) — 대상별 UPDATE · DELETE(재설정 confirm · 탈퇴)와 다른 순서로 같은 행을 잡아 교착하지 않게.
  // ponytail: 전 표 스캔 — expires_at 인덱스 없음. 행이 수만을 넘으면 인덱스 또는 주기 잡
  await tx.execute(
    sql`DELETE FROM service_user_challenge WHERE service_user_challenge_id IN (SELECT service_user_challenge_id FROM service_user_challenge WHERE expires_at < now() - interval '1 hour' FOR UPDATE SKIP LOCKED)`,
  )
  return inserted!.id
}

async function recentCount(
  tx: Executor,
  kind: ChallengeKind,
  target: string,
  since: ReturnType<typeof sql>,
) {
  const [row] = await tx
    .select({
      n: sql<number>`count(*)::int`,
      newest: sql<boolean>`coalesce(max(${C.createdAt}) > ${RESEND_COOLDOWN}, false)`,
    })
    .from(C)
    .where(and(eq(C.kind, kind), eq(C.targetHash, target), gt(C.createdAt, since)))
  return row!
}

const hexEqual = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

// ── 가입 ──────────────────────────────────────────────────────────────

/** F-4 — 가입 여부와 상관없이 같은 판정(D-9). 성공하면 메일로 보낼 6자리 코드(평문은 반환값으로만) */
export async function requestSignupCode(
  db: Db,
  keys: MemberKeys,
  email: string,
): Promise<
  { ok: true; code: string } | (Fail<'TOO_MANY_REQUESTS'> & { reason: 'COOLDOWN' | 'HOURLY' })
> {
  const target = piiHmac(email, keys)
  return withTargetLock(db, 'email_signup_code', target, async (tx) => {
    const { n, newest } = await recentCount(tx, 'email_signup_code', target, HOUR_AGO)
    if (newest) return { ok: false, code: 'TOO_MANY_REQUESTS', reason: 'COOLDOWN' } as const
    if (n >= HOURLY_SEND_LIMIT)
      return { ok: false, code: 'TOO_MANY_REQUESTS', reason: 'HOURLY' } as const
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
    await insertChallenge(tx, {
      kind: 'email_signup_code',
      targetHash: target,
      secretHash: secretHash('email_signup_code', code, keys),
      expiresAt: CODE_TTL,
    })
    return { ok: true, code } as const
  })
}

export type CodeFailure = 'CODE_EXPIRED' | 'CODE_LOCKED' | 'CODE_MISMATCH'

/**
 * F-5 · F-6 공용(D-19 · I-14) — 그 대상의 가장 최근 코드 행 하나만. 비교 **전에** attempt_count 를 조건부 UPDATE 로 예약하므로
 * 동시 요청이 몇 개든 한 코드의 누적 비교는 5회 이하. 맞는 시도도 1회로 센다. 소비는 하지 않는다(createAccount 트랜잭션).
 */
export async function checkSignupCode(
  db: Executor,
  keys: MemberKeys,
  email: string,
  code: string,
): Promise<{ ok: true; challengeId: number } | Fail<CodeFailure>> {
  const target = piiHmac(email, keys)
  const [latest] = await db
    .select({ id: C.serviceUserChallengeId })
    .from(C)
    .where(and(eq(C.kind, 'email_signup_code'), eq(C.targetHash, target)))
    .orderBy(desc(C.createdAt), desc(C.serviceUserChallengeId))
    .limit(1)
  if (!latest) return { ok: false, code: 'CODE_EXPIRED' }
  const [reserved] = await db
    .update(C)
    .set({ attemptCount: sql`${C.attemptCount} + 1` })
    .where(
      and(
        eq(C.serviceUserChallengeId, latest.id),
        isNull(C.consumedAt),
        gt(C.expiresAt, sql`now()`),
        lt(C.attemptCount, MAX_ATTEMPTS),
      ),
    )
    .returning({ secretHash: C.secretHash, attempts: C.attemptCount })
  if (!reserved) {
    // 사유는 지금 행 상태로(읽은 뒤 다른 요청이 소비 · 소진했을 수 있다) — 소비 · 만료면 EXPIRED, 남은 건 시도 소진뿐
    const [state] = await db
      .select({ gone: sql<boolean>`${C.consumedAt} IS NOT NULL OR ${C.expiresAt} <= now()` })
      .from(C)
      .where(eq(C.serviceUserChallengeId, latest.id))
    return { ok: false, code: !state || state.gone ? 'CODE_EXPIRED' : 'CODE_LOCKED' }
  }
  if (!hexEqual(reserved.secretHash ?? '', secretHash('email_signup_code', code, keys))) {
    return { ok: false, code: reserved.attempts >= MAX_ATTEMPTS ? 'CODE_LOCKED' : 'CODE_MISMATCH' }
  }
  return { ok: true, challengeId: latest.id }
}

export interface CreateAccountInput {
  email: string
  code: string
  password: string
  ipHash: string | null
  userAgent: string | null
}

/**
 * F-6 — 코드 확인(시도 예약은 트랜잭션 밖 — 불일치 횟수가 롤백되지 않게) → 한 트랜잭션: 이미 가입 확인 → 코드 소비 →
 * service_user · identity · consent_log(signup-terms · I-9) · 세션. 같은 이메일 동시 가입 23505 → EMAIL_TAKEN
 */
export async function createAccount(
  db: Db,
  keys: MemberKeys,
  input: CreateAccountInput,
): Promise<
  | { ok: true; serviceUserId: number; token: string; expiresAt: Date }
  | Fail<CodeFailure | 'EMAIL_TAKEN'>
> {
  const check = await checkSignupCode(db, keys, input.email, input.code)
  if (!check.ok) return check
  // Argon2(19MiB)는 코드가 맞은 뒤에만 — 아무 6자리로 비싼 해시를 반복 유발하지 못하게
  const passwordHash = await hashPassword(input.password)
  const target = piiHmac(input.email, keys)
  try {
    return await db.transaction(async (tx) => {
      // spec F-6 순서: 코드 소비 → 이미 가입이면 409(소비는 커밋 — 같은 코드로 E-31 을 반복해 받지 않게)
      const [consumed] = await tx
        .update(C)
        .set({ consumedAt: sql`now()` })
        .where(
          and(
            eq(C.serviceUserChallengeId, check.challengeId),
            isNull(C.consumedAt),
            gt(C.expiresAt, sql`now()`),
          ),
        )
        .returning({ id: C.serviceUserChallengeId })
      if (!consumed) return { ok: false, code: 'CODE_EXPIRED' } as const
      const [taken] = await tx
        .select({ id: I.serviceUserIdentityId })
        .from(I)
        .where(and(eq(I.provider, 'email'), eq(I.providerSubject, target)))
        .limit(1)
      if (taken) return { ok: false, code: 'EMAIL_TAKEN' } as const
      const now = sql`now()`
      const [user] = await tx
        .insert(U)
        .values({
          status: 'active',
          emailEnc: encryptV1(input.email, keys),
          emailHash: target,
          emailVerifiedAt: now,
          age14ConfirmedAt: now,
          lastLoginAt: now,
        })
        .returning({ id: U.serviceUserId })
      const serviceUserId = user!.id
      await tx.insert(I).values({
        serviceUserId,
        provider: 'email',
        providerSubject: target,
        passwordHash,
        lastUsedAt: now,
      })
      await tx.insert(schema.consentLog).values({
        channel: 'esimmany-web',
        consentKind: SIGNUP_CONSENT.kind,
        textVersion: SIGNUP_CONSENT.textVersion,
        textHash: SIGNUP_CONSENT.textHash,
        acceptedAt: now,
        actor: 'customer',
        ipHash: input.ipHash,
        userAgent: input.userAgent,
        serviceUserId,
      })
      const session = await issueSession(tx, serviceUserId, 'web')
      return { ok: true, serviceUserId, ...session } as const
    })
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code === '23505')
      return { ok: false, code: 'EMAIL_TAKEN' }
    throw e
  }
}

// ── 로그인 · 비밀번호 확인 공용 ───────────────────────────────────────

/** 로그인 실패 카운터(F-7 · F-12 · D-18) — 잠금이면 false, 아니면 시도 행 1개 예약 */
async function reserveLoginAttempt(db: Db, target: string): Promise<boolean> {
  return withTargetLock(db, 'login_failure', target, async (tx) => {
    const [row] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(C)
      .where(
        and(eq(C.kind, 'login_failure'), eq(C.targetHash, target), gt(C.createdAt, LOGIN_WINDOW)),
      )
    if (row!.n >= MAX_ATTEMPTS) return false
    await insertChallenge(tx, {
      kind: 'login_failure',
      targetHash: target,
      secretHash: null,
      attemptCount: 1,
      expiresAt: LOGIN_FAILURE_TTL,
    })
    return true
  })
}

const clearLoginFailures = (db: Executor, target: string) =>
  db.delete(C).where(and(eq(C.kind, 'login_failure'), eq(C.targetHash, target)))

/** F-7 — 없는 계정 · 틀림 · 탈퇴 · 정지는 같은 실패(I-2 · I-12). 잠금 판정은 Argon2 전 */
export async function login(
  db: Db,
  keys: MemberKeys,
  email: string,
  password: string,
): Promise<
  | { ok: true; serviceUserId: number; token: string; expiresAt: Date }
  | Fail<'LOGIN_LOCKED' | 'INVALID_CREDENTIALS'>
> {
  const target = piiHmac(email, keys)
  if (!(await reserveLoginAttempt(db, target))) return { ok: false, code: 'LOGIN_LOCKED' }
  const [row] = await db
    .select({
      identityId: I.serviceUserIdentityId,
      hash: I.passwordHash,
      serviceUserId: U.serviceUserId,
      status: U.status,
    })
    .from(I)
    .innerJoin(U, eq(U.serviceUserId, I.serviceUserId))
    .where(and(eq(I.provider, 'email'), eq(I.providerSubject, target)))
    .limit(1)
  const active = row?.status === 'active'
  if (!(await verifyPassword(active ? row!.hash : null, password)) || !active) {
    return { ok: false, code: 'INVALID_CREDENTIALS' }
  }
  return db.transaction(async (tx) => {
    // D-25 — 검증 뒤 재설정 · 정지 · 탈퇴가 끼어들었으면 세션을 내지 않는다. 잠금 순서는 탈퇴 · 정지와 같게
    // service_user → identity(반대면 교착). 정지 · 탈퇴는 service_user 를, 재설정 confirm 은 identity 를 먼저 잡으므로
    // 어느 쪽이든 먼저 커밋한 결과를 보고 해시 · 상태를 다시 대조한다
    const [user] = await tx
      .select({ status: U.status })
      .from(U)
      .where(eq(U.serviceUserId, row!.serviceUserId))
      .for('update')
    const [still] = await tx
      .select({ hash: I.passwordHash })
      .from(I)
      .where(eq(I.serviceUserIdentityId, row!.identityId))
      .for('update')
    if (!user || !still || still.hash !== row!.hash || user.status !== 'active') {
      return { ok: false, code: 'INVALID_CREDENTIALS' } as const
    }
    await clearLoginFailures(tx, target)
    await tx
      .update(U)
      .set({ lastLoginAt: sql`now()` })
      .where(eq(U.serviceUserId, row!.serviceUserId))
    await tx
      .update(I)
      .set({ lastUsedAt: sql`now()` })
      .where(eq(I.serviceUserIdentityId, row!.identityId))
    const session = await issueSession(tx, row!.serviceUserId, 'web')
    return { ok: true, serviceUserId: row!.serviceUserId, ...session } as const
  })
}

// ── 비밀번호 재설정 ───────────────────────────────────────────────────

/** F-9 — 활성 email 계정이 있고 한도 안이면 1회용 토큰(평문은 반환값으로만). 없으면 아무것도 쓰지 않는다 */
export async function requestPasswordReset(
  db: Db,
  keys: MemberKeys,
  email: string,
): Promise<
  { token: string; serviceUserId: number } | { token: null; serviceUserId: number | null }
> {
  const target = piiHmac(email, keys)
  const [row] = await db
    .select({ serviceUserId: U.serviceUserId })
    .from(I)
    .innerJoin(U, eq(U.serviceUserId, I.serviceUserId))
    .where(and(eq(I.provider, 'email'), eq(I.providerSubject, target), eq(U.status, 'active')))
    .limit(1)
  if (!row) return { token: null, serviceUserId: null }
  const token = await withTargetLock(db, 'password_reset', target, async (tx) => {
    const { n } = await recentCount(tx, 'password_reset', target, HOUR_AGO)
    if (n >= HOURLY_SEND_LIMIT) return null
    const t = randomBytes(32).toString('base64url')
    await insertChallenge(tx, {
      kind: 'password_reset',
      targetHash: target,
      secretHash: secretHash('password_reset', t, keys),
      expiresAt: RESET_TTL,
    })
    return t
  })
  return { token, serviceUserId: row.serviceUserId }
}

/** F-10 check — 미소비 · 미만료 · 대상 email 계정 active. 토큰 형식은 라우트가 먼저 거른다 */
export async function checkResetToken(db: Executor, keys: MemberKeys, token: string) {
  const [row] = await db
    .select({
      challengeId: C.serviceUserChallengeId,
      target: C.targetHash,
      serviceUserId: U.serviceUserId,
    })
    .from(C)
    .innerJoin(I, and(eq(I.provider, 'email'), eq(I.providerSubject, C.targetHash)))
    .innerJoin(U, eq(U.serviceUserId, I.serviceUserId))
    .where(
      and(
        eq(C.kind, 'password_reset'),
        eq(C.secretHash, secretHash('password_reset', token, keys)),
        isNull(C.consumedAt),
        gt(C.expiresAt, sql`now()`),
        eq(U.status, 'active'),
      ),
    )
    .limit(1)
  return row ?? null
}

/** F-10 confirm — 한 트랜잭션: 토큰 소비 · 비밀번호 교체 · 세션 전부 revoke(I-4) · 같은 대상 다른 재설정 행 소비 · 실패 카운터 삭제 */
export async function confirmPasswordReset(
  db: Db,
  keys: MemberKeys,
  token: string,
  passwordHash: string,
): Promise<{ ok: true; serviceUserId: number; revokedSessions: number } | Fail<'TOKEN_INVALID'>> {
  const found = await checkResetToken(db, keys, token)
  if (!found) return { ok: false, code: 'TOKEN_INVALID' }
  return db.transaction(async (tx) => {
    const [consumed] = await tx
      .update(C)
      .set({ consumedAt: sql`now()` })
      .where(
        and(
          eq(C.serviceUserChallengeId, found.challengeId),
          isNull(C.consumedAt),
          gt(C.expiresAt, sql`now()`),
        ),
      )
      .returning({ id: C.serviceUserChallengeId })
    if (!consumed) return { ok: false, code: 'TOKEN_INVALID' } as const
    await tx
      .update(I)
      .set({ passwordHash })
      .where(and(eq(I.provider, 'email'), eq(I.providerSubject, found.target)))
    const revokedSessions = await revokeAllSessions(tx, found.serviceUserId)
    await tx
      .update(C)
      .set({ consumedAt: sql`now()` })
      .where(
        and(eq(C.kind, 'password_reset'), eq(C.targetHash, found.target), isNull(C.consumedAt)),
      )
    await clearLoginFailures(tx, found.target)
    return { ok: true, serviceUserId: found.serviceUserId, revokedSessions } as const
  })
}

// ── 탈퇴 · 정지 ───────────────────────────────────────────────────────

/**
 * F-13 — 한 트랜잭션: 세션 · 로그인 수단 · 주문 링크 · 그 이메일의 challenge 삭제 → withdrawn + 암호문 · 마케팅 동의 NULL.
 * 해시 · age14 · created_at 은 남긴다(30일 해시 삭제 = backend F-6). consent_log 는 지우지 않는다. 이미 withdrawn 이면 그대로(멱등)
 */
export async function withdrawMember(
  db: Db,
  serviceUserId: number,
): Promise<{ ok: true; status: 'withdrawn'; revokedSessions: number } | Fail<'NOT_FOUND'>> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ status: U.status, emailHash: U.emailHash })
      .from(U)
      .where(eq(U.serviceUserId, serviceUserId))
      .for('update')
    if (!user) return { ok: false, code: 'NOT_FOUND' } as const
    if (user.status === 'withdrawn')
      return { ok: true, status: 'withdrawn', revokedSessions: 0 } as const
    // 끊은 세션 수 = 지우기 전 살아 있던 것(DB now() 기준 — 앱 시계를 쓰지 않는다)
    const [live] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.serviceUserSession)
      .where(
        and(
          eq(schema.serviceUserSession.serviceUserId, serviceUserId),
          isNull(schema.serviceUserSession.revokedAt),
          gt(schema.serviceUserSession.expiresAt, sql`now()`),
        ),
      )
    await tx
      .delete(schema.serviceUserSession)
      .where(eq(schema.serviceUserSession.serviceUserId, serviceUserId))
    await tx.delete(I).where(eq(I.serviceUserId, serviceUserId))
    await tx
      .delete(schema.serviceUserOrderLink)
      .where(eq(schema.serviceUserOrderLink.serviceUserId, serviceUserId))
    if (user.emailHash) await tx.delete(C).where(eq(C.targetHash, user.emailHash))
    await tx
      .update(U)
      .set({
        status: 'withdrawn',
        withdrawnAt: sql`now()`,
        emailEnc: null,
        nameEnc: null,
        phoneEnc: null,
        marketingSmsAgreedAt: null,
        marketingEmailAgreedAt: null,
        marketingKakaoAgreedAt: null,
      })
      .where(eq(U.serviceUserId, serviceUserId))
    return { ok: true, status: 'withdrawn', revokedSessions: live!.n } as const
  })
}

/** F-12 본인 탈퇴 — 비밀번호 재확인(로그인과 같은 실패 카운터 · D-18) 뒤 withdrawMember */
export async function withdrawWithPassword(
  db: Db,
  serviceUserId: number,
  password: string,
): Promise<{ ok: true; revokedSessions: number } | Fail<'LOGIN_LOCKED' | 'PASSWORD_MISMATCH'>> {
  const [row] = await db
    .select({ emailHash: U.emailHash, hash: I.passwordHash })
    .from(U)
    .leftJoin(I, and(eq(I.serviceUserId, U.serviceUserId), eq(I.provider, 'email')))
    .where(and(eq(U.serviceUserId, serviceUserId), eq(U.status, 'active')))
    .limit(1)
  if (!row?.emailHash) return { ok: false, code: 'PASSWORD_MISMATCH' }
  if (!(await reserveLoginAttempt(db, row.emailHash))) return { ok: false, code: 'LOGIN_LOCKED' }
  if (!(await verifyPassword(row.hash, password))) return { ok: false, code: 'PASSWORD_MISMATCH' }
  const done = await withdrawMember(db, serviceUserId)
  return { ok: true, revokedSessions: done.ok ? done.revokedSessions : 0 }
}

/** F-14 정지 — active → suspended + 세션 전부 revoke(한 트랜잭션). 이미 suspended 면 같은 응답 · withdrawn 이면 거부 */
export async function suspendMember(
  db: Db,
  serviceUserId: number,
): Promise<
  | { ok: true; status: 'suspended'; revokedSessions: number }
  | Fail<'NOT_FOUND' | 'ALREADY_WITHDRAWN'>
> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({ status: U.status })
      .from(U)
      .where(eq(U.serviceUserId, serviceUserId))
      .for('update')
    if (!user) return { ok: false, code: 'NOT_FOUND' } as const
    if (user.status === 'withdrawn') return { ok: false, code: 'ALREADY_WITHDRAWN' } as const
    if (user.status !== 'suspended') {
      await tx.update(U).set({ status: 'suspended' }).where(eq(U.serviceUserId, serviceUserId))
    }
    const revokedSessions = await revokeAllSessions(tx, serviceUserId)
    return { ok: true, status: 'suspended', revokedSessions } as const
  })
}

// ── 조회 ──────────────────────────────────────────────────────────────

/** F-11 — 화면용 요약(가린 이메일 · 수단). 평문 이메일은 반환하지 않는다 */
export async function memberSummary(db: Executor, keys: MemberKeys, serviceUserId: number) {
  const [user] = await db
    .select({ emailEnc: U.emailEnc })
    .from(U)
    .where(eq(U.serviceUserId, serviceUserId))
    .limit(1)
  const providers = await db
    .select({ provider: I.provider })
    .from(I)
    .where(eq(I.serviceUserId, serviceUserId))
  return {
    emailMasked: user?.emailEnc ? maskEmail(decryptV1(user.emailEnc, keys)) : null,
    providers: providers.map((p) => p.provider).sort(),
  }
}

/** F-12 · D-14 — QR 을 아직 받지 않은 자체 구매 주문 수(web_order 읽기만 · write 0) */
export async function unissuedOrderCount(db: Executor, serviceUserId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.webOrder)
    .where(
      and(
        eq(schema.webOrder.serviceUserId, serviceUserId),
        inArray(schema.webOrder.status, ['paid', 'issue_failed']),
      ),
    )
  return row!.n
}
