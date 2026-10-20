// @vitest-environment happy-dom
// QR 화면의 상품 구분(브리프 H-015 R1 · R4 · R6 · plan D-3 · D-4) — 화면을 실제로 마운트해 칩에 일수 · 용량이 보이는지,
// «QR 코드 다운로드» 가 그 QR 그림을 상품주문끼리 겹치지 않는 이름으로 내려받는지 본다. 수량 2개(아코디언 «eSIM 1 · 2»)는
// eSIM 마다 끝 번호가 다르다. QR 그림 대역은 실제 qrcode-vue3 처럼 <img>(PNG data URL)만 그린다 — 화면이 canvas 를 찾던
// 동안에는 버튼이 아무것도 내려받지 않았다(H-015 회신 — 이식 때부터).
// 진입 가드(order-flow) · 서버 호출은 없다 — 화면은 저장소의 주문만 그린다. 내려받기는 링크 클릭을 가로챈다.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, nextTick, reactive, ref, watch } from 'vue'
import { useOrderStore } from '~/stores/order'
import type { Esim, Order } from '~/types/order'
import ViewPage from './[orderId].vue'

// 실제 라이브러리 출력 모양 — <div><img src="data:image/png;base64,…"></div> (QRCodeVue3Async.vue 템플릿)
const { QR_PNG } = vi.hoisted(() => ({
  QR_PNG: (value: string) => `data:image/png;base64,${btoa(value)}`,
}))
vi.mock('qrcode-vue3', () => ({
  default: defineComponent({
    name: 'QRCodeVue3',
    props: { value: { type: String, required: true } },
    setup: (props) => () => h('div', [h('img', { src: QR_PNG(props.value) })]),
  }),
}))

// Nuxt 자동 import 대신
Object.assign(globalThis, { ref, computed, watch, nextTick })

const ORDER_ID = 2026102000000101
const route = reactive({
  params: { orderId: String(ORDER_ID) },
  query: {} as Record<string, string>,
})
const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  resolve: () => ({ fullPath: `/view/${ORDER_ID}` }),
}

// 링크 클릭 = 내려받기 — 브라우저 대신 파일 이름 · 내용(주소)만 모은다
let downloads: string[] = []
let hrefs: string[] = []
beforeEach(() => {
  setActivePinia(createPinia())
  downloads = []
  hrefs = []
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => router)
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloads.push(this.download)
    hrefs.push(this.href)
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
enableAutoUnmount(afterEach)

// 값은 가짜(LPA 모양 · 실제 주문 아님) — 상품 문구는 plan-type V2 그대로
const esim = (n: number): Esim => ({
  apn: 'walk',
  manualCode: `FAKE-CODE-${n}`,
  smdpAddress: 'smdp.example.invalid',
  networkStatus: 'NOT_ACTIVE',
  serviceStatus: 'ACTIVE',
  activationCode: `LPA:1$smdp.example.invalid$FAKE-CODE-${n}`,
})
// 내려받는 내용 = 그 eSIM 의 QR 그림(PNG) — 브라우저가 열지 않고 저장하도록 형식만 octet-stream
const saved = (n: number) =>
  QR_PNG(esim(n).activationCode).replace('image/png', 'image/octet-stream')
const order = (days: number, count = 1) =>
  ({
    orderId: ORDER_ID,
    productOrderId: ORDER_ID + days,
    quantity: count,
    planNameKr: '동유럽3개국',
    planDataLimitKr: '매일 2기가 + 무제한 500Kbps',
    planDataDuration: days,
    esims: Array.from({ length: count }, (_, i) => esim(i + 1)),
  }) as unknown as Order

const render = async (selected: Order) => {
  useOrderStore().setSingleOrder(selected)
  const w = mount(ViewPage, { attachTo: document.body })
  await flushPromises()
  return w
}
const planChip = () =>
  document.body.querySelectorAll('.view-page__chip-row .n-info-chip__value')[1]?.textContent?.trim()
const buttons = (label: string) =>
  [...document.body.querySelectorAll<HTMLButtonElement>('button')].filter(
    (b) => b.textContent?.trim() === label,
  )

describe('④ QR — 같은 상품 7일권 · 8일권', () => {
  it.each([
    [7, '동유럽3개국 · 7일 · 매일 2기가'],
    [8, '동유럽3개국 · 8일 · 매일 2기가'],
  ])('%i일권 칩 «%s»', async (days, label) => {
    await render(order(days))
    expect(planChip()).toBe(label)
  })

  it('«QR 코드 다운로드» 가 그 QR 그림을 내려받는다 — 파일 이름 = 이심마니 + 칩 글자 + 상품주문번호 + eSIM 번호 · 7일권 · 8일권이 겹치지 않는다', async () => {
    // 한 화면씩 — 고객은 상품마다 ④ 를 따로 연다
    for (const days of [7, 8]) {
      const w = await render(order(days))
      buttons('QR 코드 다운로드')[0]!.click()
      w.unmount()
    }
    expect(downloads).toEqual([
      `이심마니_동유럽3개국_7일_매일2기가_${ORDER_ID + 7}_1.png`,
      `이심마니_동유럽3개국_8일_매일2기가_${ORDER_ID + 8}_1.png`,
    ])
    expect(hrefs).toEqual([saved(1), saved(1)])
  })
})

describe('④ 수량 2개(아코디언 — R6)', () => {
  it('아코디언 «eSIM 1 · 2» 는 그대로 · 칩은 한 번 · eSIM 마다 끝 번호가 다르다', async () => {
    await render(order(8, 2))
    expect(
      [...document.body.querySelectorAll('.view-page__row-num')].map((el) =>
        el.textContent?.trim(),
      ),
    ).toEqual(['eSIM 1', 'eSIM 2'])
    expect(planChip()).toBe('동유럽3개국 · 8일 · 매일 2기가')
    buttons('QR 다운로드')[0]!.click()
    document.body.querySelectorAll<HTMLButtonElement>('.view-page__row-head')[1]!.click()
    await nextTick()
    buttons('QR 다운로드')[1]!.click()
    expect(downloads).toEqual([
      `이심마니_동유럽3개국_8일_매일2기가_${ORDER_ID + 8}_1.png`,
      `이심마니_동유럽3개국_8일_매일2기가_${ORDER_ID + 8}_2.png`,
    ])
    expect(hrefs).toEqual([saved(1), saved(2)])
  })
})
