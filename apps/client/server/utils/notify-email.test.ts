// backend internal/notify/email 위임(A1 «내부 endpoint 계약» · spec F-4 · F-9) — 경로 · 헤더 · 본문 · 결과 분류
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { emailConfigured, sendMemberEmail } from './notify-email'

const fetchMock = vi.fn()
vi.stubGlobal('$fetch', fetchMock)

beforeEach(() => {
  fetchMock.mockReset()
  process.env.ESIM_MANAGER_INTERNAL_ENDPOINT = 'http://127.0.0.1:9'
  process.env.ESIM_MANAGER_INTERNAL_SECRET = 'test-internal'
})
afterEach(() => {
  delete process.env.ESIM_MANAGER_INTERNAL_ENDPOINT
  delete process.env.ESIM_MANAGER_INTERNAL_SECRET
})

describe('sendMemberEmail', () => {
  it('계약 그대로 부른다 — POST {endpoint}/internal/notify/email · X-Internal-Auth · {kind, to, vars} · 10초', async () => {
    fetchMock.mockResolvedValueOnce({ result: 'SENT', messageId: 'm-1' })
    expect(
      await sendMemberEmail('signup_code', 'walker+1@example.com', { code: '123456' }),
    ).toMatchObject({
      ok: true,
      result: 'SENT',
    })
    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:9/internal/notify/email', {
      method: 'POST',
      headers: { 'X-Internal-Auth': 'test-internal', 'Content-Type': 'application/json' },
      body: { kind: 'signup_code', to: 'walker+1@example.com', vars: { code: '123456' } },
      timeout: 10_000,
    })
  })

  it('202 STUBBED(SES 미설정)도 성공', async () => {
    fetchMock.mockResolvedValueOnce({ result: 'STUBBED' })
    expect(
      await sendMemberEmail('password_reset', 'walker+1@example.com', { resetUrl: 'x' }),
    ).toMatchObject({
      ok: true,
      result: 'STUBBED',
    })
  })

  it('2xx 인데 result 가 SENT · STUBBED 가 아니면 실패(upstreamStatus 200)', async () => {
    fetchMock.mockResolvedValueOnce({ result: 'QUEUED' })
    expect(
      await sendMemberEmail('signup_code', 'walker+1@example.com', { code: '1' }),
    ).toMatchObject({
      ok: false,
      upstreamStatus: 200,
    })
  })

  it.each([
    [{ statusCode: 502 }, 502],
    [{ status: 400 }, 400],
    [new Error('timeout'), null],
  ])('오류 %j → upstreamStatus %j', async (err, status) => {
    fetchMock.mockRejectedValueOnce(err)
    expect(
      await sendMemberEmail('signup_code', 'walker+1@example.com', { code: '1' }),
    ).toMatchObject({
      ok: false,
      upstreamStatus: status,
    })
  })

  it('env 없음 → 부르지 않고 실패(upstreamStatus null) · emailConfigured false', async () => {
    delete process.env.ESIM_MANAGER_INTERNAL_SECRET
    expect(emailConfigured()).toBe(false)
    expect(
      await sendMemberEmail('signup_code', 'walker+1@example.com', { code: '1' }),
    ).toMatchObject({
      ok: false,
      upstreamStatus: null,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
