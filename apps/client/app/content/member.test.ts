// spec S-2 E-0 경로(QA ⑥ 3회차) · 새 비밀번호 칸 오류(128자 · 코드 포인트)
import { describe, expect, it } from 'vitest'
import { isPurchaseNext, passwordError } from './member'

describe('isPurchaseNext', () => {
  it.each([
    ['/products/fra00', true],
    ['/products/fra00?option=X', true],
    ['/checkout', true],
    ['/checkout?option=X', true],
    ['/checkout/verify', true],
    ['/checkout-preview', false],
    ['/products', false],
    ['/my', false],
  ])('%s → %s', (next, out) => {
    expect(isPurchaseNext(next)).toBe(out)
  })
})

describe('passwordError', () => {
  it('8 ~ 128 코드 포인트만 통과 · 이모지도 한 글자', () => {
    expect(passwordError('1234567')).toBe('8자 이상으로 정해 주세요.')
    expect(passwordError('12345678')).toBe('')
    expect(passwordError('😀'.repeat(128))).toBe('')
    expect(passwordError('😀'.repeat(129))).toBe('128자 이하로 정해 주세요.')
  })
})
