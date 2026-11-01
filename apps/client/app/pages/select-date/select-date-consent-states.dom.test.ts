// @vitest-environment happy-dom
// 발급 확인 팝업 상태 블록 4개(client-consent-log spec §⑤ ST-1~ST-4 · DoD 5 · 디자인 리뷰 ③) — 화면을 실제로 마운트해 누른다.
// 서버 호출 · 라우터는 대역이다. 어느 오류가 ST-4 인가의 규칙은 utils/issue-failure.test.ts, 실제 서버 응답으로는 ⑦ walk E2E-6.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ISSUE_CONSENT } from '#shared/consent/issue-consent'
import { useOrderStore } from '~/stores/order'
import type { Order } from '~/types/order'
import SelectDatePage from './[orderId].vue'

const verifyOrder = vi.fn()
const activateOrder = vi.fn()
const push = vi.fn()
vi.mock('~/composables/useApi', () => ({ useApi: () => ({ verifyOrder, activateOrder }) }))

Object.assign(globalThis, { ref, computed, watch, nextTick, onMounted, onBeforeUnmount })

const ORDER_ID = 2026092300000201
const ORDER = {
  orderId: ORDER_ID,
  productOrderId: ORDER_ID + 1,
  quantity: 1,
  receiverName: '테스트고객',
  receiverPhoneNumber: '010-0000-0002',
  planNameKr: '프랑스',
  planDataTypeKr: '무제한 데이터',
  planDataLimitKr: '매일 1기가',
  planDataDuration: 7,
  planCountriesKr: ['프랑스'],
  planCountriesEng: ['France'],
  planCountriesIso: ['FRA'],
  timeZones: ['Europe/Paris'],
  esims: [],
} as unknown as Order

// $fetch 오류 모양 — 응답 본문(h3 { statusCode, message, data })이 error.data
const fetchError = (statusCode: number, code?: string) =>
  Object.assign(new Error('fetch failed'), {
    statusCode,
    data: { statusCode, message: 'x', data: code ? { code } : undefined },
  })

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useRoute', () => ({ params: { orderId: String(ORDER_ID) }, query: {} }))
  vi.stubGlobal('useRouter', () => ({ push }))
  verifyOrder.mockResolvedValue({ verified: true, cancelled: false, details: [ORDER] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
enableAutoUnmount(afterEach)

// 국가 · 날짜를 고른 뒤 «발급하기» 를 눌러 확인 팝업을 연 상태(onSubmit 과 같은 길)
const openConfirm = async () => {
  useOrderStore().setSingleOrder(ORDER)
  const w = mount(SelectDatePage, { attachTo: document.body })
  const vm = w.vm as unknown as Record<string, unknown> & { onSubmit: () => void }
  vm.selectedCountry = '프랑스'
  vm.selectedDate = { year: 2026, month: 11, day: 10 }
  vm.onSubmit()
  await flushPromises()
  return vm
}
const issueButton = () =>
  [...document.body.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === 'eSIM 발급하기',
  ) as HTMLButtonElement | undefined
const checkbox = () =>
  document.body.querySelector(
    '.select-date-page__confirm-agree input[type="checkbox"], .select-date-page__confirm-agree [role="checkbox"]',
  ) as HTMLElement
const bodyText = () => document.body.textContent ?? ''
const press = async () => {
  issueButton()!.click()
  await flushPromises()
  await vi.advanceTimersByTimeAsync(2000) // onConfirm 의 2초 대기
  await flushPromises()
}

describe('발급 확인 팝업 상태 블록', () => {
  it('ST-1 미체크 — 버튼 비활성 · 눌러도 서버 호출 0', async () => {
    await openConfirm()
    expect(issueButton()!.disabled).toBe(true)
    issueButton()!.click()
    await vi.advanceTimersByTimeAsync(3000)
    expect(verifyOrder).not.toHaveBeenCalled()
    expect(activateOrder).not.toHaveBeenCalled()
  })

  it('ST-2 체크 — 버튼 활성', async () => {
    await openConfirm()
    checkbox().click()
    await flushPromises()
    expect(issueButton()!.disabled).toBe(false)
  })

  it('ST-3 제출 중 — 로더 · 동의 판 · 해시를 바디에 싣고 성공하면 /view', async () => {
    activateOrder.mockResolvedValue({ verified: true, details: [{ ...ORDER, esims: [{}] }] })
    const vm = await openConfirm()
    checkbox().click()
    await flushPromises()
    issueButton()!.click()
    await flushPromises()
    expect(vm.isIssueQrCodesVisible).toBe(true)
    expect(bodyText()).toContain('QR 코드를 발급하고 있어요')
    await vi.advanceTimersByTimeAsync(2000)
    await flushPromises()
    expect(activateOrder).toHaveBeenCalledWith(
      expect.objectContaining({ productOrderId: ORDER.productOrderId }),
      ISSUE_CONSENT,
    )
    expect(push).toHaveBeenCalledWith(`/view/${ORDER_ID}`)
  })

  it.each([
    ['동의 400', 400, 'CONSENT_REQUIRED'],
    ['기록 500', 500, 'CONSENT_LOG_FAILED'],
  ])(
    'ST-4 %s — 경고 «잠시 후 다시 시도해 주세요» · 이동 0 · 닫으면 확인 팝업 · 체크 유지 · 버튼 활성',
    async (_, status, code) => {
      activateOrder.mockRejectedValue(fetchError(status, code))
      const vm = await openConfirm()
      checkbox().click()
      await flushPromises()
      await press()
      expect(bodyText()).toContain('잠시 후 다시 시도해 주세요')
      expect(bodyText()).toContain('발급되지 않았어요. 다시 눌러 주세요.')
      expect(vm.isNoOrderAlertVisible).toBe(false)
      await vi.advanceTimersByTimeAsync(5000)
      expect(push).not.toHaveBeenCalled()
      // «확인» 으로 닫는다
      ;[...document.body.querySelectorAll('button')]
        .find((b) => b.textContent?.trim() === '확인')!
        .click()
      await flushPromises()
      expect(vm.isConsentRetryVisible).toBe(false)
      expect(vm.isConfirmOrderVisible).toBe(true)
      expect(vm.isPolicyAgreed).toBe(true)
      expect(issueButton()!.disabled).toBe(false)
    },
  )

  it('그 밖의 거절(provider 400 · 코드 없음) — 지금처럼 «주문 정보를 찾을 수 없어요» → 본인 확인', async () => {
    activateOrder.mockRejectedValue(fetchError(400))
    const vm = await openConfirm()
    checkbox().click()
    await flushPromises()
    await press()
    expect(vm.isConsentRetryVisible).toBe(false)
    expect(vm.isNoOrderAlertVisible).toBe(true)
    await vi.advanceTimersByTimeAsync(3000)
    expect(push).toHaveBeenCalledWith(`/verify/${ORDER_ID}`)
  })
})
