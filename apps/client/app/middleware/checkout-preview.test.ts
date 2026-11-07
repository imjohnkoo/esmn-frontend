// 결제 페이지 진입 판정(client-shell spec D-60) — 라우트 미들웨어를 Nuxt 자동 import 대역으로 돌린다.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ITEM = { amount: 9100, optionCode: 'CZE00U02D07V2' }
const LOOKUP = { item: ITEM, zone: 'CZE00' }
const $fetch = vi.fn()
const navigateTo = vi.fn((to: string) => `redirect:${to}`)
const toss = { clientKey: 'test_gck_x' }
const state = { value: undefined as unknown }
const nuxtApp = { isHydrating: false, payload: { serverRendered: true } }
Object.assign(globalThis, {
  $fetch,
  navigateTo,
  defineNuxtRouteMiddleware: (fn: unknown) => fn,
  useNuxtApp: () => nuxtApp,
  useRuntimeConfig: () => ({ public: { toss } }),
  useState: () => state,
})
const middleware = (await import('./checkout-preview')).default as unknown as (to: {
  query: Record<string, unknown>
}) => Promise<unknown>
const OPTION = { query: { option: 'CZE00U02D07V2' } }

beforeEach(() => {
  vi.clearAllMocks()
  toss.clientKey = 'test_gck_x'
  state.value = undefined
  $fetch.mockReset()
  $fetch.mockResolvedValue(LOOKUP)
})

describe('checkout-preview 미들웨어 (D-60)', () => {
  it('테스트 키 + 고른 옵션 → 들어간다 · 상품 값을 넘긴다', async () => {
    expect(await middleware(OPTION)).toBeUndefined()
    expect(state.value).toEqual(ITEM)
    expect($fetch.mock.calls[0]![1]).toEqual({ query: { option: 'CZE00U02D07V2' } })
  })

  it('쿼리가 없으면 코드 없이 묻는다(심사 URL)', async () => {
    expect(await middleware({ query: {} })).toBeUndefined()
    expect($fetch.mock.calls[0]![1]).toEqual({ query: {} })
  })

  it('모르는 코드(404) → 홈 · 상품 값 없음', async () => {
    $fetch.mockRejectedValue({ statusCode: 404 })
    expect(await middleware({ query: { option: 'XXX' } })).toBe('redirect:/')
    expect(state.value).toBeUndefined()
  })

  it('서버 오류는 404 로 덮지 않는다', async () => {
    $fetch.mockRejectedValue({ statusCode: 500 })
    await expect(middleware(OPTION)).rejects.toMatchObject({ statusCode: 500 })
  })

  it.each([
    ['live_ + 고른 옵션', 'live_gck_x', OPTION],
    ['live_ + 쿼리 없음', 'live_gck_x', { query: {} }],
    ['빈 키 + 고른 옵션', '', OPTION],
  ])('%s → 결제를 시작하지 않고 상품 화면으로', async (_n, key, to) => {
    toss.clientKey = key
    expect(await middleware(to)).toBe('redirect:/products/cze00')
    expect(state.value).toBeUndefined()
  })

  it('빈 키 + 쿼리 없음 → 기존 «결제 설정을 준비하고 있어요» 화면', async () => {
    toss.clientKey = ''
    expect(await middleware({ query: {} })).toBeUndefined()
  })
})
