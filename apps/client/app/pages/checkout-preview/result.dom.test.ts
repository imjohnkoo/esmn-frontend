// @vitest-environment happy-dom
// 결제 복귀 화면(client-shell spec F-19 · S-7 · D-59) — success: 이 탭이 만든 주문번호 ∧ 금액 일치일 때만 confirm 1회 · fail: 이 탭이 결제를 시작했을 때만 사유.
// $fetch(Nuxt 전역)는 가짜 — 호출 여부 · 본문만 본다. 실제 토스 승인은 ⑦ walk.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, onMounted, ref } from 'vue'
import { checkoutPreviewFromCatalog } from '#shared/catalog/preview'
import { fixtureRaw } from '#shared/catalog/test-data'
import { parseCatalog } from '#shared/catalog/validate'
import { PENDING_ITEM_KEY, PENDING_PAYMENT_KEY } from '~/utils/checkout-preview'
import Fail from './fail.vue'
import Success from './success.vue'

const PREVIEW_ITEM = checkoutPreviewFromCatalog(parseCatalog(fixtureRaw()))
const PENDING_ITEM = { optionCode: PREVIEW_ITEM.optionCode, amount: PREVIEW_ITEM.amount }
const MINE = 'pv-1790105212345-abababababababababababab'
const route: { query: Record<string, string> } = { query: {} }
const $fetch = vi.fn()
const navigateTo = vi.fn()
const toss = { clientKey: 'test_ck_test_only' }
Object.assign(globalThis, {
  ref,
  computed,
  onMounted,
  definePageMeta: () => {},
  useHead: () => {},
  useRoute: () => route,
  useRuntimeConfig: () => ({ public: { toss } }),
  $fetch,
  navigateTo,
})

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  sessionStorage.clear()
  // 이 탭이 결제를 요청한 옵션(index.vue 가 적는다 · shell D-60)
  sessionStorage.setItem(PENDING_ITEM_KEY, JSON.stringify(PENDING_ITEM))
  route.query = {}
  toss.clientKey = 'test_ck_test_only'
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
    expect(sessionStorage.getItem(PENDING_PAYMENT_KEY)).toBeNull()
  })

  it('금액 글자가 정수가 아니면(4900.5 · abc) 이 창의 결제라도 «금액이 달라» · confirm 호출 0', async () => {
    for (const amount of ['4900.5', 'abc']) {
      sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
      route.query = successQuery({ amount })
      await render(Success)
      expect(textOf()).toContain('결제 금액이 상품 금액과 달라 승인하지 않았어요.')
      document.body.innerHTML = ''
    }
    expect($fetch).not.toHaveBeenCalled()
  })

  it('둘 다 맞으면 confirm 1회(본문 = 쿼리 3값 · 금액은 숫자) → 승인 표 · 테스트 키면 «청구되지 않아요» · 기억한 주문번호를 지운다', async () => {
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
      body: {
        paymentKey: 'tgen_test_key',
        orderId: MINE,
        amount: PREVIEW_ITEM.amount,
        optionCode: PREVIEW_ITEM.optionCode,
      },
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
    expect(textOf()).toContain('테스트 결제라 실제로 청구되지 않아요.')
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
  it('confirm 은 주문번호를 지운 **뒤** 부른다 — 진행 중 새로고침(다시 마운트)은 confirm 을 다시 부르지 않고 «이 창 아님»', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery()
    let storedAtCall: string | null = 'unset'
    $fetch.mockImplementation(() => {
      storedAtCall = sessionStorage.getItem(PENDING_PAYMENT_KEY)
      return new Promise(() => {}) // 진행 중
    })
    await render(Success)
    expect(storedAtCall).toBeNull()
    await render(Success) // 새로고침
    expect($fetch).toHaveBeenCalledTimes(1)
    expect(textOf()).toContain('이 창에서 시작한 결제가 아니에요.')
    $fetch.mockReset()
  })

  it('confirm 200 이어도 상태가 DONE 이 아니면(가상계좌 입금 대기) 승인으로 그리지 않는다 — 원값은 오류 코드 줄에만', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery()
    $fetch.mockResolvedValueOnce({
      status: 'WAITING_FOR_DEPOSIT',
      orderId: MINE,
      paymentKey: 'tgen_test_key',
      approvedAt: null,
      method: '가상계좌',
      totalAmount: PREVIEW_ITEM.amount,
    })
    await render(Success)
    expect(document.body.querySelector('h1')!.textContent).toBe('결제하지 못했어요')
    expect(textOf()).toContain('결제가 아직 완료되지 않았어요.')
    expect(textOf()).not.toContain('승인됐어요')
    expect(textOf()).not.toContain('1970')
    expect(document.body.querySelector('.pay-result__code')!.textContent).toBe(
      '오류 코드 WAITING_FOR_DEPOSIT',
    )
  })

  it('라이브 키(test_ 아님)면 «테스트 결제라 실제로 청구되지 않아요» 를 그리지 않는다', async () => {
    toss.clientKey = 'live_ck_x'
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery()
    $fetch.mockResolvedValueOnce({
      status: 'DONE',
      orderId: MINE,
      paymentKey: 'k',
      approvedAt: '2026-11-04T16:00:00+09:00',
      method: '카드',
      totalAmount: PREVIEW_ITEM.amount,
    })
    await render(Success)
    expect(document.body.querySelector('h1')!.textContent).toBe('결제가 승인됐어요')
    expect(textOf()).not.toContain('청구되지 않아요')
  })

  it('message 없는 오류(502 UPSTREAM · 네트워크)는 한국어 문장이 먼저 · 코드는 아래', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery()
    $fetch.mockRejectedValueOnce(Object.assign(new Error('502'), { data: { code: 'UPSTREAM' } }))
    await render(Success)
    expect(document.body.querySelector('.pay-result__text')!.firstChild!.textContent!.trim()).toBe(
      '승인 결과를 확인하지 못했어요.',
    )
    expect(document.body.querySelector('.pay-result__code')!.textContent).toBe('오류 코드 UPSTREAM')
  })

  it('시크릿 키 미설정(503 NOT_CONFIGURED) → «결제 설정을 준비하고 있어요.»', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery()
    $fetch.mockRejectedValueOnce(
      Object.assign(new Error('503'), { data: { code: 'NOT_CONFIGURED' } }),
    )
    await render(Success)
    expect(textOf()).toContain('결제 설정을 준비하고 있어요.')
  })

  const DONE = {
    status: 'DONE',
    orderId: MINE,
    paymentKey: 'k',
    approvedAt: '2026-11-04T16:00:00+09:00',
    method: '카드',
    totalAmount: PREVIEW_ITEM.amount,
  }
  const mine = (over: Record<string, string> = {}) => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = successQuery(over)
  }
  it.each([
    ['success 다른 창', Success, () => (route.query = successQuery())],
    ['success 금액 불일치', Success, () => mine({ amount: '1' })],
    ['success 승인 완료', Success, () => (mine(), $fetch.mockResolvedValueOnce(DONE))],
    [
      'success DONE 아님',
      Success,
      () => (mine(), $fetch.mockResolvedValueOnce({ ...DONE, status: 'WAITING_FOR_DEPOSIT' })),
    ],
    [
      'success confirm 오류',
      Success,
      () => (
        mine(),
        $fetch.mockRejectedValueOnce(Object.assign(new Error('x'), { data: { code: 'UPSTREAM' } }))
      ),
    ],
    [
      'fail 사유',
      Fail,
      () => (sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE), (route.query = { code: 'C' })),
    ],
    ['fail 다른 창', Fail, () => (route.query = { code: 'C' })],
  ] as const)(
    '모든 결과 상태(%s)에 «다시 결제하기» → /checkout-preview',
    async (_n, page, arrange) => {
      arrange()
      await render(page)
      const retry = [...document.body.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('다시 결제하기'),
      )!
      retry.click()
      expect(navigateTo).toHaveBeenCalledWith(`/checkout-preview?option=${PREVIEW_ITEM.optionCode}`)
    },
  )
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

  it('message 가 없으면 «결제가 완료되지 않았어요.» 가 먼저 · 코드는 아래', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    route.query = { code: 'PAY_PROCESS_ABORTED' }
    await render(Fail)
    expect(document.body.querySelector('.pay-result__text')!.firstChild!.textContent!.trim()).toBe(
      '결제가 완료되지 않았어요.',
    )
  })

  it('이 탭이 시작한 결제가 없으면 쿼리 문구를 그리지 않는다(링크로 만든 임의 문구 차단)', async () => {
    route.query = { code: 'X', message: '가짜 안내 문구' }
    await render(Fail)
    expect(textOf()).toContain('이 창에서 시작한 결제가 아니에요. 다시 결제해 주세요.')
    expect(textOf()).not.toContain('가짜 안내 문구')
  })
})

describe('고른 옵션 복귀 (shell D-60)', () => {
  const OTHER = { optionCode: 'CZE00L10D30V2', amount: PREVIEW_ITEM.amount + 4200 }
  const retryButton = () =>
    [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('다시 결제하기'))!

  it('다른 옵션이면 그 금액 · 코드로 confirm 을 부른다', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    sessionStorage.setItem(PENDING_ITEM_KEY, JSON.stringify(OTHER))
    route.query = successQuery({ amount: String(OTHER.amount) })
    $fetch.mockResolvedValueOnce({
      status: 'DONE',
      orderId: MINE,
      paymentKey: 'k',
      approvedAt: '2026-11-07T00:00:00+09:00',
      method: '카드',
      totalAmount: OTHER.amount,
    })
    await render(Success)
    expect($fetch.mock.calls[0]![1].body).toMatchObject(OTHER)
    expect(textOf()).toContain('결제가 승인됐어요')
  })

  it('금액 쿼리가 이 탭이 요청한 금액과 다르면 confirm 호출 0', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    sessionStorage.setItem(PENDING_ITEM_KEY, JSON.stringify(OTHER))
    route.query = successQuery()
    await render(Success)
    expect($fetch).not.toHaveBeenCalled()
    expect(textOf()).toContain('결제 금액이 상품 금액과 달라 승인하지 않았어요.')
  })

  it.each([
    ['없음', null],
    ['깨진 값', '{"optionCode":1'],
  ])('이 탭 옵션 기록이 %s → 승인하지 않는다 · confirm 호출 0', async (_n, stored) => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    if (stored === null) sessionStorage.removeItem(PENDING_ITEM_KEY)
    else sessionStorage.setItem(PENDING_ITEM_KEY, stored)
    route.query = successQuery()
    await render(Success)
    expect($fetch).not.toHaveBeenCalled()
  })

  it('fail 의 «다시 결제하기» 는 고른 옵션으로 돌아간다 · 기록이 없으면 심사 품목 주소', async () => {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, MINE)
    sessionStorage.setItem(PENDING_ITEM_KEY, JSON.stringify(OTHER))
    route.query = { code: 'PAY_PROCESS_CANCELED', message: '취소' }
    await render(Fail)
    retryButton().click()
    expect(navigateTo).toHaveBeenLastCalledWith('/checkout-preview?option=CZE00L10D30V2')
    sessionStorage.removeItem(PENDING_ITEM_KEY)
    retryButton().click()
    expect(navigateTo).toHaveBeenLastCalledWith('/checkout-preview')
  })
})
