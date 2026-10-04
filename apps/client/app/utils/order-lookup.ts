/**
 * 주문번호 조회(홈 카드 · /my-esim) — 입력 정규화 · 검증 · 발급 호스트 이동 URL (spec F-9 · D-15).
 *
 * 판매 호스트(esimmany.com)에서 받은 주문번호는 발급 호스트(app.esimmany.com)의 /verify/{주문번호} 로 보낸다(K3).
 * API 가 orderId 를 JS number 로 받으므로 안전 정수 범위를 넘는 번호는 받지 않는다 — 17자리 이상은 다른 번호가 된다.
 */

export type OrderLookupError = 'empty' | 'not-digits' | 'length'

export const ORDER_LOOKUP_MESSAGES: Record<OrderLookupError, string> = {
  empty: '주문번호를 입력해 주세요.',
  'not-digits': '주문번호는 숫자만 입력해 주세요.',
  length: '주문번호 자릿수를 다시 확인해 주세요.',
}

const MIN_DIGITS = 10
const MAX_DIGITS = 16

/** 공백 · 하이픈 제거 (주문 상세에서 복사해 붙인 «2026 0923-1234 5678» 같은 입력) */
export function normalizeOrderInput(raw: string): string {
  return raw.replace(/[\s-]/g, '')
}

export type OrderLookupResult =
  | { ok: true; orderId: string }
  | { ok: false; error: OrderLookupError }

export function validateOrderNumber(raw: string): OrderLookupResult {
  const value = normalizeOrderInput(raw)
  if (!value) return { ok: false, error: 'empty' }
  if (!/^\d+$/.test(value)) return { ok: false, error: 'not-digits' }
  if (value.length < MIN_DIGITS || value.length > MAX_DIGITS) return { ok: false, error: 'length' }
  // 첫 자리 0 은 Number() 가 떼어 자릿수가 줄어든다 · 2^53−1 을 넘으면 정밀도가 깨진다 (spec D-15)
  if (value.startsWith('0') || !Number.isSafeInteger(Number(value))) {
    return { ok: false, error: 'length' }
  }
  return { ok: true, orderId: value }
}

export function buildGuestVerifyUrl(guestAppOrigin: string, orderId: string): string {
  return `${guestAppOrigin.replace(/\/+$/, '')}/verify/${orderId}`
}

/** 루프백 — 127.0.0.0/8 · 0.0.0.0 · localhost(끝 점 · 하위 이름 포함) · ::1 · ::ffff:127.x */
function isLoopback(hostname: string): boolean {
  const h = hostname.replace(/\.$/, '').toLowerCase()
  return (
    /^127(\.\d{1,3}){3}$/.test(h) ||
    h === '0.0.0.0' ||
    h === 'localhost' ||
    h.endsWith('.localhost') ||
    h === '[::1]' ||
    /^\[::ffff:(127\.\d{1,3}\.\d{1,3}\.\d{1,3}|7f[0-9a-f]{2}:[0-9a-f]{1,4})\]$/.test(h)
  )
}

/**
 * 주문번호 조회가 보낼 발급 호스트(catalog D-17) — 프리렌더된 페이지에는 공개 설정(`guestAppOrigin`)이 **빌드 값**으로 굳고,
 * 그 페이지에서 클라이언트 이동한 세션도 그 값을 쓴다. 그래서 루프백 주소(127.0.0.1 · localhost · ::1)에서 열린 페이지면
 * 자기 출처로 보낸다 — 로컬 prod 봉투 walk 가 실호스트(app.esimmany.com)로 나가지 않게(John 09-23 안전 지시).
 * 그 밖의 호스트(esimmany.com · app.esimmany.com)는 설정값 그대로.
 */
// 루프백 페이지에서는 NUXT_PUBLIC_GUEST_APP_ORIGIN 도 쓰지 않는다 — 로컬은 한 서버가 두 호스트 몫을 한다(shell F-9)
export function resolveGuestOrigin(configured: string, pageOrigin: string | undefined): string {
  if (!pageOrigin) return configured
  try {
    const page = new URL(pageOrigin)
    if (isLoopback(page.hostname)) return page.origin
  } catch {
    /* 출처를 못 읽으면 설정값 */
  }
  return configured
}
