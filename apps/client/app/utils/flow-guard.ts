/**
 * 게스트 발급 4-step 가드 판정 (K8 · spec §5 S-8 판정표) — `app/middleware/order-flow.ts` 가 쓴다. 순수 함수.
 *
 * 판정 순서: 목록 → 선택 → select-date 는 취소 → 전량 발급, view 는 발급 0 만 본다(취소 여부 무관).
 * 판정표 (store 는 복원 시도 뒤 상태 · «선택 취소됨» 열은 발급된 eSIM 이 있는 취소 상품 기준):
 *   화면        | 이 주문 목록 없음 | 선택 없음 | 선택 취소됨 | 선택 전량 발급 | 선택 발급 0
 *   verify      | 통과              | 통과      | 통과        | 통과           | 통과
 *   details     | → verify(reason)  | 통과      | 통과        | 통과           | 통과
 *   select-date | → verify(reason)  | → details | → details   | → details      | 통과
 *   view        | → verify(reason)  | → details | 통과        | 통과           | → details
 */
import type { Order } from '~/types/order'
import type { FlowSession } from '~/utils/flow-session'

export type FlowStep = 'verify' | 'details' | 'select-date' | 'view'

const FLOW_STEPS: readonly FlowStep[] = ['verify', 'details', 'select-date', 'view']

export function flowStepOf(path: string): FlowStep | null {
  const segment = (path.split(/[?#]/)[0] ?? '').split('/')[1] ?? ''
  return (FLOW_STEPS as readonly string[]).includes(segment) ? (segment as FlowStep) : null
}

/** 경로 주문번호 — 숫자만 · 양의 안전 정수만 */
export function parseOrderIdParam(param: unknown): number | null {
  const raw = Array.isArray(param) ? param[0] : param
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value > 0 ? value : null
}

export const reverifyPath = (orderId: number) => `/verify/${orderId}?reason=reverify`
export const detailsPath = (orderId: number) => `/details/${orderId}`

export function isFullyIssued(order: Pick<Order, 'esims' | 'quantity'>): boolean {
  return (order.esims?.length ?? 0) >= (order.quantity || 1)
}

export interface FlowState {
  orders: readonly Order[] | null
  selected: Order | null
}

/** 이 주문의 목록에 들어 있는 선택 상품만 인정한다 (다른 주문 · 목록 밖 상품은 «선택 없음») */
function selectedFor(
  orderId: number,
  orders: readonly Order[],
  selected: Order | null,
): Order | null {
  if (!selected || selected.orderId !== orderId) return null
  return orders.some((order) => order.productOrderId === selected.productOrderId) ? selected : null
}

export function resolveFlowRedirect(
  step: FlowStep,
  orderId: number,
  state: FlowState,
): string | null {
  if (step === 'verify') return null

  const orders = (state.orders ?? []).filter((order) => order.orderId === orderId)
  if (orders.length === 0) return reverifyPath(orderId)
  if (step === 'details') return null

  const selected = selectedFor(orderId, orders, state.selected)
  if (!selected) return detailsPath(orderId)

  if (step === 'select-date') {
    if (selected.cancelled || isFullyIssued(selected)) return detailsPath(orderId)
    return null
  }

  // view — 발급된 eSIM 이 없으면 볼 것이 없다(현행은 «불러오는 중» 에 멈췄다)
  return (selected.esims?.length ?? 0) === 0 ? detailsPath(orderId) : null
}

export type RestoreDecision = 'use-store' | 'restore' | 'reverify'

/**
 * 미들웨어 ③ — store 에 이 주문 목록이 있으면 그대로, 없으면 쿠키로 복원할지 · 본인 확인으로 보낼지.
 * ⛔ 쿠키 주문번호 ≠ 경로 주문번호면 복원하지 않는다(다른 주문 복원 금지 — spec 불변식).
 */
export function decideRestore(
  session: FlowSession | null,
  orderId: number,
  storeHasOrders: boolean,
): RestoreDecision {
  if (storeHasOrders) return 'use-store'
  if (!session || session.orderId !== orderId) return 'reverify'
  return 'restore'
}

/** 미들웨어 ④ — 선택 상품이 store 에 없을 때, 같은 주문의 쿠키 productOrderId 로 목록에서 고른다(없으면 null) */
export function pickSelection(
  orders: readonly Order[] | null,
  session: FlowSession | null,
  orderId: number,
): Order | null {
  if (!session || session.orderId !== orderId || !session.productOrderId) return null
  return orders?.find((order) => order.productOrderId === session.productOrderId) ?? null
}

/** 응답 목록에서 이 상품주문을 productOrderId 로 찾는다(D-14 — 위치로 집지 않는다). 없으면 null */
export function findProductOrder(
  orders: readonly Order[] | null | undefined,
  productOrderId: number | null | undefined,
): Order | null {
  // 엄격 비교 — 다른 판정(pickSelection · selectedFor · 쿠키 검증)과 같다. Drizzle bigint mode:number 라 둘 다 number
  if (productOrderId === null || productOrderId === undefined) return null
  return orders?.find((order) => order.productOrderId === productOrderId) ?? null
}

export type SelectionOutcome =
  | { kind: 'proceed'; target: Order }
  | { kind: 'cancelled' }
  | { kind: 'missing' }

/**
 * details «선택하기» — 새 verify 응답으로 진행 · 취소 안내 · 주문 없음 안내를 가른다 (spec S-8).
 * 목록을 불러온 뒤 그 상품이 취소 요청 상태가 된 경우도 «취소» — 미들웨어가 select-date 를 되돌려 조용히 끝나지 않게.
 */
export function decideSelection(
  response: { verified: boolean; cancelled?: boolean; details?: readonly Order[] | null },
  productOrderId: number | null | undefined,
): SelectionOutcome {
  const target = findProductOrder(response.details, productOrderId)
  if (response.verified && !response.cancelled && target && !target.cancelled) {
    return { kind: 'proceed', target }
  }
  if (response.verified && (response.cancelled || target?.cancelled)) return { kind: 'cancelled' }
  return { kind: 'missing' }
}
