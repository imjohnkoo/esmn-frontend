// @vitest-environment happy-dom
// 발급 완료 화면의 설치 가이드 카드(client-guide spec F-6 · D-13 · S-4 · DoD 6) — 화면을 실제로 마운트해 카드를 누르면 그 OS 시트가 열리는가.
// eSIM 1건(단일 화면) · 여러 건(아코디언 화면) 둘 다 — 시트가 한쪽 분기 안에만 있으면 다른 화면에서는 눌러도 열리지 않는다.
// 진입 가드(order-flow) · 서버 호출은 없다 — 화면은 저장소의 주문만 그린다. QR 그림은 대역(그리기 라이브러리 · canvas 없음).
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, ref, watch } from 'vue'
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
const push = vi.fn()
beforeEach(() => {
  push.mockClear()
  setActivePinia(createPinia())
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useRoute', () => ({ params: { orderId: '2026092300000101' } }))
  vi.stubGlobal('useRouter', () => ({ push }))
})
afterEach(() => vi.unstubAllGlobals())
enableAutoUnmount(afterEach)

const settle = async () => {
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

const render = async (count: number) => {
  useOrderStore().singleOrder = order(count)
  const w = mount(ViewPage, {
    attachTo: document.body,
    global: {
      stubs: {
        NuxtLink: defineComponent({
          setup:
            (_, { slots }) =>
            () =>
              h('a', slots.default?.()),
        }),
      },
    },
  })
  await settle()
  return w
}
const cards = () => [
  ...document.body.querySelectorAll<HTMLButtonElement>('.view-page__guides > button'),
]
const title = () => document.body.querySelector('.n-bottom-sheet__title')?.textContent?.trim()
const shots = () => document.body.querySelectorAll('.guide-sheet img.g-shot__img').length

describe.each([
  ['eSIM 1건(단일 화면)', 1],
  ['eSIM 여러 건(아코디언 화면)', 2],
] as const)('%s', (_, count) => {
  it('카드 2 = 버튼(링크 · 새 탭 아님) · 시트는 닫혀 있다', async () => {
    await render(count)
    expect(
      cards().map((b) => [
        b.tagName,
        b.getAttribute('href'),
        b.getAttribute('target'),
        b.getAttribute('aria-haspopup'),
      ]),
    ).toEqual([
      ['BUTTON', null, null, 'dialog'],
      ['BUTTON', null, null, 'dialog'],
    ])
    expect(document.body.querySelector('.n-bottom-sheet__content')).toBeNull()
  })

  it('아이폰 카드 → 아이폰 시트(이미지 24) · 닫고 안드로이드 카드 → 안드로이드 시트(17) — 화면 이동 0', async () => {
    await render(count)
    cards()[0]!.click()
    await settle()
    expect(title()).toBe(GUIDE_PAGES.ios.label)
    expect(shots()).toBe(24)
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    expect(document.body.querySelector('.n-bottom-sheet__content')).toBeNull()
    cards()[1]!.click()
    await settle()
    expect(title()).toBe(GUIDE_PAGES.android.label)
    expect(shots()).toBe(17)
    expect(push).not.toHaveBeenCalled()
  })

  it('누른 카드에 포커스가 가고(Safari 대비), 닫으면 그 카드로 돌아온다', async () => {
    await render(count)
    const android = cards()[1]!
    android.click()
    await settle()
    expect(title()).toBe(GUIDE_PAGES.android.label)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    await new Promise((r) => setTimeout(r, 0))
    expect(document.body.querySelector('.n-bottom-sheet__content')).toBeNull()
    expect(document.activeElement).toBe(android)
  })
})
