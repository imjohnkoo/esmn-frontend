// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OrderLookupForm from './OrderLookupForm.vue'

/**
 * catalog spec D-17 · shell F-9 — 주문번호 조회 결선. 프리렌더 페이지에는 guestAppOrigin 이 빌드 값(실호스트)으로 굳으므로,
 * 루프백 주소에서 연 페이지는 자기 출처로 보내야 한다(로컬 walk 가 실호스트로 새지 않게 — John 09-23 안전 지시).
 * Nuxt 함수(useRuntimeConfig · navigateTo)만 끼우고 폼은 실제로 그린다.
 */
const PROD_GUEST = 'https://app.esimmany.com'
let navigate: ReturnType<typeof vi.fn>

beforeEach(() => {
  navigate = vi.fn()
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { guestAppOrigin: PROD_GUEST } }))
  vi.stubGlobal('navigateTo', navigate)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function submit(orderNo: string) {
  const w = mount(OrderLookupForm, { props: { inputId: 'lookup' }, attachTo: document.body })
  await w.get('input').setValue(orderNo)
  await w.get('form').trigger('submit')
  await flushPromises()
  return w
}

describe('OrderLookupForm — 발급 호스트 이동', () => {
  it('루프백(지금 happy-dom 페이지 = localhost)에서는 자기 출처의 /verify 로 전체 이동', async () => {
    expect(window.location.hostname).toMatch(/^(localhost|127\.0\.0\.1)$/)
    const w = await submit('2026 0923-1234 5678')
    expect(navigate).toHaveBeenCalledTimes(1)
    expect(navigate).toHaveBeenCalledWith(`${window.location.origin}/verify/2026092312345678`, {
      external: true,
    })
    expect(String(navigate.mock.calls[0]![0])).not.toContain('esimmany.com')
    w.unmount()
  })

  it('잘못된 번호는 이동하지 않고 오류를 보인다', async () => {
    const w = await submit('12ab')
    expect(navigate).not.toHaveBeenCalled()
    expect(w.get('[role="alert"]').text()).toBe('주문번호는 숫자만 입력해 주세요.')
    w.unmount()
  })
})
