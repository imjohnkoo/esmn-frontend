import { describe, expect, it } from 'vitest'
import { isOriginAllowed, parseExtraOrigins } from './cors-origins'

describe('isOriginAllowed', () => {
  it.each([
    'https://esimmany.com',
    'https://app.esimmany.com',
    'https://d3un5i1lmp1eem.cloudfront.net',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:8081',
    'http://localhost:19006',
    'exp://192.168.0.10:8081',
    'http://192.168.0.10:8081',
    'http://10.0.0.5:19000',
  ])('%s 허용', (origin) => {
    expect(isOriginAllowed(origin, [])).toBe(true)
  })

  it.each([
    'https://www.esimmany.com',
    'http://esimmany.com',
    'https://esimmany.com.evil.example',
    'https://evil.example',
    'https://app.esimmany.com:8443',
    'http://192.168.0.10:3000',
  ])('%s 거부', (origin) => {
    expect(isOriginAllowed(origin, [])).toBe(false)
  })

  it('CORS_EXTRA_ORIGINS 로 추가한 origin 은 허용', () => {
    expect(isOriginAllowed('https://preview.example', ['https://preview.example'])).toBe(true)
  })
})

describe('parseExtraOrigins', () => {
  it('쉼표 구분 · 공백 제거 · 빈 값 무시', () => {
    expect(parseExtraOrigins(' https://a.example , ,https://b.example ')).toEqual([
      'https://a.example',
      'https://b.example',
    ])
    expect(parseExtraOrigins(undefined)).toEqual([])
  })
})
