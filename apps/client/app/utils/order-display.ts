/**
 * 발급 화면의 상품 구분 표시 (브리프 H-015 · plan `wiki/frontend/plans/client/2026-10-20-client-issue-days-plan.md`). 순수 함수.
 *
 * plan-type 은 같은 zone 의 일수 × 용량 조합마다 `planNameKr` 가 같다 — 한 주문에서 7일권 · 8일권(또는 매일 1기가 · 2기가)을
 * 사면 이름만으로는 상품이 갈리지 않는다. ② 이심 선택 · ③ 사용 시작일 · ④ QR 화면과 QR 파일 이름이 여기 규칙을 쓴다.
 * API 응답 · 저장소 순서는 그대로 두고 화면에서만 정렬 · 표시한다.
 * 남는 경우: 나라 구성이 다른 zone 이 같은 이름을 쓰면(«서유럽3개국» EU031 · EU032 등) 일수 · 용량까지 같을 때 여전히
 * 같아 보인다 — DB 상품명 문제라 여기서 풀지 않는다(H-015 회신).
 */
import type { Order } from '~/types/order'

type PlanFields = Pick<Order, 'planNameKr' | 'planDataDuration' | 'planDataLimitKr'>

/** «8일» — plan-type 이 없는 주문은 verify 가 0 을 주므로 빈 글자 */
export const orderDays = (order: Pick<Order, 'planDataDuration'>): string =>
  order.planDataDuration > 0 ? `${order.planDataDuration}일` : ''

/**
 * 용량 = 표시 문구의 «+» 앞(«매일 2기가 + 무제한 500Kbps» → «매일 2기가» · 종량제 «10기가 종량제» 는 그대로).
 * 소진 뒤 속도 글자는 옮기지 않는다 — DB 문구의 «500Kbps» 가 카피 결정(512kbps)과 다르다. 공백 없는 «+» · 전각 «＋» 도 자른다
 */
export const orderCapacity = (order: Pick<Order, 'planDataLimitKr'>): string =>
  (order.planDataLimitKr ?? '').split(/\s*[+＋]\s*/)[0]!.trim()

const labelParts = (order: PlanFields) =>
  [order.planNameKr, orderDays(order), orderCapacity(order)].filter(Boolean)

/** ③ · ④ 상품 칩 — «동유럽3개국 · 8일 · 매일 2기가» */
export const orderLabel = (order: PlanFields): string => labelParts(order).join(' · ')

/**
 * ④ QR 내려받기 파일 이름 — 칩 글자(띄어쓰기 없앰) + 상품주문번호 + eSIM 번호(아코디언 «eSIM n»).
 * 상품주문번호가 들어가 같은 옵션을 상품주문 둘로 사도 겹치지 않는다. 파일 이름에 못 쓰는 글자는 «-»
 */
export const qrFileName = (
  order: PlanFields & Pick<Order, 'productOrderId'>,
  index: number,
): string => {
  const parts = labelParts(order).map((part) =>
    part.replace(/\s+/g, '').replace(/[\\/:*?"<>|]/g, '-'),
  )
  return `이심마니_${[...parts, order.productOrderId, index + 1].join('_')}.png`
}

/** ② 카드 순서 — 일수 오름차순, 같으면 상품주문번호 오름차순. 새 배열(저장소 순서 = 응답 순서는 그대로) */
export const sortOrdersForDisplay = (orders: readonly Order[]): Order[] =>
  [...orders].sort(
    (a, b) => a.planDataDuration - b.planDataDuration || a.productOrderId - b.productOrderId,
  )
