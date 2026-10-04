import { describe, expect, it } from 'vitest'
import type { Esim, Order } from '../types/order'
import type { FlowSession } from './flow-session'
import {
  decideRestore,
  decideSelection,
  findProductOrder,
  flowStepOf,
  isFullyIssued,
  parseOrderIdParam,
  pickSelection,
  resolveFlowRedirect,
  type FlowStep,
} from './flow-guard'

const ORDER_ID = 2026092312345678
const OTHER_ORDER_ID = 2026092387654321

const esim = (): Esim => ({
  apn: 'plus',
  manualCode: 'MANUAL',
  smdpAddress: 'smdp.example',
  networkStatus: 'NOT_ACTIVE',
  serviceStatus: 'ACTIVE',
  activationCode: 'LPA:1$smdp.example$MANUAL',
})

const order = (over: Partial<Order> = {}): Order =>
  ({
    orderId: ORDER_ID,
    productOrderId: ORDER_ID + 1,
    quantity: 1,
    esims: [],
    cancelled: false,
    ...over,
  }) as Order

// 판정표의 열
const cases = {
  noOrders: () => ({ orders: null, selected: null }),
  noSelection: () => ({ orders: [order()], selected: null }),
  // 발급된 eSIM 이 있는 취소 상품 — 발급 0 인 취소 상품은 zeroIssued 열이 판정한다(spec S-8 판정 순서)
  cancelled: () => {
    const o = order({ cancelled: true, quantity: 2, esims: [esim()] })
    return { orders: [o], selected: o }
  },
  fullyIssued: () => {
    const o = order({ quantity: 2, esims: [esim(), esim()] })
    return { orders: [o], selected: o }
  },
  zeroIssued: () => {
    const o = order()
    return { orders: [o], selected: o }
  },
  partial: () => {
    const o = order({ quantity: 2, esims: [esim()] })
    return { orders: [o], selected: o }
  },
}

const PASS = null
// 목적지는 spec S-8 · D-8 문자열 그대로 — 구현 함수로 만들지 않는다(미러링 금지)
const V = `/verify/${ORDER_ID}?reason=reverify`
const D = `/details/${ORDER_ID}`

// spec §5 S-8 판정표 — 행: 화면, 열: noOrders · noSelection · cancelled · fullyIssued · zeroIssued · partial
const TABLE: Record<FlowStep, (string | null)[]> = {
  verify: [PASS, PASS, PASS, PASS, PASS, PASS],
  details: [V, PASS, PASS, PASS, PASS, PASS],
  'select-date': [V, D, D, D, PASS, PASS],
  view: [V, D, PASS, PASS, D, PASS],
}

describe('resolveFlowRedirect — 판정표 전 칸', () => {
  const columns = Object.keys(cases) as (keyof typeof cases)[]
  for (const step of Object.keys(TABLE) as FlowStep[]) {
    columns.forEach((column, i) => {
      it(`${step} × ${column} → ${TABLE[step][i] ?? '통과'}`, () => {
        expect(resolveFlowRedirect(step, ORDER_ID, cases[column]())).toBe(TABLE[step][i])
      })
    })
  }
})

describe('resolveFlowRedirect — 판정 순서', () => {
  it('취소 + 발급 0 상품: select-date 는 취소로 · view 는 발급 0 으로 details', () => {
    const o = order({ cancelled: true })
    expect(resolveFlowRedirect('select-date', ORDER_ID, { orders: [o], selected: o })).toBe(D)
    expect(resolveFlowRedirect('view', ORDER_ID, { orders: [o], selected: o })).toBe(D)
  })
})

describe('resolveFlowRedirect — 다른 주문 · 목록 밖 선택', () => {
  it('선택 상품의 주문번호가 다르면 productOrderId 가 같아도 «선택 없음»', () => {
    const mine = order({ esims: [esim()] })
    const impostor = order({ orderId: OTHER_ORDER_ID, esims: [esim()] })
    expect(resolveFlowRedirect('view', ORDER_ID, { orders: [mine], selected: impostor })).toBe(D)
  })

  it('store 목록이 다른 주문이면 «목록 없음» → 본인 확인', () => {
    const other = order({ orderId: OTHER_ORDER_ID, productOrderId: OTHER_ORDER_ID + 1 })
    expect(resolveFlowRedirect('details', ORDER_ID, { orders: [other], selected: other })).toBe(V)
  })

  it('선택 상품이 다른 주문이면 «선택 없음» → details', () => {
    const mine = order()
    const other = order({ orderId: OTHER_ORDER_ID, productOrderId: OTHER_ORDER_ID + 1 })
    expect(resolveFlowRedirect('view', ORDER_ID, { orders: [mine], selected: other })).toBe(D)
  })

  it('선택 상품이 목록에 없으면 «선택 없음» → details', () => {
    const listed = order()
    const stray = order({ productOrderId: ORDER_ID + 99, esims: [esim()] })
    expect(resolveFlowRedirect('view', ORDER_ID, { orders: [listed], selected: stray })).toBe(D)
  })
})

describe('flowStepOf', () => {
  it.each([
    ['/verify/1', 'verify'],
    ['/details/1', 'details'],
    ['/select-date/1?x=1', 'select-date'],
    ['/view/1#qr', 'view'],
  ] as const)('%s → %s', (path, step) => {
    expect(flowStepOf(path)).toBe(step)
  })

  it.each(['/', '/my-esim', '/viewer/1', '/checkout-preview'])('%s → null', (path) => {
    expect(flowStepOf(path)).toBeNull()
  })
})

describe('parseOrderIdParam', () => {
  it('숫자 문자열 → 수', () => {
    expect(parseOrderIdParam('2026092312345678')).toBe(2026092312345678)
    expect(parseOrderIdParam(['2026092312345678'])).toBe(2026092312345678)
  })

  it.each(['abc', 'NaN', '', '0', '-1', '1.5', '12e3', '9007199254740993', undefined, 42])(
    '%j → null',
    (param) => {
      expect(parseOrderIdParam(param)).toBeNull()
    },
  )
})

describe('isFullyIssued', () => {
  it('발급 수 ≥ 수량이면 전량 발급 (수량 0 은 1 로 본다)', () => {
    expect(isFullyIssued({ quantity: 1, esims: [esim()] })).toBe(true)
    expect(isFullyIssued({ quantity: 1, esims: [esim(), esim()] })).toBe(true)
    expect(isFullyIssued({ quantity: 2, esims: [esim()] })).toBe(false)
    expect(isFullyIssued({ quantity: 0, esims: [] })).toBe(false)
  })
})

const session = (over: Partial<FlowSession> = {}): FlowSession => ({
  v: 1,
  orderId: ORDER_ID,
  fullName: '테스트고객',
  phoneNumber: '010-0000-0001',
  ...over,
})

describe('decideRestore — 미들웨어 ③ (spec 불변식: 쿠키 주문번호 ≠ 경로 주문번호 → 쓰지 않는다)', () => {
  it('store 에 이 주문 목록이 있으면 복원하지 않는다', () => {
    expect(decideRestore(session(), ORDER_ID, true)).toBe('use-store')
    expect(decideRestore(null, ORDER_ID, true)).toBe('use-store')
  })

  it('쿠키 없음 → 본인 확인', () => {
    expect(decideRestore(null, ORDER_ID, false)).toBe('reverify')
  })

  it('다른 주문의 쿠키 → 본인 확인 (다른 주문 복원 금지)', () => {
    expect(decideRestore(session({ orderId: OTHER_ORDER_ID }), ORDER_ID, false)).toBe('reverify')
  })

  it('같은 주문의 쿠키 → 복원', () => {
    expect(decideRestore(session(), ORDER_ID, false)).toBe('restore')
  })
})

describe('pickSelection — 미들웨어 ④', () => {
  const a = order({ productOrderId: ORDER_ID + 1 })
  const b = order({ productOrderId: ORDER_ID + 2 })

  it('같은 주문 쿠키의 productOrderId 로 목록에서 고른다', () => {
    expect(pickSelection([a, b], session({ productOrderId: ORDER_ID + 2 }), ORDER_ID)).toBe(b)
  })

  it('다른 주문의 쿠키 · productOrderId 없음 · 목록에 없음 → null', () => {
    expect(
      pickSelection(
        [a, b],
        session({ orderId: OTHER_ORDER_ID, productOrderId: ORDER_ID + 2 }),
        ORDER_ID,
      ),
    ).toBeNull()
    expect(pickSelection([a, b], session(), ORDER_ID)).toBeNull()
    expect(pickSelection([a, b], session({ productOrderId: ORDER_ID + 9 }), ORDER_ID)).toBeNull()
    expect(pickSelection(null, session({ productOrderId: ORDER_ID + 1 }), ORDER_ID)).toBeNull()
  })
})

describe('findProductOrder (D-14 — 위치가 아니라 productOrderId)', () => {
  const a = order({ productOrderId: ORDER_ID + 1 })
  const b = order({ productOrderId: ORDER_ID + 2 })

  it('순서와 무관하게 같은 상품주문을 찾는다', () => {
    expect(findProductOrder([a, b], ORDER_ID + 2)).toBe(b)
    expect(findProductOrder([b, a], ORDER_ID + 1)).toBe(a)
  })

  it('activate 응답 1건 — 요청한 상품이면 그것, 다른 상품이면 null(첫 항목을 집지 않는다)', () => {
    expect(findProductOrder([b], ORDER_ID + 2)).toBe(b)
    expect(findProductOrder([b], ORDER_ID + 1)).toBeNull()
  })

  it('목록 · 번호가 없으면 null', () => {
    expect(findProductOrder(undefined, ORDER_ID + 1)).toBeNull()
    expect(findProductOrder([], ORDER_ID + 1)).toBeNull()
    expect(findProductOrder([a], undefined)).toBeNull()
    expect(findProductOrder([a], null)).toBeNull()
  })
})

describe('decideSelection (details «선택하기» — spec S-8)', () => {
  const PO = ORDER_ID + 1
  const target = order({ productOrderId: PO })

  it('검증 통과 · 상품 있음 · 취소 아님 → 진행(찾은 상품)', () => {
    expect(
      decideSelection({ verified: true, details: [order({ productOrderId: PO + 1 }), target] }, PO),
    ).toEqual({
      kind: 'proceed',
      target,
    })
  })

  it('주문 전체 취소 · 그 상품만 그사이 취소 → 취소 안내', () => {
    expect(decideSelection({ verified: true, cancelled: true, details: [target] }, PO)).toEqual({
      kind: 'cancelled',
    })
    expect(
      decideSelection(
        { verified: true, details: [order({ productOrderId: PO, cancelled: true })] },
        PO,
      ),
    ).toEqual({ kind: 'cancelled' })
  })

  it('검증 실패 · 상품이 응답에 없음 → 주문 없음 안내', () => {
    expect(decideSelection({ verified: false, details: [target] }, PO)).toEqual({ kind: 'missing' })
    expect(
      decideSelection({ verified: true, details: [order({ productOrderId: PO + 1 })] }, PO),
    ).toEqual({
      kind: 'missing',
    })
    expect(decideSelection({ verified: true, details: [] }, PO)).toEqual({ kind: 'missing' })
    // 검증 실패면 취소 여부도 알려 주지 않는다(서버 소유권 원칙과 같다)
    expect(
      decideSelection(
        { verified: false, details: [order({ productOrderId: PO, cancelled: true })] },
        PO,
      ),
    ).toEqual({ kind: 'missing' })
    expect(decideSelection({ verified: false, cancelled: true, details: [target] }, PO)).toEqual({
      kind: 'missing',
    })
  })
})
