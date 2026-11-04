// 테스트 체크아웃 confirm 핸들러(client-shell spec F-19 · D-59) — 토스 API 는 fetch 대역 · h3 · Nitro 자동 import 도 대역.
// 실제 토스 승인(테스트 키)은 ⑦ walk 가 본다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const AMOUNT = 4900
const config = { tossSecretKey: 'test_sk_test_only' }
vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
vi.stubGlobal('readBody', async (e: { body: unknown }) => e.body)
vi.stubGlobal('setResponseStatus', (e: { status?: number }, s: number) => {
  e.status = s
})
vi.stubGlobal('useAppConfig', () => ({ checkoutPreview: { amount: AMOUNT } }))
vi.stubGlobal('useRuntimeConfig', () => config)
const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

const timeoutSpy = vi.spyOn(AbortSignal, 'timeout')
type Event = { body: unknown; status?: number }
const handler = (await import('./confirm.post')).default as unknown as (
  e: Event,
) => Promise<unknown>

const ORDER_ID = 'pv-1790105212345-abababababababababababab'
const body = (over: Record<string, unknown> = {}) => ({
  paymentKey: 'tgen_test_key',
  orderId: ORDER_ID,
  amount: AMOUNT,
  ...over,
})
const call = async (b: unknown) => {
  const event: Event = { body: b }
  const res = await handler(event)
  return { status: event.status ?? 200, res }
}
const tossReply = (status: number, json: unknown) =>
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(json), { status }))

beforeEach(() => {
  fetchMock.mockReset()
  config.tossSecretKey = 'test_sk_test_only'
})
afterEach(() => vi.useRealTimers())

describe('confirm.post', () => {
  it('금액이 빌드 주입 금액과 다르면 400 AMOUNT_MISMATCH · 토스 호출 0', async () => {
    expect(await call(body({ amount: AMOUNT + 100 }))).toEqual({
      status: 400,
      res: { code: 'AMOUNT_MISMATCH' },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('시크릿 키가 비면 503 NOT_CONFIGURED · 토스 호출 0', async () => {
    config.tossSecretKey = ''
    expect(await call(body())).toEqual({ status: 503, res: { code: 'NOT_CONFIGURED' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['paymentKey 없음', { paymentKey: undefined }],
    ['paymentKey 200자 초과', { paymentKey: 'k'.repeat(201) }],
    ['orderId 규칙 밖', { orderId: 'pv 1' }],
    ['amount 문자열', { amount: String(AMOUNT) }],
    ['amount 소수', { amount: AMOUNT + 0.5 }],
  ])('본문이 형식에 안 맞으면(%s) 400 INVALID_REQUEST · 토스 호출 0', async (_n, over) => {
    expect(await call(body(over))).toEqual({ status: 400, res: { code: 'INVALID_REQUEST' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('토스가 4xx 를 주면 같은 상태 코드 · {code, message} 그대로', async () => {
    tossReply(404, { code: 'NOT_FOUND_PAYMENT_SESSION', message: '결제 시간이 만료되었습니다.' })
    expect(await call(body())).toEqual({
      status: 404,
      res: { code: 'NOT_FOUND_PAYMENT_SESSION', message: '결제 시간이 만료되었습니다.' },
    })
  })

  it('200 이면 6필드만 돌려준다(카드 · 영수증 · 고객 필드 0) — 요청은 Basic(시크릿:) · JSON 본문 3값', async () => {
    tossReply(200, {
      status: 'DONE',
      orderId: ORDER_ID,
      paymentKey: 'tgen_test_key',
      approvedAt: '2026-11-04T16:00:00+09:00',
      method: '카드',
      totalAmount: AMOUNT,
      card: { number: '43301234****123*' },
      receipt: { url: 'https://example.invalid' },
      customerEmail: 'x@example.invalid',
    })
    expect(await call(body())).toEqual({
      status: 200,
      res: {
        status: 'DONE',
        orderId: ORDER_ID,
        paymentKey: 'tgen_test_key',
        approvedAt: '2026-11-04T16:00:00+09:00',
        method: '카드',
        totalAmount: AMOUNT,
      },
    })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://api.tosspayments.com/v1/payments/confirm')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      Authorization: `Basic ${Buffer.from('test_sk_test_only:').toString('base64')}`,
      'Content-Type': 'application/json',
    })
    expect(JSON.parse(String(init.body))).toEqual({
      paymentKey: 'tgen_test_key',
      orderId: ORDER_ID,
      amount: AMOUNT,
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(timeoutSpy).toHaveBeenCalledWith(10_000)
  })

  it('200 인데 승인 금액이 요청 금액과 다르면 성공으로 돌려주지 않는다(502)', async () => {
    tossReply(200, { status: 'DONE', orderId: ORDER_ID, totalAmount: AMOUNT + 1 })
    expect(await call(body())).toEqual({ status: 502, res: { code: 'AMOUNT_MISMATCH' } })
  })

  it('네트워크 오류 · 타임아웃 · 토스 5xx 는 502 UPSTREAM', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
    expect(await call(body())).toEqual({ status: 502, res: { code: 'UPSTREAM' } })
    tossReply(500, { code: 'FAILED_INTERNAL_SYSTEM_PROCESSING', message: '내부 오류' })
    expect(await call(body())).toEqual({ status: 502, res: { code: 'UPSTREAM' } })
  })
})
