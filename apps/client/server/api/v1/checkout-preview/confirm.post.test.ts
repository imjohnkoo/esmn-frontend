// 테스트 체크아웃 confirm 핸들러(client-shell spec F-19 · D-59) — 토스 API 는 fetch 대역 · h3 · Nitro 자동 import 도 대역.
// 실제 토스 승인(테스트 키)은 ⑦ walk 가 본다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const AMOUNT = 4900
const config = {
  tossSecretKey: 'test_sk_test_only',
  public: { toss: { clientKey: 'test_ck_test_only' } },
}
vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
vi.stubGlobal('readBody', async (e: { body: unknown }) => e.body)
vi.stubGlobal('setResponseStatus', (e: { status?: number }, s: number) => {
  e.status = s
})
// 서버 카탈로그 대역 — 금액이 다른 옵션 2개(값의 원천 · shell D-60)
const OPTION = 'FRA00U01D07V2'
const OTHER_OPTION = 'CZE00U02D07V2'
const OTHER_AMOUNT = 9100
const opt = (code: string, finalWon: number) => ({
  code,
  cap: 1,
  days: 7,
  name1: 'a',
  name2: 'b',
  finalWon,
})
vi.stubGlobal('useCatalog', async () => ({
  zones: [
    { zone: 'FRA00', label: '프랑스', products: [{ kind: 'U', options: [opt(OPTION, AMOUNT)] }] },
    {
      zone: 'CZE00',
      label: '체코',
      products: [{ kind: 'U', options: [opt(OTHER_OPTION, OTHER_AMOUNT)] }],
    },
  ],
}))
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
  optionCode: OPTION,
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
  config.public.toss.clientKey = 'test_ck_test_only'
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
    ['paymentKey 빈 글자', { paymentKey: '' }],
    ['paymentKey 200자 초과', { paymentKey: 'k'.repeat(201) }],
    ['orderId 가 이 페이지 꼴(pv-{ms}-{hex24})이 아님', { orderId: 'order-0000000001' }],
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
    // 저장 · 발급 호출 0 — 승인 뒤에도 나가는 호출은 토스 confirm 하나뿐이다(spec F-19)
    expect(fetchMock).toHaveBeenCalledTimes(1)
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

  it('토스가 200 인데 본문이 JSON 이 아니면 502 UPSTREAM(500 이 아니다)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>oops</html>', { status: 200 }))
    expect(await call(body())).toEqual({ status: 502, res: { code: 'UPSTREAM' } })
  })

  it('paymentKey 200자는 받는다(경계)', async () => {
    tossReply(404, { code: 'NOT_FOUND_PAYMENT', message: 'x' })
    expect((await call(body({ paymentKey: 'k'.repeat(200) }))).status).toBe(404)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('네트워크 오류 · 타임아웃 · 토스 5xx 는 502 UPSTREAM', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('timeout', 'TimeoutError'))
    expect(await call(body())).toEqual({ status: 502, res: { code: 'UPSTREAM' } })
    tossReply(500, { code: 'FAILED_INTERNAL_SYSTEM_PROCESSING', message: '내부 오류' })
    expect(await call(body())).toEqual({ status: 502, res: { code: 'UPSTREAM' } })
  })

  describe('옵션 코드로 찾은 카탈로그 금액 대조 (shell D-60)', () => {
    const done = (amount: number) =>
      tossReply(200, {
        status: 'DONE',
        orderId: ORDER_ID,
        paymentKey: 'k',
        approvedAt: 'x',
        method: '카드',
        totalAmount: amount,
      })

    it('다른 옵션이면 그 옵션 금액으로 승인한다', async () => {
      done(OTHER_AMOUNT)
      const { status } = await call(body({ optionCode: OTHER_OPTION, amount: OTHER_AMOUNT }))
      expect(status).toBe(200)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toMatchObject({ amount: OTHER_AMOUNT })
    })

    it.each([
      ['다른 옵션의 코드에 심사 품목 금액', { optionCode: OTHER_OPTION, amount: AMOUNT }],
      ['조작한 금액', { amount: 100 }],
      ['모르는 코드', { optionCode: 'XXX00U01D07V2' }],
    ])('%s → 400 AMOUNT_MISMATCH · 토스 호출 0', async (_n, over) => {
      const { status, res } = await call(body(over))
      expect(status).toBe(400)
      expect(res).toEqual({ code: 'AMOUNT_MISMATCH' })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it.each([['live_ck_x'], ['']])(
      '공개 키가 %j 면 승인하지 않는다 — 503 · 토스 호출 0',
      async (key) => {
        config.public.toss.clientKey = key
        const { status, res } = await call(body())
        expect(status).toBe(503)
        expect(res).toEqual({ code: 'NOT_CONFIGURED' })
        expect(fetchMock).not.toHaveBeenCalled()
      },
    )

    it('옵션 코드가 없으면 400 INVALID_REQUEST · 토스 호출 0', async () => {
      const { status, res } = await call(body({ optionCode: undefined }))
      expect(status).toBe(400)
      expect(res).toEqual({ code: 'INVALID_REQUEST' })
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
