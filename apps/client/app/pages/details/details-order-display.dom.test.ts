// @vitest-environment happy-dom
// 이심 선택 화면의 상품 구분(브리프 H-015 R3 · R6 · plan D-1 · D-2 · D-5 · D-6 · D-7) — 화면을 실제로 마운트해
// «일수가 짧은 상품부터 · 제목 줄 오른쪽 끝 일수 배지 · 메타 줄에는 일수 없음 · 카드 버튼은 그 카드의 상품주문» 을 본다.
// 시나리오는 같은 주문 · 같은 상품 이름 · 같은 용량에 일수만 7 / 8. 화면 순서와 저장소(응답) 순서가 갈라지므로
// 버튼이 목록 위치로 상품을 집으면 옆 상품을 발급 · 철회한다 — 그 대응을 고정한다.
// 진입 가드(order-flow) · 서버 호출은 대역이다 — 화면은 저장소의 주문 목록을 그린다.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { useOrderStore } from '~/stores/order'
import type { Esim, Order } from '~/types/order'
import DetailsPage from './[orderId].vue'

const { api, flow } = vi.hoisted(() => ({
  api: { verifyOrder: vi.fn(), withdrawCancel: vi.fn() },
  flow: { select: vi.fn() },
}))
vi.mock('~/composables/useApi', () => ({ useApi: () => api }))
vi.mock('~/composables/useFlowSession', () => ({ useFlowSession: () => flow }))

// Nuxt 자동 import 대신
Object.assign(globalThis, { ref, computed, nextTick })

const ORDER_ID = 2026102000000101
const router = { push: vi.fn() }

beforeEach(() => {
  setActivePinia(createPinia())
  api.verifyOrder.mockReset()
  api.withdrawCancel.mockReset()
  flow.select.mockReset()
  router.push.mockReset()
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useRoute', () => ({ params: { orderId: String(ORDER_ID) } }))
  vi.stubGlobal('useRouter', () => router)
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
enableAutoUnmount(afterEach)

// 값은 가짜(수령인 · 전화는 할당되지 않는 대역 · LPA 모양) — 상품 문구는 plan-type V2 그대로
const esim = (n: number): Esim => ({
  apn: 'walk',
  manualCode: `FAKE-CODE-${n}`,
  smdpAddress: 'smdp.example.invalid',
  networkStatus: 'NOT_ACTIVE',
  serviceStatus: 'ACTIVE',
  activationCode: `LPA:1$smdp.example.invalid$FAKE-CODE-${n}`,
})
const order = (over: Partial<Order>): Order => ({
  orderId: ORDER_ID,
  productOrderId: ORDER_ID + 1,
  productName: '동유럽3개국 eSIM 무제한 데이터',
  placeOrderDate: new Date('2026-10-20T03:00:00Z'),
  quantity: 1,
  totalPaymentAmount: 0,
  optionManageCode: 'EU033U02D07V2',
  receiverName: '테스트고객',
  receiverPhoneNumber: '010-0000-0001',
  planNameKr: '동유럽3개국',
  planDataTypeKr: '무제한 데이터',
  planDataLimitKr: '매일 2기가 + 무제한 500Kbps',
  planDataDuration: 7,
  planCountriesKr: ['오스트리아', '체코', '헝가리'],
  planCountriesEng: ['Austria', 'Czechia', 'Hungary'],
  planCountriesIso: ['AUT', 'CZE', 'HUN'],
  timeZones: ['Europe/Vienna', 'Europe/Prague', 'Europe/Budapest'],
  startDate: '',
  startTime: 0,
  endDate: '',
  startCountry: '',
  startTimeZone: '',
  planTypeId: 'EU033U02D07V2',
  esims: [],
  cancelled: false,
  cancelWithdrawable: false,
  ...over,
})
const day7 = order({ productOrderId: ORDER_ID + 1, planDataDuration: 7 })
const day8 = order({
  productOrderId: ORDER_ID + 2,
  planDataDuration: 8,
  optionManageCode: 'EU033U02D08V2',
})
// 다른 상품의 취소 요청(철회 가능) — 일수가 가장 길어 화면에서는 맨 아래
const fra10 = order({
  productOrderId: ORDER_ID + 3,
  planNameKr: '프랑스',
  planDataLimitKr: '매일 1기가 + 무제한 500Kbps',
  planDataDuration: 10,
  planCountriesKr: ['프랑스'],
  cancelled: true,
  cancelWithdrawable: true,
})

const render = async (orders: Order[]) => {
  useOrderStore().setOrders(orders)
  const w = mount(DetailsPage, { attachTo: document.body })
  await flushPromises()
  return w
}
const cards = () => [...document.body.querySelectorAll<HTMLElement>('.details-page__card')]
const text = (el: Element | null | undefined) => el?.textContent?.replace(/\s+/g, ' ').trim() ?? ''
const badgeOf = (card: HTMLElement) => card.querySelector('.details-page__plan .n-badge')
const buttonOf = (card: HTMLElement, label: string) =>
  [...card.querySelectorAll<HTMLButtonElement>('button')].find((b) => text(b) === label)

describe('② 이심 선택 — 같은 상품 7일권 · 8일권', () => {
  it('저장소가 8일권 → 7일권이어도 카드는 7일권 → 8일권(저장소 순서는 그대로)', async () => {
    await render([day8, day7])
    expect(cards().map((c) => text(badgeOf(c)))).toEqual(['7일', '8일'])
    expect(useOrderStore().orders?.map((o) => o.productOrderId)).toEqual([
      day8.productOrderId,
      day7.productOrderId,
    ])
  })

  it('일수 배지는 제목 줄 끝(이름 뒤) · 메타 줄에는 일수가 없다', async () => {
    await render([day8, day7])
    for (const card of cards()) {
      const title = card.querySelector('.details-page__plan')!
      expect(title.lastElementChild).toBe(badgeOf(card))
      expect(text(title)).toMatch(/^동유럽3개국 [78]일$/)
      expect(text(card.querySelector('.details-page__meta'))).toBe(
        '무제한 데이터 · 매일 2기가 + 무제한 500Kbps',
      )
    }
  })

  it('첫 카드(7일권) «선택하기» → 7일권으로 판정 · 흐름 쿠키 · 사용 시작일 화면', async () => {
    api.verifyOrder.mockResolvedValue({ verified: true, cancelled: false, details: [day8, day7] })
    await render([day8, day7])
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    buttonOf(cards()[0]!, '선택하기')!.click()
    await vi.advanceTimersByTimeAsync(1500)
    await flushPromises()
    expect(api.verifyOrder).toHaveBeenCalledWith({
      orderId: ORDER_ID,
      phoneNumber: day7.receiverPhoneNumber,
      fullName: day7.receiverName,
    })
    expect(flow.select).toHaveBeenCalledWith(ORDER_ID, day7.productOrderId)
    expect(useOrderStore().singleOrder?.productOrderId).toBe(day7.productOrderId)
    expect(router.push).toHaveBeenCalledWith(`/select-date/${ORDER_ID}`)
  })

  it('«취소철회» 는 그 카드의 상품주문을 철회한다(화면 맨 아래 · 저장소 맨 앞)', async () => {
    api.withdrawCancel.mockResolvedValue({})
    api.verifyOrder.mockResolvedValue({
      verified: true,
      cancelled: false,
      details: [{ ...fra10, cancelled: false, cancelWithdrawable: false }, day8, day7],
    })
    await render([fra10, day8, day7])
    const last = cards()[2]!
    expect(text(last.querySelector('.details-page__plan'))).toBe('프랑스 10일')
    buttonOf(last, '취소철회')!.click()
    await flushPromises()
    ;[...document.body.querySelectorAll<HTMLButtonElement>('button')]
      .find((b) => text(b) === '철회하기')!
      .click()
    await flushPromises()
    expect(api.withdrawCancel).toHaveBeenCalledTimes(1)
    expect(api.withdrawCancel.mock.calls[0]![0].productOrderId).toBe(fra10.productOrderId)
    expect(flow.select).toHaveBeenCalledWith(ORDER_ID, fra10.productOrderId)
    expect(router.push).toHaveBeenCalledWith(`/select-date/${ORDER_ID}`)
  })
})

describe('② 그대로인 것(R6)', () => {
  it('발급완료 «QR 코드 보기» · 부분 발급 «이어서 발급하기» · 취소 카드 · 수량', async () => {
    await render([{ ...day8, quantity: 2, esims: [esim(1)] }, { ...day7, esims: [esim(2)] }, fra10])
    const [c7, c8, cFra] = cards()
    expect(text(c7!.querySelector('.n-status-pill'))).toBe('발급완료')
    expect(buttonOf(c7!, 'QR 코드 보기')).toBeTruthy()
    expect(text(c8!.querySelector('.n-status-pill'))).toBe('발급 미완료')
    expect(buttonOf(c8!, '이어서 발급하기')).toBeTruthy()
    expect(text(c8!.querySelector('.details-page__qty strong'))).toBe('2개')
    expect(text(cFra!.querySelector('.n-status-pill'))).toBe('주문취소')
    expect(buttonOf(cFra!, '취소된 주문')?.disabled).toBe(true)
    expect(buttonOf(cFra!, '취소철회')).toBeTruthy()
  })

  it('상품주문 1건 — 카드 한 장에 배지', async () => {
    await render([day7])
    expect(cards()).toHaveLength(1)
    expect(text(badgeOf(cards()[0]!))).toBe('7일')
  })

  it('plan-type 이 없는 주문(일수 0)은 배지를 그리지 않는다', async () => {
    await render([order({ planNameKr: '', planDataDuration: 0, planDataLimitKr: '' })])
    expect(badgeOf(cards()[0]!)).toBeNull()
  })
})
