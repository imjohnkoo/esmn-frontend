// @vitest-environment happy-dom
// «구매하기» 분기(client-shell spec D-60 · catalog F-8) — 상품 페이지를 실제로 마운트한다. 키 판정은 서버 응답 대역.
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Suspense, computed, defineComponent, h, nextTick, onMounted, ref, watch } from 'vue'
import { initialSelection, selectedOption } from '#shared/catalog/picker'
import { fixtureRaw } from '#shared/catalog/test-data'
import { parseCatalog } from '#shared/catalog/validate'
import Page from './[zone].vue'

const zone = parseCatalog(fixtureRaw()).zones.find((z) => z.zone === 'CZE00')!
const CODE = selectedOption(zone, initialSelection(zone))!.code
const $fetch = vi.fn()
const assign = vi.fn()
Object.assign(globalThis, {
  ref,
  computed,
  watch,
  onMounted,
  definePageMeta: () => {},
  useHead: () => {},
  useCatalogSeo: () => {},
  useRoute: () => ({ params: { zone: 'cze00' } }),
  useFetch: async () => ({ data: ref(zone), error: ref(null) }),
  $fetch,
})

beforeEach(() => {
  vi.clearAllMocks()
  $fetch.mockReset()
  vi.spyOn(window.location, 'assign').mockImplementation(assign)
})
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

const render = async () => {
  const Host = defineComponent({ setup: () => () => h(Suspense, null, { default: () => h(Page) }) })
  const w = mount(Host, {
    attachTo: document.body,
    global: { stubs: { NuxtLink: true, ProductSections: true } },
  })
  await flushPromises()
  return w
}
const buyButton = () => document.querySelector<HTMLButtonElement>('.product__buy')!
const press = async () => {
  buyButton().click()
  await flushPromises()
  await nextTick()
}
const sheetShown = () =>
  (document.body.textContent ?? '').includes('네이버 스마트스토어로 이동해요')

describe('«구매하기» (D-60)', () => {
  it('테스트 키 → 시트 없이 고른 옵션으로 결제 페이지 · 전체 문서 이동 · 금액은 주소에 없다', async () => {
    $fetch.mockResolvedValue({ testKey: true })
    const w = await render()
    await press()
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(`/checkout-preview?option=${CODE}`)
    expect(sheetShown()).toBe(false)
    w.unmount()
  })

  it.each([
    ['live_ · 빈 키', () => $fetch.mockResolvedValue({ testKey: false })],
    ['서버 오류', () => $fetch.mockRejectedValue(new Error('500'))],
    ['예상 밖 응답', () => $fetch.mockResolvedValue('<html>')],
  ])('%s → 결제 페이지로 가지 않고 구매 시트', async (_n, reply) => {
    reply()
    const w = await render()
    await press()
    expect(assign).not.toHaveBeenCalled()
    expect(sheetShown()).toBe(true)
    w.unmount()
  })

  it('답을 기다리는 동안 다시 눌러도 한 번만 묻고 한 번만 간다', async () => {
    $fetch.mockResolvedValue({ testKey: true })
    const w = await render()
    buyButton().click()
    buyButton().click()
    await flushPromises()
    expect($fetch).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('키 판정은 페이지가 뜰 때가 아니라 누를 때 묻는다', async () => {
    const w = await render()
    expect($fetch).not.toHaveBeenCalled()
    w.unmount()
  })
})
