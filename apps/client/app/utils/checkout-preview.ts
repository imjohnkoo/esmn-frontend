import { computed, reactive } from 'vue'
import { CHECKOUT_NOTICE } from '../content/legal/checkout-notice'
import { PAYMENT_ID_PATTERN } from '#shared/catalog/preview'

/**
 * 테스트 체크아웃 `/checkout-preview` (K9 · spec F-19 · D-59) — PG 심사 캡처 전용. 주문 저장 · 발급 없음 · 서버는 결제 confirm 1회.
 * 상품 값(금액 · 옵션명)은 `#shared/catalog/preview`(빌드 때 K1 에서 계산 · catalog F-12). 이 파일은 주문번호 · 복귀 쿼리 · 탭 기억.
 */

export { PAYMENT_ID_PATTERN }

/** `pv-{밀리초}-{hex}` — crypto.randomUUID 는 HTTPS 에서만 동작해 getRandomValues 바이트를 받는다 */
export function createPaymentId(now: number, random: Uint8Array): string {
  const hex = Array.from(random, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `pv-${now}-${hex}`
}

export function formatWon(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`
}

/** 이 탭이 방금 만든 주문번호 — 복귀 화면은 이것과 같을 때만 결과를 그리고 confirm 을 부른다(링크로 만든 임의 쿼리 무시) */
export const PENDING_PAYMENT_KEY = 'nomacom_checkout_preview_payment'

export const RESULT_MESSAGE_MAX = 80

/** sessionStorage 가 막힌 브라우저 — 읽기는 null · 쓰기 · 지우기는 조용히 넘긴다(복귀 화면이 «이 탭에서 시작한 결제가 아니에요» 로 끝난다) */
export function readPendingPayment(): string | null {
  try {
    return sessionStorage.getItem(PENDING_PAYMENT_KEY)
  } catch {
    return null
  }
}
export function writePendingPayment(orderId: string): void {
  try {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, orderId)
  } catch {
    /* 저장이 막힌 브라우저 */
  }
}
export function clearPendingPayment(): void {
  try {
    sessionStorage.removeItem(PENDING_PAYMENT_KEY)
  } catch {
    /* 저장이 막힌 브라우저 */
  }
}

const first = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value)
const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

export const PAYMENT_KEY_MAX = 200

export interface SuccessReturn {
  paymentKey: string
  orderId: string
  amount: number
}

/**
 * success 복귀 쿼리 — paymentKey · orderId 가 형식에 맞을 때만(아니면 null). 금액은 정수 글자가 아니면 NaN —
 * 금액 대조(spec F-19 «Number(amount) ≠ 품목 금액 → 승인하지 않음»)는 판정(`judgeSuccessReturn`)의 몫
 */
export function readSuccessReturn(query: Record<string, unknown>): SuccessReturn | null {
  const paymentKey = text(first(query.paymentKey))
  const orderId = text(first(query.orderId))
  const amountText = text(first(query.amount))
  if (!paymentKey || paymentKey.length > PAYMENT_KEY_MAX) return null
  if (!orderId || !PAYMENT_ID_PATTERN.test(orderId)) return null
  return {
    paymentKey,
    orderId,
    amount: amountText && /^\d{1,12}$/.test(amountText) ? Number(amountText) : NaN,
  }
}

/**
 * success 화면 판정(spec F-19 · S-7) — ① 이 탭이 만든 주문번호가 아니면(쿼리 형식 오류 포함) `foreign`
 * ② 금액이 심사 품목 금액과 다르면 `amount` — 두 경우 서버를 부르지 않는다 ③ 둘 다 맞으면 `confirm`
 */
export function judgeSuccessReturn(
  ret: SuccessReturn | null,
  pendingOrderId: string | null,
  expectedAmount: number,
): 'foreign' | 'amount' | 'confirm' {
  if (!ret || !pendingOrderId || ret.orderId !== pendingOrderId) return 'foreign'
  if (ret.amount !== expectedAmount) return 'amount'
  return 'confirm'
}

/** fail 복귀 쿼리 · confirm 오류 — 사유는 80자까지. message 가 없으면 한국어 대체 문장(첫 줄이 영문 코드가 되지 않게 — 디자인 리뷰 TOSSCK) */
export function readFailReason(
  query: Record<string, unknown>,
  fallbackMessage: string,
): { code: string; message: string } {
  const code = text(first(query.code)) ?? 'UNKNOWN'
  const message = text(first(query.message)) ?? fallbackMessage
  return { code: code.slice(0, RESULT_MESSAGE_MAX), message: message.slice(0, RESULT_MESSAGE_MAX) }
}

export const FAIL_FALLBACK_MESSAGE = '결제가 완료되지 않았어요.'
export const CONFIRM_FALLBACK_MESSAGE = '승인 결과를 확인하지 못했어요.'
/** confirm 이 200 이어도 상태가 DONE 이 아니면(가상계좌 입금 대기 등) 승인으로 그리지 않는다 */
export const NOT_DONE_MESSAGE = '결제가 아직 완료되지 않았어요.'

/** confirm 라우트 응답(200) — 카드 · 영수증 · 고객 필드는 서버가 걸러 싣지 않는다 */
export interface ConfirmedPayment {
  status: string
  orderId: string
  paymentKey: string
  approvedAt: string
  method: string
  totalAmount: number
}

/** 승인 시각 `YYYY. MM. DD HH:mm` — 화면 날짜는 Asia/Seoul 고정(hydration 일치 · apps/client 규약) */
export function formatApprovedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  )
  return `${parts.year}. ${parts.month}. ${parts.day} ${parts.hour}:${parts.minute}`
}

/** confirm 이 시크릿 키 미설정(503)으로 막혔을 때 — 체크아웃 페이지 «키 비면» 안내와 같은 문장 */
export const NOT_CONFIGURED_MESSAGE = '결제 설정을 준비하고 있어요.'

/** 동의 · 안내 문구에서 링크([글자](주소))를 떼어 낸다 — 체크 라벨은 글자만, 링크는 따로 새 창(05-B · client-shell spec F-22) */
export function splitConsent(line: string): {
  label: string
  links: { text: string; href: string }[]
} {
  const links = [...line.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)].map((m) => ({
    text: m[1]!,
    href: m[2]!,
  }))
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
  return Object.fromEntries(CONSENT_ITEMS.map((item) => [item.key, false])) as Record<
    ConsentKey,
    boolean
  >
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
  lines: Object.freeze([
    CHECKOUT_NOTICE.beforeRefund,
    CHECKOUT_NOTICE.beforeMinor,
    CHECKOUT_NOTICE.beforeNotify,
  ] as const),
})
