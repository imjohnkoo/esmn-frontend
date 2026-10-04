/**
 * 흐름 쿠키 `nomacom_flow` 읽기 · 쓰기 (K8 · spec F-15). 규약은 `~/utils/flow-session.ts`.
 *
 * 쓰기는 클라이언트 이벤트에서만(verify 통과 · details 선택 · 취소철회 성공).
 * 서버(SSR 미들웨어)는 읽기만 한다 — 예외: 쿠키 자격이 verify 에서 거절되면 지운다(clear).
 */
import {
  FLOW_COOKIE,
  FLOW_COOKIE_MAX_AGE,
  buildFlowSession,
  parseFlowSession,
  type FlowSession,
  type FlowSessionInput,
} from '~/utils/flow-session'

export function useFlowSession() {
  const cookie = useCookie<FlowSession | null>(FLOW_COOKIE, {
    maxAge: FLOW_COOKIE_MAX_AGE,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    default: () => null,
    // 같은 값을 다시 써도 Set-Cookie 를 다시 내보내 Max-Age 를 갱신한다(기본은 값이 같으면 쓰기 생략 — spec F-15)
    refresh: true,
  })

  const read = (): FlowSession | null => parseFlowSession(cookie.value)

  /** verify 통과 — 새 세션(선택 상품 비움). 너무 크면 쓰지 않고 이전 세션도 지운다 */
  const start = (input: Omit<FlowSessionInput, 'productOrderId'>) => {
    cookie.value = buildFlowSession(input)
  }

  /** 상품 선택 — 같은 주문의 세션이 있을 때만 상품주문번호를 더한다(쓸 때마다 Max-Age 갱신) */
  const select = (orderId: number, productOrderId: number) => {
    const current = read()
    if (!current || current.orderId !== orderId) return
    const next = buildFlowSession({ ...current, productOrderId })
    if (next) cookie.value = next
  }

  const clear = () => {
    cookie.value = null
  }

  return { read, start, select, clear }
}
