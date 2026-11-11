// member-core §4.3 테스트 벡터(테스트 전용 키 — 배포하지 않는다) · spec member-client-auth F-2 · I-1 · I-8
import { describe, expect, it } from 'vitest'
import {
  decryptV1,
  encryptV1,
  loadMemberKeys,
  maskEmail,
  MemberKeysUnavailable,
  normalizeEmail,
  parseEmail,
  piiHmac,
  secretHash,
  sha256Hex,
} from './member-pii'

const HMAC_B64 = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='
const ENC_B64 = 'ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8='
const keys = loadMemberKeys({ PII_HMAC_KEY: HMAC_B64, PII_ENCRYPTION_KEY: ENC_B64 })
const KAT_IV = Buffer.from('a0a1a2a3a4a5a6a7a8a9aaab', 'hex')

describe('이메일 정규화 · HMAC 벡터', () => {
  it.each([
    ['  Foo.Bar@Example.COM ', '6a1f2ae52068a39915f063ad91da6c4f0d0017c3aeb072c6040c41f9cf025436'],
    ['foo.bar@example.com', '6a1f2ae52068a39915f063ad91da6c4f0d0017c3aeb072c6040c41f9cf025436'],
    [
      ' User.Name+tag@Example.COM',
      '25cc7133ec15ccd4f8bfb1666e075118592f9bbd25b2ca17373b3252d43a543b',
    ],
    ['username@example.com', 'dffb4e81feb63270632e40d85ea681e7ed05370ebaa0781188a6f1430834e907'],
  ])('%j', (input, hex) => {
    expect(piiHmac(normalizeEmail(input)!, keys)).toBe(hex)
  })

  it('전화 벡터(같은 키 · 같은 함수)', () => {
    expect(piiHmac('01012345678', keys)).toBe(
      '3d9aaa6c086ebb6840c87fed289eef12e84a7238e3d7b667d65dc2d5b1a61f43',
    )
  })

  it.each(['', '   ', null, undefined])('빈 값 %j → null', (v) => {
    expect(normalizeEmail(v as string)).toBeNull()
  })

  it('base64 문자열 자체를 키로 쓰면 벡터가 맞지 않는다', () => {
    const wrong = { hmac: Buffer.from(HMAC_B64, 'utf8') }
    expect(piiHmac('foo.bar@example.com', wrong)).not.toBe(
      '6a1f2ae52068a39915f063ad91da6c4f0d0017c3aeb072c6040c41f9cf025436',
    )
  })

  it('secretHash 는 kind 를 입력에 섞는다(도메인 분리)', () => {
    expect(secretHash('email_signup_code', '123456', keys)).toBe(
      piiHmac('email_signup_code:123456', keys),
    )
    expect(secretHash('email_signup_code', '123456', keys)).not.toBe(
      secretHash('password_reset', '123456', keys),
    )
  })
})

describe('v1 암호문', () => {
  it.each([
    ['01012345678', 'v1:oKGio6SlpqeoqaqrqEInTOHQTkPUGVx6m8SW7U4NlAX25LSflx+V'],
    ['foo.bar@example.com', 'v1:oKGio6Slpqeoqaqrhh1KVJGg34rJIrSp5XxVUBhTyxqmtvLqxFDM11YxE4jyEKw='],
    ['홍길동', 'v1:oKGio6SlpqeoqaqrdL+8wtBDSLmojEJWcnb95pOlKd58b2slOA=='],
  ])('KAT %j — 고정 IV 암호화 · 복호화', (plain, enc) => {
    expect(encryptV1(plain, keys, KAT_IV)).toBe(enc)
    expect(decryptV1(enc, keys)).toBe(plain)
  })

  it('IV 는 매번 다르고 왕복된다', () => {
    const a = encryptV1('walker+1@example.com', keys)
    const b = encryptV1('walker+1@example.com', keys)
    expect(a).not.toBe(b)
    expect(a.startsWith('v1:')).toBe(true)
    expect(decryptV1(a, keys)).toBe('walker+1@example.com')
  })

  it('접두 없는 값 · 변조는 던진다', () => {
    expect(() => decryptV1('abc', keys)).toThrow()
    const enc = encryptV1('x@example.com', keys)
    const tampered = `${enc.slice(0, -4)}AAAA`
    expect(() => decryptV1(tampered, keys)).toThrow()
  })
})

describe('키 로드', () => {
  it.each([
    [{}, 'ENCRYPTION'],
    [{ PII_ENCRYPTION_KEY: ENC_B64 }, 'HMAC'],
    [{ PII_ENCRYPTION_KEY: ENC_B64, PII_HMAC_KEY: Buffer.alloc(31).toString('base64') }, 'HMAC'],
  ])('%j → MemberKeysUnavailable(%s)', (env, key) => {
    expect(() => loadMemberKeys(env)).toThrow(MemberKeysUnavailable)
    try {
      loadMemberKeys(env)
    } catch (e) {
      expect((e as MemberKeysUnavailable).key).toBe(key)
    }
  })
})

describe('경계 검증 · 가리기 · 해시', () => {
  it.each([
    ['  Walker+1@Example.com ', 'walker+1@example.com'],
    ['no-at', null],
    ['a@b', null],
    ['a b@example.com', null],
    [`${'a'.repeat(250)}@x.co`, null],
    [42, null],
  ])('parseEmail(%j) = %j', (input, out) => {
    expect(parseEmail(input)).toBe(out)
  })

  it.each([
    ['walker+1@example.com', 'wa***@example.com'],
    ['ab@example.com', 'a***@example.com'],
    ['a@example.com', 'a***@example.com'],
  ])('maskEmail(%s)', (input, out) => {
    expect(maskEmail(input)).toBe(out)
  })

  it('sha256Hex — 키 없는 64자 hex', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})
