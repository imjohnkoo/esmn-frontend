// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import PurchaseSheet from './PurchaseSheet.vue'

/**
 * catalog spec S-5 · F-8 · Proposal K2 — 구매 시트 결선.
 * 가장 중요한 불변식: 3초 뒤 **한 번만** 같은 탭 이동 · 취소 · ESC · 언마운트 뒤에는 이동하지 않는다 · bfcache 복귀 시 닫힌다.
 */
const NAVER_URL =
  'https://smartstore.naver.com/esimmany/products/9382876791?nt_source=esimmany-web&nt_medium=detail&nt_detail=CZE00U'
const OPTION = '매일 2GB + 소진후 512kbps 무제한 · 7일'

type Assign = (url: string | URL) => void
let assign: ReturnType<typeof vi.fn<Assign>>

function host(initial = false) {
  const open = ref(initial)
  const Host = defineComponent({
    setup: () => () =>
      h(PurchaseSheet, {
        modelValue: open.value,
        'onUpdate:modelValue': (v: boolean) => (open.value = v),
        summary: '체코 · 매일 2GB · 7일',
        price: '9,100원',
        optionName: OPTION,
        naverUrl: NAVER_URL,
      }),
  })
  const w = mount(Host, { attachTo: document.body })
  return { w, open }
}

async function openSheet(open: { value: boolean }) {
  open.value = true
  await nextTick()
  await flushPromises()
}

const button = (label: string) =>
  [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(label))!
const text = () => (document.body.textContent ?? '').replace(/\s+/g, ' ')

beforeEach(() => {
  vi.useFakeTimers()
  assign = vi.fn<Assign>()
  vi.spyOn(window.location, 'assign').mockImplementation(assign)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('PurchaseSheet (S-5 · F-8 · K2)', () => {
  it('열면 K2 원문 · 요약 · 가격 · «3초 뒤에 이동해요», 3초 뒤 naverUrl 로 한 번 이동', async () => {
    const { w, open } = host()
    await openSheet(open)
    expect(text()).toContain('네이버 스마트스토어로 이동해요')
    expect(text()).toContain(
      `결제사 도입 준비 중입니다. 네이버 스마트스토어에서 구매 가능합니다. 스토어에서 ‹${OPTION}› 옵션을 골라 주세요`,
    )
    expect(text()).toContain('체코 · 매일 2GB · 7일')
    expect(text()).toContain('9,100원')
    expect(text()).toContain('3초 뒤에 이동해요')
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(text()).toContain('2초 뒤에 이동해요')
    vi.advanceTimersByTime(1999)
    expect(assign).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(assign).toHaveBeenCalledTimes(1)
    expect(assign).toHaveBeenCalledWith(NAVER_URL)
    vi.advanceTimersByTime(10_000)
    expect(assign).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('«취소»(1.5초) → 닫히고 이동하지 않는다', async () => {
    const { w, open } = host()
    await openSheet(open)
    vi.advanceTimersByTime(1500)
    button('취소').click()
    await nextTick()
    await flushPromises()
    expect(open.value).toBe(false)
    vi.advanceTimersByTime(10_000)
    expect(assign).not.toHaveBeenCalled()
    w.unmount()
  })

  it('ESC(2.9초) → 닫히고 이동하지 않는다', async () => {
    const { w, open } = host()
    await openSheet(open)
    vi.advanceTimersByTime(2900)
    ;(document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await nextTick()
    await flushPromises()
    expect(open.value).toBe(false)
    vi.advanceTimersByTime(10_000)
    expect(assign).not.toHaveBeenCalled()
    w.unmount()
  })

  it('닫았다 다시 열면 3초부터 다시 센다', async () => {
    const { w, open } = host()
    await openSheet(open)
    vi.advanceTimersByTime(2000)
    open.value = false
    await nextTick()
    await openSheet(open)
    expect(text()).toContain('3초 뒤에 이동해요')
    vi.advanceTimersByTime(2999)
    expect(assign).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(assign).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('세는 중에 페이지를 떠나면(언마운트) 이동하지 않는다', async () => {
    const { w, open } = host()
    await openSheet(open)
    vi.advanceTimersByTime(1000)
    w.unmount()
    vi.advanceTimersByTime(10_000)
    expect(assign).not.toHaveBeenCalled()
  })

  it('«지금 이동» → 곧바로 한 번 이동 · «이동하고 있어요» · 다시 눌러도 · 시간이 지나도 한 번', async () => {
    const { w, open } = host()
    await openSheet(open)
    button('지금 이동').click()
    await nextTick()
    expect(assign).toHaveBeenCalledTimes(1)
    expect(text()).toContain('이동하고 있어요')
    button('지금 이동').click()
    vi.advanceTimersByTime(10_000)
    expect(assign).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('bfcache 로 돌아오면(pageshow persisted) 시트가 닫힌다', async () => {
    const { w, open } = host()
    await openSheet(open)
    button('지금 이동').click()
    const ev = new Event('pageshow')
    Object.defineProperty(ev, 'persisted', { value: true })
    window.dispatchEvent(ev)
    await nextTick()
    await flushPromises()
    expect(open.value).toBe(false)
    expect(assign).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('스토어에 갔다 bfcache 로 돌아와 다시 사면 3초 뒤 다시 한 번 이동한다', async () => {
    const { w, open } = host()
    await openSheet(open)
    button('지금 이동').click()
    expect(assign).toHaveBeenCalledTimes(1)
    const back = new Event('pageshow')
    Object.defineProperty(back, 'persisted', { value: true })
    window.dispatchEvent(back)
    await nextTick()
    expect(open.value).toBe(false)
    await openSheet(open)
    expect(text()).toContain('3초 뒤에 이동해요')
    vi.advanceTimersByTime(3000)
    expect(assign).toHaveBeenCalledTimes(2)
    w.unmount()
  })

  it('«지금 이동» 뒤에는 카운트다운이 되살아나지 않는다', async () => {
    const { w, open } = host()
    await openSheet(open)
    button('지금 이동').click()
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(text()).toContain('이동하고 있어요')
    expect(text()).not.toMatch(/초 뒤에 이동해요/)
    w.unmount()
  })

  it('bfcache 가 아닌 pageshow(persisted=false)는 시트를 닫지 않는다', async () => {
    const { w, open } = host()
    await openSheet(open)
    const ev = new Event('pageshow')
    Object.defineProperty(ev, 'persisted', { value: false })
    window.dispatchEvent(ev)
    await nextTick()
    expect(open.value).toBe(true)
    w.unmount()
  })

  it('카운트다운 문구는 aria-live="polite" 로 읽힌다', async () => {
    const { w, open } = host()
    await openSheet(open)
    const live = [...document.querySelectorAll('[aria-live]')].find((el) =>
      el.textContent?.includes('초 뒤에 이동해요'),
    )
    expect(live?.getAttribute('aria-live')).toBe('polite')
    w.unmount()
  })

  it('열린 채로 마운트돼도 3초 뒤 한 번 이동한다', async () => {
    const { w } = host(true)
    await nextTick()
    await flushPromises()
    vi.advanceTimersByTime(3000)
    expect(assign).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('이동이 흡수돼 다시 보이게 되면(visibilitychange) 시트를 닫는다 · 이동 전에는 닫지 않는다', async () => {
    const { w, open } = host()
    await openSheet(open)
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(open.value).toBe(true) // 아직 «지금 이동» 전
    button('지금 이동').click()
    document.dispatchEvent(new Event('visibilitychange'))
    await nextTick()
    expect(document.visibilityState).toBe('visible')
    expect(open.value).toBe(false)
    expect(assign).toHaveBeenCalledTimes(1)
    w.unmount()
  })
})
