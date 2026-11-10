// 테스트 체크아웃 결제 승인(client-shell spec F-19 · D-59) — success 복귀 화면이 한 번 부른다.
// 토스 confirm 1회 · 저장 0(DB · 쿠키 · 세션 쓰기 없음). 응답은 승인 확인에 필요한 6필드만 — 카드 · 영수증 · 고객 필드는 싣지 않는다.
// 토스는 결제 요청 전 orderId · amount 를 서버에 저장해 대조하라고 권하지만 이 페이지는 «저장 0»(주문 · 발급 없음)이라
// 옵션 코드로 찾은 서버 카탈로그 금액과의 일치로 대신한다(shell D-60). 코드는 클라이언트가 보낸 값이라 «그 코드의 판매가 = 승인 금액» 까지만 보장한다.
// ponytail: 저장 없는 금액 대조 — Wave 2 실주문은 결제 요청 전 저장 · 대조로 바꾼다(spec §6 비기능).
// 로그는 요청 1건당 결과 요약 한 줄 CHECKOUT_CONFIRM 만 남긴다(TOSSCK-LOG — 운영 확인이 결과별 건수 · DONE 건수를 센다).
// 필드는 result · httpStatus · upstreamStatus · optionCode · amount · ms 뿐 — 시크릿 · Authorization · 카드 · 영수증 · 고객 필드 ·
// paymentKey · orderId · 토스 message 원문 · 요청 본문은 남기지 않는다. optionCode 는 카탈로그에 있는 코드일 때만(클라이언트 임의 글자 0).
import type { H3Event } from 'h3'
import { logEvent } from '../../../utils/issuance-log'
import {
  PAYMENT_ID_PATTERN,
  isTestClientKey,
  previewLookup,
} from '../../../../shared/catalog/preview'

const TOSS_CONFIRM_URL = 'https://api.tosspayments.com/v1/payments/confirm'
const TIMEOUT_MS = 10_000
const PAYMENT_KEY_MAX = 200

type Outcome = { result: unknown; upstreamStatus?: number; optionCode?: string; amount?: number }

const log = (httpStatus: number, started: number, o: Outcome) =>
  logEvent(
    'CHECKOUT_CONFIRM',
    httpStatus >= 500 ? 'error' : httpStatus >= 400 ? 'warn' : 'info',
    'checkout confirm',
    {
      result: o.result,
      httpStatus,
      upstreamStatus: o.upstreamStatus,
      optionCode: o.optionCode,
      amount: o.amount,
      ms: Date.now() - started,
    },
  )

const fail = (
  event: H3Event,
  started: number,
  status: number,
  code: string,
  ctx: Omit<Outcome, 'result'>,
  message?: string,
) => {
  setResponseStatus(event, status)
  log(status, started, { ...ctx, result: code })
  return message === undefined ? { code } : { code, message }
}

export default defineEventHandler(async (event) => {
  const started = Date.now()
  const body = (await readBody(event).catch(() => null)) as Record<string, unknown> | null
  const paymentKey = body?.paymentKey
  const orderId = body?.orderId
  const amount = body?.amount
  const optionCode = body?.optionCode
  if (
    typeof paymentKey !== 'string' ||
    !paymentKey ||
    paymentKey.length > PAYMENT_KEY_MAX ||
    typeof orderId !== 'string' ||
    !PAYMENT_ID_PATTERN.test(orderId) ||
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    typeof optionCode !== 'string'
  )
    return fail(event, started, 400, 'INVALID_REQUEST', {
      amount: Number.isSafeInteger(amount) ? (amount as number) : undefined,
    })

  const lookup = previewLookup(await useCatalog(), optionCode)
  const ctx: Omit<Outcome, 'result'> = { optionCode: lookup ? optionCode : undefined, amount }
  if (!lookup || amount !== lookup.item.amount)
    return fail(event, started, 400, 'AMOUNT_MISMATCH', ctx)

  // test_ 키일 때만 승인한다 — 발급이 없어 실청구가 나면 안 된다(shell D-60)
  const config = useRuntimeConfig(event)
  const secretKey = config.tossSecretKey
  if (!secretKey || !isTestClientKey(config.public.toss.clientKey))
    return fail(event, started, 503, 'NOT_CONFIGURED', ctx)

  let res: Response
  try {
    res = await fetch(TOSS_CONFIRM_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    return fail(event, started, 502, 'UPSTREAM', ctx)
  }
  ctx.upstreamStatus = res.status

  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (res.status >= 400 && res.status < 500) {
    return fail(
      event,
      started,
      res.status,
      typeof data?.code === 'string' ? data.code : 'UPSTREAM',
      ctx,
      typeof data?.message === 'string' ? data.message : '',
    )
  }
  if (!res.ok || !data) return fail(event, started, 502, 'UPSTREAM', ctx)
  // 승인 금액이 요청 금액과 다르면 성공으로 그리지 않는다
  if (data.totalAmount !== amount) return fail(event, started, 502, 'AMOUNT_MISMATCH', ctx)

  log(200, started, { ...ctx, result: data.status })
  return {
    status: data.status,
    orderId: data.orderId,
    paymentKey: data.paymentKey,
    approvedAt: data.approvedAt,
    method: data.method,
    totalAmount: data.totalAmount,
  }
})
