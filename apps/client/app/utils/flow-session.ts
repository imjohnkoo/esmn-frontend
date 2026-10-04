/**
 * 게스트 발급 흐름 쿠키 `nomacom_flow` — 새로고침 · 탭 복원 뒤 4-step 을 이어가기 위한 «본인 확인 통과 상태» (K8 · spec F-15 · D-6).
 *
 * 담는 것: verify 에 사용자가 입력해 통과한 이름 · 전화 + 주문번호 + 선택한 상품주문번호. 그 밖은 금지.
 *   ⛔ activationCode · SM-DP+ · 주문 상세 · 수령인 DB 값을 넣지 않는다 — 화면 데이터는 늘 서버 verify 로 다시 받는다.
 * 속성: Max-Age 1시간(쓸 때마다 갱신) · SameSite=Lax · Secure(dev 제외) · Path=/ · 호스트 한정 — useFlowSession 이 건다.
 * HttpOnly 가 아닌 이유: 클라이언트가 verify 성공 시점에 쓴다. 서버가 쓰려면 API 표면이 늘어난다(John 결정 2026-09-23).
 */

export const FLOW_COOKIE = 'nomacom_flow'
export const FLOW_COOKIE_MAX_AGE = 60 * 60
/** spec 불변식 «직렬화 크기 < 300B» — 넘는 입력(비정상적으로 긴 이름 등)이면 쓰지 않는다(메모리 흐름은 그대로) */
export const FLOW_COOKIE_MAX_BYTES = 299

export interface FlowSession {
  v: 1
  orderId: number
  fullName: string
  phoneNumber: string
  productOrderId?: number
}

export interface FlowSessionInput {
  orderId: number
  fullName: string
  phoneNumber: string
  productOrderId?: number
}

const isPositiveSafeInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0

const isFilledString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

/** 쿠키 값(객체 또는 JSON 문자열) → 검증된 세션. 모양이 틀리면 없는 것으로 본다. 허용 키 밖은 버린다 */
export function parseFlowSession(raw: unknown): FlowSession | null {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const o = value as Record<string, unknown>
  if (o.v !== 1) return null
  if (
    !isPositiveSafeInt(o.orderId) ||
    !isFilledString(o.fullName) ||
    !isFilledString(o.phoneNumber)
  ) {
    return null
  }
  const session: FlowSession = {
    v: 1,
    orderId: o.orderId,
    fullName: o.fullName,
    phoneNumber: o.phoneNumber,
  }
  // productOrderId 는 선택 — 있는데 형식이 틀리면 세션 전체를 없는 것으로 본다(spec F-15)
  if (o.productOrderId !== undefined) {
    if (!isPositiveSafeInt(o.productOrderId)) return null
    session.productOrderId = o.productOrderId
  }
  return session
}

/** useCookie 기본 encode(JSON → encodeURIComponent)와 같은 방식으로 잰 크기 */
export function flowCookieSize(session: FlowSession): number {
  return encodeURIComponent(JSON.stringify(session)).length
}

/** 쓸 세션 만들기 — 입력이 틀리거나 너무 크면 null(쓰지 않음) */
export function buildFlowSession(input: FlowSessionInput): FlowSession | null {
  const session = parseFlowSession({ v: 1, ...input })
  if (!session) return null
  return flowCookieSize(session) <= FLOW_COOKIE_MAX_BYTES ? session : null
}
