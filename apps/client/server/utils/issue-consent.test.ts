import { describe, expect, it } from 'vitest'
import { ISSUE_CONSENT } from '../../shared/consent/issue-consent'
import { checkIssueConsent, hashIp, viewerIp } from './issue-consent'

// 벡터: key = 바이트 0x00~0x1f, ip 203.0.113.7 — openssl dgst -sha256 -mac HMAC 로 따로 계산한 값(spec §⑦)
const KEY = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='
const VECTOR = '9df8158b5794e6e827f0d42e6fcc4669d49d681d2e048553a0925e6e0a7507a0'

describe('checkIssueConsent', () => {
  it('세 값이 상수와 같으면 ok', () => {
    expect(checkIssueConsent({ ...ISSUE_CONSENT })).toBe('ok')
  })
  it('없으면 missing', () => {
    expect(checkIssueConsent(undefined)).toBe('missing')
    expect(checkIssueConsent(null)).toBe('missing')
    expect(checkIssueConsent('issue-terms')).toBe('missing')
  })
  it('하나라도 다르면 mismatch', () => {
    expect(checkIssueConsent({ ...ISSUE_CONSENT, kind: 'signup-terms' })).toBe('mismatch')
    expect(checkIssueConsent({ ...ISSUE_CONSENT, textVersion: 'issue-D44-v1' })).toBe('mismatch')
    expect(
      checkIssueConsent({ ...ISSUE_CONSENT, textHash: ISSUE_CONSENT.textHash.replace(/.$/, '0') }),
    ).toBe('mismatch')
    expect(checkIssueConsent({})).toBe('mismatch')
  })
})

describe('viewerIp', () => {
  it('X-Forwarded-For 맨 오른쪽 항목(CloudFront 가 붙인 값)', () => {
    expect(viewerIp('198.51.100.9, 203.0.113.7', '10.0.0.5')).toBe('203.0.113.7')
    expect(viewerIp('203.0.113.7', '10.0.0.5')).toBe('203.0.113.7')
    expect(viewerIp('2001:db8::1 , ', undefined)).toBe('2001:db8::1')
  })
  it('헤더가 없거나 비면 소켓 주소 · 둘 다 없으면 null', () => {
    expect(viewerIp(undefined, '10.0.0.5')).toBe('10.0.0.5')
    expect(viewerIp(' , ', '10.0.0.5')).toBe('10.0.0.5')
    expect(viewerIp(undefined, undefined)).toBeNull()
  })
})

describe('hashIp', () => {
  it('HMAC-SHA256 벡터 · 소문자 hex 64자', () => {
    expect(hashIp('203.0.113.7', KEY)).toBe(VECTOR)
  })
  it('키가 없거나 32바이트가 아니면 null(base64 문자열 자체를 키로 쓰지 않는다)', () => {
    expect(hashIp('203.0.113.7', undefined)).toBeNull()
    expect(hashIp('203.0.113.7', '')).toBeNull()
    expect(hashIp('203.0.113.7', Buffer.alloc(31).toString('base64'))).toBeNull()
  })
})
