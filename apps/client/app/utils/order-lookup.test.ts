import { describe, expect, it } from 'vitest'
import {
  ORDER_LOOKUP_MESSAGES,
  buildGuestVerifyUrl,
  resolveGuestOrigin,
  normalizeOrderInput,
  validateOrderNumber,
} from './order-lookup'

describe('normalizeOrderInput', () => {
  it('공백 · 하이픈을 지운다', () => {
    expect(normalizeOrderInput(' 2026 0923-1234 5678 ')).toBe('2026092312345678')
  })
})

describe('validateOrderNumber', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['12ab', 'not-digits'],
    ['2026-09-23-가나', 'not-digits'],
    ['123', 'length'],
    ['123456789', 'length'],
    ['12345678901234567', 'length'],
    ['9999999999999999', 'length'],
    ['0012345678', 'length'],
    ['0000000000', 'length'],
  ] as const)('%j → %s', (raw, error) => {
    expect(validateOrderNumber(raw)).toEqual({ ok: false, error })
  })

  it.each([
    ['2026092312345678', '2026092312345678'],
    ['2026 0923-1234 5678', '2026092312345678'],
    ['1234567890', '1234567890'],
  ])('%j → 통과', (raw, orderId) => {
    expect(validateOrderNumber(raw)).toEqual({ ok: true, orderId })
  })

  it('오류마다 문구가 있다', () => {
    expect(ORDER_LOOKUP_MESSAGES.empty).toBe('주문번호를 입력해 주세요.')
    expect(ORDER_LOOKUP_MESSAGES['not-digits']).toBe('주문번호는 숫자만 입력해 주세요.')
    expect(ORDER_LOOKUP_MESSAGES.length).toBe('주문번호 자릿수를 다시 확인해 주세요.')
  })
})

describe('buildGuestVerifyUrl', () => {
  it('발급 호스트의 /verify/{주문번호} (K3)', () => {
    expect(buildGuestVerifyUrl('https://app.esimmany.com', '2026092312345678')).toBe(
      'https://app.esimmany.com/verify/2026092312345678',
    )
  })

  it('끝 슬래시를 정리한다 (로컬 override)', () => {
    expect(buildGuestVerifyUrl('http://localhost:3000/', '1234567890')).toBe(
      'http://localhost:3000/verify/1234567890',
    )
  })
})

describe('resolveGuestOrigin (catalog D-17 — 로컬 walk 가 실호스트로 나가지 않게)', () => {
  const PROD = 'https://app.esimmany.com'

  it.each([
    ['http://127.0.0.1:3006', 'http://127.0.0.1:3006'],
    ['http://127.0.0.2:3006', 'http://127.0.0.2:3006'],
    ['http://0.0.0.0:3006', 'http://0.0.0.0:3006'],
    ['http://localhost:3007', 'http://localhost:3007'],
    ['http://localhost.:3007', 'http://localhost.:3007'],
    ['http://app.localhost:3007', 'http://app.localhost:3007'],
    ['http://[::1]:3006', 'http://[::1]:3006'],
    ['http://[::ffff:127.0.0.1]:3006', 'http://[::ffff:7f00:1]:3006'],
  ])('루프백 %s 에서 열린 페이지 → 자기 출처', (page, want) => {
    expect(resolveGuestOrigin(PROD, page)).toBe(want)
    expect(buildGuestVerifyUrl(resolveGuestOrigin(PROD, page), '2026092312345678')).toBe(
      `${want}/verify/2026092312345678`,
    )
  })

  it.each([
    'https://esimmany.com',
    'https://app.esimmany.com',
    'https://127.0.0.1.example.com',
    'https://localhost.example.com',
    'http://10.0.0.5:3006',
  ])('%s → 설정값 그대로', (page) => {
    expect(resolveGuestOrigin(PROD, page)).toBe(PROD)
  })

  it('출처가 없거나 읽을 수 없으면 설정값', () => {
    expect(resolveGuestOrigin(PROD, undefined)).toBe(PROD)
    expect(resolveGuestOrigin(PROD, 'not a url')).toBe(PROD)
  })
})
