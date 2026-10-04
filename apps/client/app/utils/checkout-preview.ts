import { computed, reactive } from 'vue'
import { CHECKOUT_NOTICE } from '../content/legal/checkout-notice'

/**
 * 테스트 체크아웃 `/checkout-preview` (K9 · spec F-19) — PG 심사 캡처 전용. 주문 저장 · 발급 · 서버 호출 없음.
 * 상품 값(금액 · 옵션명)은 `#shared/catalog/preview`(빌드 때 K1 에서 계산 · catalog F-12). 이 파일은 결제 ID · 복귀 쿼리.
 */

/** 토스(PortOne 경유) paymentId 규칙: 6~64자 · 영문 · 숫자 · - · _ */
export const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{6,64}$/

/** `pv-{밀리초}-{hex}` — crypto.randomUUID 는 HTTPS 에서만 동작해 getRandomValues 바이트를 받는다 */
export function createPaymentId(now: number, random: Uint8Array): string {
  const hex = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `pv-${now}-${hex}`
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

export type PaymentResult =
  | { status: 'none' }
  | { status: 'success'; paymentId: string }
  | { status: 'failed'; paymentId: string; message: string }

/** 이 탭이 방금 만든 결제 ID — 복귀 쿼리가 이것과 같을 때만 결과를 그린다(링크로 만든 임의 쿼리 무시) */
export const PENDING_PAYMENT_KEY = 'nomacom_checkout_preview_payment'

export const RESULT_MESSAGE_MAX = 80

const first = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value)
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

/**
 * 결제창 복귀 쿼리 해석 — forceRedirect 로 PC · 모바일 모두 `redirectUrl?paymentId=…&code=…&message=…` 로 돌아온다.
 * - `paymentId` 가 형식에 맞고 `expectedPaymentId`(이 탭이 만든 ID)와 같을 때만 결과를 낸다 (spec S-7 · QA ⑥ 반사 텍스트 차단)
 * - code 가 있으면 실패 · 취소. message 는 80자까지, 없으면 pgMessage → code 순
 */
export function readPaymentResult(
  query: Record<string, unknown>,
  expectedPaymentId: string | null,
): PaymentResult {
  const paymentId = text(first(query.paymentId))
  if (!paymentId || !PAYMENT_ID_PATTERN.test(paymentId) || paymentId !== expectedPaymentId) {
    return { status: 'none' }
  }
  const code = text(first(query.code))
  if (!code) return { status: 'success', paymentId }
  const message = text(first(query.message)) ?? text(first(query.pgMessage)) ?? code
  return { status: 'failed', paymentId, message: message.slice(0, RESULT_MESSAGE_MAX) }
}

/** requestPayment 응답(창 없이 끝난 경우 포함)의 5필드 — PortOne PaymentResponse 의 부분 */
export interface PaymentResponseLike {
  paymentId?: string
  code?: string
  message?: string
  pgCode?: string
  pgMessage?: string
}

/**
 * 창 없이 끝난 응답을 복귀 쿼리로 (spec F-19) — 결과 처리는 readPaymentResult 하나로 모은다.
 * 응답에 결제 ID 가 없으면 이 탭이 만든 ID 를 쓴다(결과 줄이 «none» 으로 사라지지 않게).
 */
export function buildReturnQuery(
  response: PaymentResponseLike,
  localPaymentId: string,
): Record<string, string | undefined> {
  return {
    paymentId: response.paymentId || localPaymentId,
    code: response.code,
    message: response.message,
    pgCode: response.pgCode,
    pgMessage: response.pgMessage,
  }
}

/** 동의 · 안내 문구에서 링크([글자](주소))를 떼어 낸다 — 체크 라벨은 글자만, 링크는 따로 새 창(05-B · client-shell spec F-22) */
export function splitConsent(line: string): { label: string; links: { text: string; href: string }[] } {
  const links = [...line.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => ({ text: m[1]!, href: m[2]! }))
  return { label: line.replace(/\s*\[[^\]]+\]\([^)\s]+\)/g, '').trim(), links }
}

export type ConsentKey = 'terms' | 'age' | 'marketing'

export interface ConsentItem {
  key: ConsentKey
  /** 정본 문구의 «(필수)» 머리 — 필수 항목이 모두 체크돼야 결제 버튼이 켜진다 */
  required: boolean
  label: string
  links: { text: string; href: string }[]
  /** 체크 아래 알릴 사항(선택 동의의 항목 · 목적 · 보유) — 없으면 null */
  info: string | null
}

const consentItem = (key: ConsentKey, line: string, info: string | null = null): ConsentItem => {
  const { label, links } = splitConsent(line)
  return Object.freeze({
    key,
    required: label.startsWith('(필수)'),
    label,
    links: Object.freeze(links.map((link) => Object.freeze(link))) as ConsentItem['links'],
    info,
  })
}

/** 05-B 동의 항목(spec F-22) — 화면은 이 목록만 그린다. 문구 · 링크는 생성물(CHECKOUT_NOTICE)에서만. 얼려 둔다(필수 여부를 실행 중에 못 바꾼다) */
export const CONSENT_ITEMS: readonly ConsentItem[] = Object.freeze([
  consentItem('terms', CHECKOUT_NOTICE.terms),
  consentItem('age', CHECKOUT_NOTICE.age),
  consentItem('marketing', CHECKOUT_NOTICE.marketing, CHECKOUT_NOTICE.marketingInfo),
])

/** 처음 값 — 모두 해제(PG 심사 요건 · spec 불변식 «동의 기본 해제») */
export function initialConsent(): Record<ConsentKey, boolean> {
  return Object.fromEntries(CONSENT_ITEMS.map((item) => [item.key, false])) as Record<ConsentKey, boolean>
}

/** 필수 항목이 모두 체크됐는가 — 선택 항목은 결제와 무관 */
export function canPayWith(
  agreed: Readonly<Record<ConsentKey, boolean>>,
  items: readonly ConsentItem[] = CONSENT_ITEMS,
): boolean {
  return items.every((item) => !item.required || agreed[item.key] === true)
}

/** 체크아웃 동의 상태 — 페이지는 이것만 쓴다(항목 · 체크 값 · 결제 조건). 부를 때마다 새 상태 · 처음 값은 모두 해제 */
export function useCheckoutConsent() {
  const agreed = reactive(initialConsent())
  const canPay = computed(() => canPayWith(agreed))
  return { items: CONSENT_ITEMS, agreed, canPay }
}

const privacyHead = splitConsent(CHECKOUT_NOTICE.privacyTitle)

/** 개인정보 수집 · 이용 «안내» — 체크 없음(계약 이행 근거 · 2026-10-01 John (b)). 얼려 둔다(실행 중에 문구 · 링크를 못 바꾼다) */
export const PRIVACY_NOTICE = Object.freeze({
  label: privacyHead.label,
  links: Object.freeze(privacyHead.links.map((link) => Object.freeze(link))),
  info: CHECKOUT_NOTICE.privacyInfo,
})

/** 결제 전 안내 — 제목 + 3줄(환불 기준 · 공제 문장 그대로 — D-28). 얼려 둔다 */
export const BEFORE_NOTICE = Object.freeze({
  title: CHECKOUT_NOTICE.beforeTitle,
  lines: Object.freeze([CHECKOUT_NOTICE.beforeRefund, CHECKOUT_NOTICE.beforeMinor, CHECKOUT_NOTICE.beforeNotify] as const),
})
