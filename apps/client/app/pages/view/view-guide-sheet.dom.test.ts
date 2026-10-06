// @vitest-environment happy-dom
// 발급 완료 화면의 설치 가이드 카드(client-guide spec F-6 · D-13 · D-15 · D-17 · S-4 · DoD 6 · 8) — 화면을 실제로 마운트해
// «카드 = 사이트판 링크 · 보조키 없는 클릭은 그 OS 시트 · 상태는 주소 ?guide=<os> · 뒤로 가기 = 시트 닫기» 를 본다.
// eSIM 1건(단일 화면) · 여러 건(아코디언 화면) 둘 다 — 시트가 한쪽 분기 안에만 있으면 다른 화면에서는 눌러도 열리지 않는다.
// 진입 가드(order-flow) · 서버 호출은 없다 — 화면은 저장소의 주문만 그린다. 라우터는 주소 상태 · 기록만 흉내 내는 대역, QR 그림도 대역.
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, reactive, ref, watch } from 'vue'
import { GUIDE_PAGES } from '~/content/guide/common'
import { useOrderStore } from '~/stores/order'
import type { Esim, Order } from '~/types/order'
import ViewPage from './[orderId].vue'

vi.mock('qrcode-vue3', () => ({
  default: defineComponent({
    name: 'QRCodeVue3',
    setup: () => () => h('div', { class: 'qr-stub' }),
  }),
}))

// Nuxt 자동 import 대신
Object.assign(globalThis, { ref, computed, watch, nextTick })

type Query = Record<string, string>
// 주소(같은 경로의 query)와 기록만 흉내 낸다 — push 는 한 칸 쌓고 replace 는 바꿔 끼우고 back 은 한 칸 되돌린다.
// vue-router 처럼 앞 칸 주소를 history.state.back 에 적는다(화면은 이것으로 «되돌릴 칸이 이 화면인가» 를 본다 — D-15)
const VIEW = '/view/2026092300000101'
const fullPathOf = (q: Query) => {
  const qs = new URLSearchParams(q).toString()
  return qs ? `${VIEW}?${qs}` : VIEW
}
const route = reactive({ params: { orderId: '2026092300000101' }, query: {} as Query })
let stack: Query[] = []
const syncState = () =>
  window.history.replaceState({ back: stack.length ? fullPathOf(stack[stack.length - 1]!) : null }, '')
const router = {
  push: vi.fn(async (to: string | { query: Query }) => {
    if (typeof to === 'string') return // «주문 목록으로» 같은 다른 화면 이동 — 이 테스트에서는 일어나지 않아야 한다
    stack.push({ ...route.query })
    route.query = { ...to.query }
    syncState()
  }),
  replace: vi.fn(async (to: { query: Query }) => {
    route.query = { ...to.query }
    syncState()
  }),
  back: vi.fn(() => {
    const prev = stack.pop()
    if (prev) route.query = prev
    syncState()
  }),
  resolve: (to: { query: Query }) => ({ fullPath: fullPathOf(to.query) }),
}

beforeEach(() => {
  setActivePinia(createPinia())
  route.query = {}
  stack = []
  syncState()
  router.push.mockClear()
  router.replace.mockClear()
  router.back.mockClear()
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => router)
})
afterEach(() => vi.unstubAllGlobals())
enableAutoUnmount(afterEach)

const settle = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}

// 화면이 그리는 칸만 — 값은 가짜(LPA 모양 · 실제 주문 아님)
const esim = (n: number): Esim => ({
  apn: 'walk',
  manualCode: `FAKE-CODE-${n}`,
  smdpAddress: 'smdp.example.invalid',
  networkStatus: 'NOT_ACTIVE',
  serviceStatus: 'ACTIVE',
  activationCode: `LPA:1$smdp.example.invalid$FAKE-CODE-${n}`,
})
const order = (count: number) =>
  ({
    orderId: 2026092300000101,
    planNameKr: '프랑스 무제한 7일',
    esims: Array.from({ length: count }, (_, i) => esim(i + 1)),
  }) as unknown as Order

const render = async (count: number, query: Query = {}) => {
  route.query = { ...query }
  useOrderStore().singleOrder = order(count)
  const w = mount(ViewPage, { attachTo: document.body })
  await settle()
  return w
}
const cards = () => [...document.body.querySelectorAll<HTMLAnchorElement>('.view-page__guides > a')]
const sheetOpen = () => !!document.body.querySelector('.n-bottom-sheet__content')
const title = () => document.body.querySelector('.n-bottom-sheet__title')?.textContent?.trim()
const shots = () => document.body.querySelectorAll('.guide-sheet img.g-shot__img').length
/**
 * 카드를 누른다 — 화면의 클릭 처리가 기본 동작(새 탭 이동)을 막았는지 돌려준다.
 * 문서 끝(버블)에서 그 결과를 읽은 뒤 기본 동작을 막는다 — 테스트 환경(happy-dom)이 링크를 실제로 따라가 네트워크 요청을 보내지 않게
 */
let prevented: boolean | null = null
const stopNavigation = (e: Event) => {
  prevented = e.defaultPrevented
  e.preventDefault()
}
beforeEach(() => document.addEventListener('click', stopNavigation))
afterEach(() => document.removeEventListener('click', stopNavigation))
const press = (card: HTMLElement, init: MouseEventInit = {}) => {
  prevented = null
  card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }))
  return prevented
}

describe.each([
  ['eSIM 1건(단일 화면)', 1],
  ['eSIM 여러 건(아코디언 화면)', 2],
] as const)('%s', (_, count) => {
  it('카드 2 = 사이트판 링크(새 탭 — 화면 준비 전에도 열린다) · 시트를 연다고 알린다 · 시트는 닫혀 있다', async () => {
    await render(count)
    expect(
      cards().map((a) => [
        a.getAttribute('href'),
        a.getAttribute('target'),
        a.getAttribute('rel'),
        a.getAttribute('aria-haspopup'),
      ]),
    ).toEqual([
      [GUIDE_PAGES.ios.to, '_blank', 'noopener noreferrer', 'dialog'],
      [GUIDE_PAGES.android.to, '_blank', 'noopener noreferrer', 'dialog'],
    ])
    expect(sheetOpen()).toBe(false)
  })

  it('보조키 없는 클릭 → 링크 이동을 막고 그 OS 시트(주소 ?guide=<os> 한 칸) — 아이폰 24 · 안드로이드 17', async () => {
    await render(count)
    expect(press(cards()[0]!)).toBe(true)
    await settle()
    // 같은 경로 — query 만(경로 · path 키 없이 · spec D-15 «?guide=<os> 만 붙는다»)
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.push).toHaveBeenCalledWith({ query: { guide: 'ios' } })
    expect(route.query).toEqual({ guide: 'ios' })
    expect(title()).toBe(GUIDE_PAGES.ios.label)
    expect(shots()).toBe(24)
    // 뒤로 가기 = 시트 닫기 — 화면(QR · 코드)은 그대로
    router.back()
    await settle()
    expect(sheetOpen()).toBe(false)
    expect(document.body.querySelector('.view-page__guides')).toBeTruthy()
    expect(press(cards()[1]!)).toBe(true)
    await settle()
    expect(route.query).toEqual({ guide: 'android' })
    expect(title()).toBe(GUIDE_PAGES.android.label)
    expect(shots()).toBe(17)
  })

  it('보조키 · 가운데 버튼 클릭은 링크 그대로(시트 · 주소 변화 0)', async () => {
    await render(count)
    for (const init of [
      { ctrlKey: true },
      { metaKey: true },
      { shiftKey: true },
      { altKey: true },
      { button: 1 },
    ]) {
      expect(press(cards()[0]!, init), JSON.stringify(init)).toBe(false)
    }
    await settle()
    expect(router.push).not.toHaveBeenCalled()
    expect(sheetOpen()).toBe(false)
  })

  it('이 화면에서 연 시트를 X 로 닫으면 기록 한 칸 뒤로(뒤로 가기와 같은 결과 · 기록이 쌓이지 않는다) — 포커스는 누른 카드', async () => {
    await render(count)
    const android = cards()[1]!
    press(android)
    await settle()
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    await new Promise((r) => setTimeout(r, 0))
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(router.replace).not.toHaveBeenCalled()
    expect(route.query).toEqual({})
    expect(stack).toEqual([])
    expect(sheetOpen()).toBe(false)
    expect(document.activeElement).toBe(android)
  })

  it('시트 안 OS 전환은 주소의 ?guide 만 바꾸고 기록을 늘리지 않는다', async () => {
    await render(count)
    press(cards()[0]!)
    await settle()
    ;[...document.body.querySelectorAll<HTMLButtonElement>('.guide-sheet .g-os__tab')]
      .find((b) => b.textContent?.trim() === GUIDE_PAGES.android.short)!
      .click()
    await settle()
    expect(router.push).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledWith({ query: { guide: 'android' } })
    expect(title()).toBe(GUIDE_PAGES.android.label)
    // 이어서 닫으면 처음 연 한 칸만 되돌린다
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(route.query).toEqual({})
  })

  it('주소로 바로 열린 시트(?guide=android — 새로 고침)는 열려 있고, 닫으면 되돌릴 칸이 없으니 ?guide 를 지운다', async () => {
    await render(count, { guide: 'android' })
    expect(title()).toBe(GUIDE_PAGES.android.label)
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    expect(router.back).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith({ query: {} })
    expect(sheetOpen()).toBe(false)
  })

  it('주소의 다른 값은 그대로 두고 ?guide 만 붙였다 뗀다(열기 · OS 전환 · 닫기)', async () => {
    await render(count, { from: 'sms' })
    press(cards()[0]!)
    await settle()
    expect(router.push).toHaveBeenCalledWith({ query: { from: 'sms', guide: 'ios' } })
    ;[...document.body.querySelectorAll<HTMLButtonElement>('.guide-sheet .g-os__tab')]
      .find((b) => b.textContent?.trim() === GUIDE_PAGES.android.short)!
      .click()
    await settle()
    expect(router.replace).toHaveBeenCalledWith({ query: { from: 'sms', guide: 'android' } })
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(route.query).toEqual({ from: 'sms' })
  })

  it('주소로 바로 열린 시트도 닫을 때 다른 값은 남긴다', async () => {
    await render(count, { from: 'sms', guide: 'ios' })
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    expect(router.replace).toHaveBeenCalledWith({ query: { from: 'sms' } })
  })

  it('모르는 ?guide 값은 시트를 열지 않는다', async () => {
    await render(count, { guide: 'windows' })
    expect(sheetOpen()).toBe(false)
  })

  it('뒤로 가기로 닫고 앞으로 가기로 다시 연 시트를 X 로 닫으면 기록 한 칸 뒤로(앞 칸 = 이 화면 — 기록이 남지 않는다)', async () => {
    await render(count)
    press(cards()[0]!)
    await settle()
    router.back() // 휴대폰 뒤로 가기
    await settle()
    expect(sheetOpen()).toBe(false)
    // 앞으로 가기 — 앞 칸은 «?guide 없는 이 화면»
    stack.push({})
    route.query = { guide: 'ios' }
    syncState()
    await settle()
    expect(title()).toBe(GUIDE_PAGES.ios.label)
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    expect(router.back).toHaveBeenCalledTimes(2) // 휴대폰 뒤로 가기 + X
    expect(router.replace).not.toHaveBeenCalled()
    expect(route.query).toEqual({})
    expect(stack).toEqual([])
  })

  it('앞 칸이 다른 화면이면(주문 목록에서 ?guide 주소로 바로 온 경우) X 는 기록을 되돌리지 않고 ?guide 만 지운다', async () => {
    window.history.replaceState({ back: '/details/2026092300000101' }, '')
    await render(count, { guide: 'ios' })
    window.history.replaceState({ back: '/details/2026092300000101' }, '')
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    expect(router.back).not.toHaveBeenCalled()
    expect(router.replace).toHaveBeenCalledWith({ query: {} })
  })
})
