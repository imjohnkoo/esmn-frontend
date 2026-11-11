// spec I-10 · D-20 · E2E-2 #7 — 열린 리다이렉트 0
import { describe, expect, it } from 'vitest'
import { safeNext } from './safe-next'

describe('safeNext', () => {
  it.each([
    ['/my', '/my'],
    ['/products/fra00?option=FRA00U01D07V2#plans', '/products/fra00?option=FRA00U01D07V2#plans'],
    ['/my/withdraw', '/my/withdraw'],
  ])('같은 사이트 경로 %j 는 그대로', (raw, out) => {
    expect(safeNext(raw)).toBe(out)
  })

  it.each([
    '//evil.example',
    '///evil.example',
    'https://evil.example',
    'evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '/%09/evil.example',
    '/%5Cevil.example',
    '/%E0%A4%A', // 깨진 퍼센트 인코딩
    '',
    null,
    undefined,
    42,
  ])('%j → /my', (raw) => {
    expect(safeNext(raw)).toBe('/my')
  })

  it('fallback 을 바꿀 수 있다', () => {
    expect(safeNext('//x', '/')).toBe('/')
  })
})
