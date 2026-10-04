// order-flow 미들웨어 — 복원 · 이동 동작 (spec F-16 · §5 S-8).
// 대상 미들웨어는 그대로 돌린다. 네트워크(useApi) · 쿠키(useFlowSession) · Nuxt 전역(navigateTo)만 대신하고,
// store 는 실제 Pinia store 를 쓴다.
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Esim, Order } from '../types/order'
import type { FlowSession } from '../utils/flow-session'

const ORDER_ID = 2026092312345678
const OTHER_ORDER_ID = 2026092387654321
const PO_A = ORDER_ID + 1
const PO_B = ORDER_ID + 2

const api = { verifyOrder: vi.fn() }
const cookie: { value: FlowSession | null; cleared: number } = { value: null, cleared: 0 }

vi.mock('~/composables/useApi', () => ({ useApi: () => api }))
vi.mock('~/composables/useFlowSession', () => ({
  useFlowSession: () => ({
    read: () => cookie.value,
    clear: () => {
      cookie.value = null
      cookie.cleared += 1
    },
  }),
}))

vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('navigateTo', (to: string, opts?: { replace?: boolean }) => ({
  redirect: to,
  ...opts,
}))

const { default: orderFlow } = await import('./order-flow')
const { useOrderStore } = await import('../stores/order')

type Route = { path: string; params: Record<string, string> }
const run = (path: string) => {
  const [, step, id] = path.split('/')
  return (orderFlow as unknown as (to: Route) => Promise<unknown>)({
    path,
    params: { orderId: id ?? '' },
  } as Route & { step?: string }).then((result) => result ?? { pass: step })
}

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
    productOrderId: PO_A,
    quantity: 1,
    esims: [],
    cancelled: false,
    ...over,
  }) as Order

const session = (over: Partial<FlowSession> = {}): FlowSession => ({
  v: 1,
  orderId: ORDER_ID,
  fullName: '테스트고객',
  phoneNumber: '01000000000',
  ...over,
})

beforeEach(() => {
  setActivePinia(createPinia())
  api.verifyOrder.mockReset()
  cookie.value = null
  cookie.cleared = 0
})

describe('쿠키 없이 · 다른 주문', () => {
  it('store · 쿠키 모두 없으면 verify 를 부르지 않고 reverify', async () => {
    expect(await run(`/view/${ORDER_ID}`)).toEqual({
      redirect: `/verify/${ORDER_ID}?reason=reverify`,
      replace: true,
    })
    expect(api.verifyOrder).not.toHaveBeenCalled()
  })

  it('쿠키 주문번호가 경로와 다르면 복원하지 않는다 (다른 주문 복원 금지)', async () => {
    cookie.value = session({ orderId: OTHER_ORDER_ID })
    expect(await run(`/details/${ORDER_ID}`)).toEqual({
      redirect: `/verify/${ORDER_ID}?reason=reverify`,
      replace: true,
    })
    expect(api.verifyOrder).not.toHaveBeenCalled()
  })

  it('잘못된 주문번호 → /my-esim · verify 화면은 통과', async () => {
    expect(await run('/view/abc')).toEqual({ redirect: '/my-esim', replace: true })
    // ① 주문번호 검사가 ② verify 통과보다 먼저 — /verify/abc 도 폼이 아니라 /my-esim
    expect(await run('/verify/abc')).toEqual({ redirect: '/my-esim', replace: true })
    expect(await run(`/verify/${ORDER_ID}`)).toEqual({ pass: 'verify' })
  })
})

describe('쿠키로 복원', () => {
  it('verify 를 쿠키의 이름 · 전화 · 경로 주문번호 «그대로» 부른다 (요청 body 불변)', async () => {
    cookie.value = session({ productOrderId: PO_A })
    api.verifyOrder.mockResolvedValue({ verified: true, details: [order({ esims: [esim()] })] })
    await run(`/view/${ORDER_ID}`)
    expect(api.verifyOrder).toHaveBeenCalledTimes(1)
    expect(api.verifyOrder).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      fullName: '테스트고객',
      phoneNumber: '01000000000',
    })
  })

  it('발급된 상품을 보던 view 는 새로고침해도 view 에 남는다 (선택 = 쿠키 productOrderId)', async () => {
    cookie.value = session({ productOrderId: PO_B })
    api.verifyOrder.mockResolvedValue({
      verified: true,
      details: [order({ productOrderId: PO_A }), order({ productOrderId: PO_B, esims: [esim()] })],
    })
    expect(await run(`/view/${ORDER_ID}`)).toEqual({ pass: 'view' })
    const store = useOrderStore()
    expect(store.singleOrder?.productOrderId).toBe(PO_B)
    expect(store.orders).toHaveLength(2)
  })

  it('미발급 상품의 select-date 는 그대로 · 선택 없는 쿠키면 details', async () => {
    cookie.value = session({ productOrderId: PO_A })
    api.verifyOrder.mockResolvedValue({ verified: true, details: [order()] })
    expect(await run(`/select-date/${ORDER_ID}`)).toEqual({ pass: 'select-date' })

    setActivePinia(createPinia())
    cookie.value = session()
    expect(await run(`/select-date/${ORDER_ID}`)).toEqual({
      redirect: `/details/${ORDER_ID}`,
      replace: true,
    })
  })

  it('verify 거절이면 쿠키를 지우고 reverify', async () => {
    cookie.value = session({ productOrderId: PO_A })
    api.verifyOrder.mockResolvedValue({ verified: false })
    expect(await run(`/details/${ORDER_ID}`)).toEqual({
      redirect: `/verify/${ORDER_ID}?reason=reverify`,
      replace: true,
    })
    expect(cookie.cleared).toBe(1)
    expect(useOrderStore().orders).toBeNull()
  })

  it('verify 통과인데 목록이 비면 거절과 같다', async () => {
    cookie.value = session()
    api.verifyOrder.mockResolvedValue({ verified: true, details: [] })
    expect(await run(`/details/${ORDER_ID}`)).toEqual({
      redirect: `/verify/${ORDER_ID}?reason=reverify`,
      replace: true,
    })
    expect(cookie.cleared).toBe(1)
  })

  it('2xx 인데 JSON 이 아닌 응답(CDN 오류 페이지)은 오류 — 쿠키를 남긴다', async () => {
    cookie.value = session()
    api.verifyOrder.mockResolvedValue('<html>error</html>')
    expect(await run(`/details/${ORDER_ID}`)).toEqual({
      redirect: `/verify/${ORDER_ID}?reason=reverify`,
      replace: true,
    })
    expect(cookie.cleared).toBe(0)
  })

  it('verify 오류(네트워크 · 500)면 쿠키는 남기고 reverify', async () => {
    cookie.value = session()
    api.verifyOrder.mockRejectedValue(new Error('500'))
    expect(await run(`/details/${ORDER_ID}`)).toEqual({
      redirect: `/verify/${ORDER_ID}?reason=reverify`,
      replace: true,
    })
    expect(cookie.cleared).toBe(0)
    expect(cookie.value).not.toBeNull()
  })
})

describe('store 에 이미 있으면 (hydration 두 번째 실행 · SPA 이동)', () => {
  it('store 가 다른 주문의 목록이면 쿠키로 이 주문을 복원한다 (목록 교체)', async () => {
    const store = useOrderStore()
    store.setOrders([order({ orderId: OTHER_ORDER_ID, productOrderId: OTHER_ORDER_ID + 1 })])
    cookie.value = session({ productOrderId: PO_A })
    api.verifyOrder.mockResolvedValue({ verified: true, details: [order({ esims: [esim()] })] })
    expect(await run(`/view/${ORDER_ID}`)).toEqual({ pass: 'view' })
    expect(api.verifyOrder).toHaveBeenCalledTimes(1)
    expect(store.orders?.every((o) => o.orderId === ORDER_ID)).toBe(true)
  })

  it('verify 를 다시 부르지 않는다', async () => {
    const store = useOrderStore()
    store.setOrders([order({ esims: [esim()] })])
    store.setSingleOrder(order({ esims: [esim()] }))
    cookie.value = session({ productOrderId: PO_A })
    expect(await run(`/view/${ORDER_ID}`)).toEqual({ pass: 'view' })
    expect(api.verifyOrder).not.toHaveBeenCalled()
  })

  it('store 선택이 다른 주문이면 쿠키 productOrderId 로 다시 고른다 · 목록 밖이면 details', async () => {
    const store = useOrderStore()
    store.setOrders([order({ esims: [esim()] })])
    store.setSingleOrder(order({ orderId: OTHER_ORDER_ID }))
    cookie.value = session({ productOrderId: PO_A })
    expect(await run(`/view/${ORDER_ID}`)).toEqual({ pass: 'view' })
    expect(store.singleOrder?.orderId).toBe(ORDER_ID)

    setActivePinia(createPinia())
    const fresh = useOrderStore()
    fresh.setOrders([order()])
    cookie.value = session({ productOrderId: PO_B })
    expect(await run(`/view/${ORDER_ID}`)).toEqual({
      redirect: `/details/${ORDER_ID}`,
      replace: true,
    })
  })
})
