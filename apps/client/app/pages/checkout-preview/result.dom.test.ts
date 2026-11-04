// @vitest-environment happy-dom
// 결제 복귀 화면(client-shell spec F-19 · S-7 · D-59) — success: 이 탭이 만든 주문번호 ∧ 금액 일치일 때만 confirm 1회 · fail: 이 탭이 결제를 시작했을 때만 사유.
// $fetch(Nuxt 전역)는 가짜 — 호출 여부 · 본문만 본다. 실제 토스 승인은 ⑦ walk.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, onMounted, ref } from 'vue'
import { checkoutPreviewFromCatalog } from '#shared/catalog/preview'
import { fixtureRaw } from '#shared/catalog/test-data'
import { parseCatalog } from '#shared/catalog/validate'
import { PENDING_PAYMENT_KEY } from '~/utils/checkout-preview'
import Fail from './fail.vue'
import Success from './success.vue'

const PREVIEW_ITEM = checkoutPreviewFromCatalog(parseCatalog(fixtureRaw()))
const MINE = 'pv-1790105212345-abababababababababababab'
const route: { query: Record<string, string> } = { query: {} }
const $fetch = vi.fn()
const navigateTo = vi.fn()
Object.assign(globalThis, {
  ref,
  computed,
  onMounted,
  definePageMeta: () => {},
  useHead: () => {},
  useRoute: () => route,
  useAppConfig: () => ({ checkoutPreview: PREVIEW_ITEM }),
  $fetch,
  navigateTo,
})

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  route.query = {}
})

const render = async (page: typeof Success) => {
  mount(page, { attachTo: document.body })
  await flushPromises()
}
const textOf = () => (document.body.textContent ?? '').replace(/\s+/g, ' ')
const successQuery = (over: Record<string, string> = {}) => ({
  paymentKey: 'tgen_test_key',
  orderId: MINE,
  amount: String(PREVIEW_ITEM.amount),
  ...over,
})

describe('success 복귀', () => {
  it('다른 탭(또는 링크)의 주문번호 → «이 탭에서 시작한 결제가 아니에요» · confirm 호출 0 · 기억한 주문번호는 그대로', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery({ orderId: 'pv-1-000000000000000000000000' })
    await render(Success)
    expect(textOf()).toContain('이 창에서 시작한 결제가 아니에요. 다시 결제해 주세요.')
    expect($fetch).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(PENDING_PAYMENT_KEY)).toBe(MINE)
  })

  it('이 탭에 시작한 결제가 없으면(새 탭에서 연 링크) confirm 호출 0', async () => {
    route.query = successQuery()
    await render(Success)
    expect(textOf()).toContain('이 창에서 시작한 결제가 아니에요. 다시 결제해 주세요.')
    expect($fetch).not.toHaveBeenCalled()
  })

  it('금액이 심사 품목 금액과 다르면 → «금액이 달라 승인하지 않았어요» · confirm 호출 0', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery({ amount: String(PREVIEW_ITEM.amount - 1) })
    await render(Success)
    expect(textOf()).toContain('결제 금액이 상품 금액과 달라 승인하지 않았어요.')
    expect($fetch).not.toHaveBeenCalled()
  })

  it('둘 다 맞으면 confirm 1회(본문 = 쿼리 3값 · 금액은 숫자) → 승인 표 · 기억한 주문번호를 지운다', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery()
    $fetch.mockResolvedValueOnce({
      status: 'DONE',
      orderId: MINE,
      paymentKey: 'tgen_test_key',
      approvedAt: '2026-11-04T16:00:00+09:00',
      method: '카드',
      totalAmount: PREVIEW_ITEM.amount,
    })
    await render(Success)
    expect($fetch).toHaveBeenCalledTimes(1)
    expect($fetch).toHaveBeenCalledWith('/api/v1/checkout-preview/confirm', {
      method: 'POST',
      body: { paymentKey: 'tgen_test_key', orderId: MINE, amount: PREVIEW_ITEM.amount },
    })
    const rows = [...document.body.querySelectorAll('.pay-result__row')].map((r) =>
      [...r.children].map((c) => (c.textContent ?? '').trim()).join(' '),
    )
    expect(rows).toEqual([
      '상태 승인 완료',
      `주문번호 ${MINE}`,
      '승인 시각 2026. 11. 04 16:00',
      '결제수단 카드',
      `금액 ${PREVIEW_ITEM.amount.toLocaleString('ko-KR')}원`,
    ])
    expect(document.body.querySelector('h1')!.textContent).toBe('결제가 승인됐어요')
    // 원값 DONE 은 화면에 쓰지 않는다
    expect(textOf()).not.toContain('DONE')
    expect(sessionStorage.getItem(PENDING_PAYMENT_KEY)).toBeNull()
  })

  it('confirm 이 거절되면 code · message(80자) — 기억한 주문번호를 지운다', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery()
    $fetch.mockRejectedValueOnce(
      Object.assign(new Error('400'), {
        data: { code: 'NOT_FOUND_PAYMENT_SESSION', message: '가'.repeat(200) },
      }),
    )
    await render(Success)
    expect(document.body.querySelector('h1')!.textContent).toBe('결제하지 못했어요')
    // message 먼저(80자) · code 는 아래 작게
    expect(document.body.querySelector('.pay-result__text')!.firstChild!.textContent!.trim()).toBe(
      '가'.repeat(80),
    )
    expect(textOf()).not.toContain('가'.repeat(81))
    expect(document.body.querySelector('.pay-result__code')!.textContent).toBe(
      '오류 코드 NOT_FOUND_PAYMENT_SESSION',
    )
    expect(sessionStorage.getItem(PENDING_PAYMENT_KEY)).toBeNull()
  })
})

describe('success 복귀 — 나머지 상태', () => {
  it('시크릿 키 미설정(503 NOT_CONFIGURED) → «결제 설정을 준비하고 있어요.»', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery()
    $fetch.mockRejectedValueOnce(
      Object.assign(new Error('503'), { data: { code: 'NOT_CONFIGURED' } }),
    )
    await render(Success)
    expect(textOf()).toContain('결제 설정을 준비하고 있어요.')
  })

  it.each([
    ['다른 창', () => (route.query = successQuery())],
    [
      '금액 불일치',
      () => {
        sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
        route.query = successQuery({ amount: '1' })
      },
    ],
  ])('모든 결과 상태(%s)에 «다시 결제하기» → /checkout-preview', async (_n, arrange) => {
    arrange()
    await render(Success)
    const retry = [...document.body.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('다시 결제하기'),
    )!
    retry.click()
    expect(navigateTo).toHaveBeenCalledWith('/checkout-preview')
  })
})

describe('fail 복귀', () => {
  it('이 탭이 결제를 시작했으면 사유(80자) · code — 기억한 주문번호를 지운다 · 서버 호출 0', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = { code: 'PAY_PROCESS_CANCELED', message: '사용자에 의해 결제가 취소되었습니다.' }
    await render(Fail)
    expect(document.body.querySelector('h1')!.textContent).toBe('결제하지 못했어요')
    expect(textOf()).toContain(
      '사용자에 의해 결제가 취소되었습니다. 오류 코드 PAY_PROCESS_CANCELED',
    )
    expect(sessionStorage.getItem(PENDING_PAYMENT_KEY)).toBeNull()
    expect($fetch).not.toHaveBeenCalled()
  })

  it('이 탭이 시작한 결제가 없으면 쿼리 문구를 그리지 않는다(링크로 만든 임의 문구 차단)', async () => {
    route.query = { code: 'X', message: '가짜 안내 문구' }
    await render(Fail)
    expect(textOf()).toContain('이 창에서 시작한 결제가 아니에요. 다시 결제해 주세요.')
    expect(textOf()).not.toContain('가짜 안내 문구')
  })
})
