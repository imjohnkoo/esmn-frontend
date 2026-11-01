import { describe, expect, it } from 'vitest'
import { issueFailureView } from './issue-failure'

// h3 오류 응답 본문을 받은 $fetch 오류 모양
const fetchError = (statusCode: number, data?: unknown) => ({
  statusCode,
  data: { statusCode, message: 'x', data },
})

describe('issueFailureView — ST-4 기록 실패 · 다시 시도(spec D-21)', () => {
  it('동의 400 · 기록 500 → consent-retry', () => {
    expect(issueFailureView(fetchError(400, { code: 'CONSENT_REQUIRED' }))).toBe('consent-retry')
    expect(issueFailureView(fetchError(500, { code: 'CONSENT_LOG_FAILED' }))).toBe('consent-retry')
  })
  it('그 밖(provider 400 · 404 · 발급 500 · 모르는 code · 네트워크 · null) → order-missing', () => {
    expect(issueFailureView(fetchError(400))).toBe('order-missing')
    expect(issueFailureView(fetchError(404))).toBe('order-missing')
    expect(issueFailureView(fetchError(500))).toBe('order-missing')
    expect(issueFailureView(fetchError(500, { code: 'SPARK_DOWN' }))).toBe('order-missing')
    expect(issueFailureView(new TypeError('Failed to fetch'))).toBe('order-missing')
    expect(issueFailureView(null)).toBe('order-missing')
  })
})
