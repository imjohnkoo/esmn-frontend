import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'

// 회원 PII v1 형식(member-core §4.3 — backend member-pii.utils.ts 와 같은 규칙 · 같은 벡터) · spec member-client-auth F-2.
// 키는 base64 를 디코드한 32바이트다(base64 문자열 자체가 아니다). 평문은 반환값으로만 — 로그 · 오류 메시지에 싣지 않는다.

export interface MemberKeys {
  enc: Buffer
  hmac: Buffer
}

export class MemberKeysUnavailable extends Error {
  constructor(readonly key: 'ENCRYPTION' | 'HMAC') {
    super(`member key ${key} missing or not 32 bytes`)
  }
}

function key32(raw: string | undefined, name: 'ENCRYPTION' | 'HMAC'): Buffer {
  const buf = raw ? Buffer.from(raw, 'base64') : Buffer.alloc(0)
  if (buf.length !== 32) throw new MemberKeysUnavailable(name)
  return buf
}

/** env `PII_ENCRYPTION_KEY` · `PII_HMAC_KEY` → 키 둘. 없거나 32바이트가 아니면 MemberKeysUnavailable(spec I-8) */
export function loadMemberKeys(env: Record<string, string | undefined> = process.env): MemberKeys {
  return { enc: key32(env.PII_ENCRYPTION_KEY, 'ENCRYPTION'), hmac: key32(env.PII_HMAC_KEY, 'HMAC') }
}

/** 이메일 정규화 — trim · 소문자 · 빈 값 = null(제공자별 규칙 없음 — `+tag` · 점 그대로) */
export function normalizeEmail(input: string | null | undefined): string | null {
  const e = (input ?? '').trim().toLowerCase()
  return e === '' ? null : e
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 경계 검증 — 정규화 뒤 형식 · 254자 이하. 통과하면 정규화 값, 아니면 null */
export function parseEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const e = normalizeEmail(input)
  return e && e.length <= 254 && EMAIL_RE.test(e) ? e : null
}

/** 조회 해시 — HMAC-SHA256(PII_HMAC_KEY, UTF-8(정규화 값)) 소문자 hex 64자 */
export function piiHmac(normalized: string, keys: Pick<MemberKeys, 'hmac'>): string {
  return createHmac('sha256', keys.hmac).update(normalized, 'utf8').digest('hex')
}

/** challenge secret_hash — HMAC(`<kind>:<코드|토큰>`) (A1 D-4 kind 도메인 분리) */
export function secretHash(
  kind: 'email_signup_code' | 'password_reset',
  secret: string,
  keys: Pick<MemberKeys, 'hmac'>,
): string {
  return piiHmac(`${kind}:${secret}`, keys)
}

/** 세션 토큰 해시 — SHA-256 hex(키 없음 · 토큰 엔트로피 256비트) */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

/** v1 암호문 = 'v1:' + base64(IV12 ‖ tag16 ‖ ct) · AES-256-GCM · AAD 없음. iv 인자는 테스트(KAT) 전용 */
export function encryptV1(
  plain: string,
  keys: Pick<MemberKeys, 'enc'>,
  iv: Buffer = randomBytes(12),
): string {
  const cipher = createCipheriv('aes-256-gcm', keys.enc, iv)
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64')}`
}

export function decryptV1(payload: string, keys: Pick<MemberKeys, 'enc'>): string {
  if (!payload.startsWith('v1:')) throw new Error('unsupported PII payload version')
  const raw = Buffer.from(payload.slice(3), 'base64')
  const decipher = createDecipheriv('aes-256-gcm', keys.enc, raw.subarray(0, 12))
  decipher.setAuthTag(raw.subarray(12, 28))
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
}

/** 화면 표시용 가린 이메일 — 로컬부 앞 2자(2자 이하면 1자) + *** + @도메인 (spec F-11) */
export function maskEmail(normalized: string): string {
  const at = normalized.lastIndexOf('@')
  const local = normalized.slice(0, at)
  const keep = local.length <= 2 ? 1 : 2
  return `${local.slice(0, keep)}***${normalized.slice(at)}`
}
