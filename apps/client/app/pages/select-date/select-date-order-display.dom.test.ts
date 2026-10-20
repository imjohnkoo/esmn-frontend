// @vitest-environment happy-dom
// 사용 시작일 화면의 상품 칩(브리프 H-015 R2 · plan D-3) — 화면을 실제로 마운트해 첫눈에 어느 상품을 발급하는지
// (이름 · 일수 · 용량) 보이는지 본다. 같은 상품 7일권 · 8일권이면 칩이 갈린다(지금은 이름만이라 같다).
// 진입 가드(order-flow) · 서버 호출은 대역이다 — 화면은 저장소의 선택 상품을 그린다.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useOrderStore } from '~/stores/order'
import type { Order } from '~/types/order'
import SelectDatePage from './[orderId].vue'

vi.mock('~/composables/useApi', () => ({
  useApi: () => ({ verifyOrder: vi.fn(), activateOrder: vi.fn() }),
}))

// Nuxt 자동 import 대신
Object.assign(globalThis, { ref, computed, watch, nextTick, onMounted, onBeforeUnmount })

const ORDER_ID = 2026102000000101

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useRoute', () => ({ params: { orderId: String(ORDER_ID) }, query: {} }))
  vi.stubGlobal('useRouter', () => ({ push: vi.fn() }))
})
afterEach(() => vi.unstubAllGlobals())
enableAutoUnmount(afterEach)

// 화면이 그리는 칸만 — 상품 문구는 plan-type V2 그대로
const order = (over: Partial<Order>) =>
  ({
    orderId: ORDER_ID,
    productOrderId: ORDER_ID + 1,
    quantity: 1,
    planNameKr: '동유럽3개국',
    planDataTypeKr: '무제한 데이터',
    planDataLimitKr: '매일 2기가 + 무제한 500Kbps',
    planDataDuration: 7,
    planCountriesKr: ['오스트리아', '체코', '헝가리'],
    planCountriesEng: ['Austria', 'Czechia', 'Hungary'],
    planCountriesIso: ['AUT', 'CZE', 'HUN'],
    timeZones: ['Europe/Vienna', 'Europe/Prague', 'Europe/Budapest'],
    esims: [],
    ...over,
  }) as Order

const chipValues = async (selected: Order) => {
  useOrderStore().setSingleOrder(selected)
  mount(SelectDatePage, { attachTo: document.body })
  await flushPromises()
  return [...document.body.querySelectorAll('.select-date-page__chip-row .n-info-chip__value')].map(
    (el) => el.textContent?.trim(),
  )
}

describe('③ 사용 시작일 — 상품 칩', () => {
  it.each([
    [7, '동유럽3개국 · 7일 · 매일 2기가'],
    [8, '동유럽3개국 · 8일 · 매일 2기가'],
  ])('%i일권 → 주문번호 · «%s»', async (days, label) => {
    expect(
      await chipValues(order({ productOrderId: ORDER_ID + days, planDataDuration: days })),
    ).toEqual([String(ORDER_ID), label])
  })

  it('같은 일수 · 다른 용량도 칩이 갈린다', async () => {
    expect((await chipValues(order({ planDataLimitKr: '매일 1기가 + 무제한 500Kbps' })))[1]).toBe(
      '동유럽3개국 · 7일 · 매일 1기가',
    )
  })
})
