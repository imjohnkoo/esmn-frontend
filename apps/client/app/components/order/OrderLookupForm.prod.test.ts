// @vitest-environment happy-dom
// @vitest-environment-options {"url":"https://esimmany.com/"}
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OrderLookupForm from './OrderLookupForm.vue'

/**
 * shell F-9 · «호스트 판정 0» — 판매 사이트(esimmany.com)에서는 설정값 guestAppOrigin(app.esimmany.com)으로만 보낸다.
 * (루프백 예외는 OrderLookupForm.test.ts)
 */
const GUEST = 'https://app.esimmany.com'
let navigate: ReturnType<typeof vi.fn>

beforeEach(() => {
  navigate = vi.fn()
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { guestAppOrigin: GUEST } }))
  vi.stubGlobal('navigateTo', navigate)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('OrderLookupForm — 판매 사이트에서는 발급 호스트로', () => {
  it('esimmany.com 페이지 → https://app.esimmany.com/verify/{번호}', async () => {
    expect(window.location.origin).toBe('https://esimmany.com')
    const w = mount(OrderLookupForm, { props: { inputId: 'lookup' }, attachTo: document.body })
    await w.get('input').setValue('2026092312345678')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(navigate).toHaveBeenCalledWith(`${GUEST}/verify/2026092312345678`, { external: true })
    w.unmount()
  })
})
