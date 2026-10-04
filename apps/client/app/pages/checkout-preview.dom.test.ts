// @vitest-environment happy-dom
// 테스트 체크아웃 동작(client-shell spec F-19 · F-22 · D-38 (b)) — 페이지를 실제로 마운트하고 결제 SDK 는 가짜로 바꿔 끼운다.
// 보는 것: 동의 전에는 어떤 버튼 · 링크 · 경로로도 SDK 호출 0 · 렌더된 동의 블록 글자 = 05-B · 필수 2개(약관 · 14세) 뒤에만 결제 버튼 활성 ·
// 동의 기본 해제 · 선택(마케팅)은 결제와 무관 · 키가 비면 동의해도 호출 0.
// 소스 배선(문구 출처 · 결제 경로 · 블록 밖 글자)은 legal-links.test.ts 가 정적으로, 실제 결제창은 walk(E2E-6)가 본다.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CHECKOUT_NOTICE } from '~/content/legal/checkout-notice'
import { checkoutPreviewFromCatalog } from '#shared/catalog/preview'
import { fixtureRaw } from '#shared/catalog/test-data'
import { parseCatalog } from '#shared/catalog/validate'
import Page from './checkout-preview.vue'

const sdk = vi.hoisted(() => ({ requestPayment: vi.fn(async () => undefined) }))
vi.mock('@portone/browser-sdk/v2', () => sdk)

const portone = { storeId: 'store-test-only', testChannelKey: 'channel-key-test-only' }
// 상품 = 빌드 모듈이 앱 설정에 넣는 값(catalog F-12) — 여기서는 카탈로그 픽스처로 같은 함수를 돌린다
const PREVIEW_ITEM = checkoutPreviewFromCatalog(parseCatalog(fixtureRaw()))
const navigateTo = vi.fn()
// Nuxt 자동 import 대신 — 페이지가 전역 이름으로 찾는다
Object.assign(globalThis, {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  definePageMeta: () => {},
  useHead: () => {},
  useRoute: () => ({ query: {} }),
  useRuntimeConfig: () => ({ public: { portone } }),
  useAppConfig: () => ({ checkoutPreview: PREVIEW_ITEM }),
  navigateTo,
})

enableAutoUnmount(afterEach)
beforeEach(() => {
  sdk.requestPayment.mockClear()
  navigateTo.mockClear()
  portone.storeId = 'store-test-only'
  portone.testChannelKey = 'channel-key-test-only'
})

const settle = async () => {
  await flushPromises()
  await nextTick()
}
const render = async () => {
  const wrapper = mount(Page, { attachTo: document.body })
  await settle()
  return wrapper
}
const checkbox = (label: string) => {
  const box = [...document.body.querySelectorAll<HTMLElement>('.n-checkbox')].find((l) =>
    l.textContent?.includes(label),
  )
  return box!.querySelector<HTMLButtonElement>('[role="checkbox"]')!
}
const TERMS = '이용약관에 동의합니다'
const AGE = '만 14세 이상입니다'
const MARKETING = '혜택·이벤트 알림 수신'
const toggle = async (label: string) => {
  checkbox(label).click()
  await settle()
}
const payButton = () =>
  [...document.body.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.includes('결제하기'),
  )!
/** 비활성 버튼을 «억지로» 누른다 — disabled 를 걷고 클릭해 핸들러의 조건 검사까지 본다(속성만 믿지 않는다) */
const forcePay = async () => {
  const b = payButton()
  b.removeAttribute('disabled')
  b.click()
  await settle()
}
const visible = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim()
/** 글자 · 순서만 본다(요소 사이 공백은 렌더 방식 몫) */
const squash = (t: string) => t.replace(/\s+/g, '')
/** 05-B 한 줄 → 화면 글자(마크다운 링크 = 글자 + 낭독기용 « (새 창)») */
const shown = (line: string) => line.replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1 (새 창)')

describe('테스트 체크아웃 — 동의 전 결제 0 · 필수 2개 뒤에만 결제(D-38 (b))', () => {
  it('처음: 동의 3개 모두 해제 · 결제 버튼 비활성 · 누르거나 억지로 눌러도 SDK 호출 0', async () => {
    await render()
    const boxes = [...document.body.querySelectorAll('[role="checkbox"]')]
    expect(boxes).toHaveLength(3)
    expect(boxes.map((b) => b.getAttribute('aria-checked'))).toEqual(['false', 'false', 'false'])
    expect(payButton().disabled).toBe(true)
    payButton().click()
    await settle()
    await forcePay()
    expect(sdk.requestPayment).not.toHaveBeenCalled()
  })

  it('동의 전 화면의 모든 링크 · 버튼(결제 버튼 제외 — 체크는 원래 상태로 되돌림)을 눌러도 SDK 호출 0', async () => {
    await render()
    // 링크는 새 창 — 테스트 환경이 이동하지 않게 문서 단계에서 막는다
    const stop = (e: Event) => e.preventDefault()
    document.addEventListener('click', stop)
    for (const a of document.body.querySelectorAll('a')) a.click()
    document.removeEventListener('click', stop)
    for (const b of document.body.querySelectorAll<HTMLButtonElement>('button')) {
      if (b === payButton()) continue
      b.click() // 체크 하나씩 켰다 끈다
      await settle()
      b.click()
      await settle()
    }
    expect(sdk.requestPayment).not.toHaveBeenCalled()
    expect(payButton().disabled).toBe(true)
  })

  it.each([
    ['약관만', [TERMS]],
    ['14세만', [AGE]],
    ['선택(마케팅)만', [MARKETING]],
    ['약관 + 선택', [TERMS, MARKETING]],
    ['14세 + 선택', [AGE, MARKETING]],
  ])('필수가 하나라도 빠지면(%s) 비활성 · 억지로 눌러도 SDK 호출 0', async (_name, checks) => {
    await render()
    for (const c of checks) await toggle(c)
    expect(payButton().disabled).toBe(true)
    await forcePay()
    expect(sdk.requestPayment).not.toHaveBeenCalled()
  })

  it('필수 2개를 체크하면 활성 — 선택(마케팅)은 켜든 끄든 무관 · 필수를 다시 끄면 비활성', async () => {
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    expect(payButton().disabled).toBe(false)
    await toggle(MARKETING)
    expect(payButton().disabled).toBe(false)
    await toggle(MARKETING)
    expect(payButton().disabled).toBe(false)
    await toggle(AGE)
    expect(payButton().disabled).toBe(true)
    await forcePay()
    expect(sdk.requestPayment).not.toHaveBeenCalled()
  })

  it('필수 2개 뒤 결제 버튼 → SDK 한 번(테스트 키 · 카드 · 원화 · 금액 · 복귀 주소 · 리디렉트 강제)', async () => {
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    payButton().click()
    await settle()
    expect(sdk.requestPayment).toHaveBeenCalledTimes(1)
    expect(sdk.requestPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        storeId: 'store-test-only',
        channelKey: 'channel-key-test-only',
        orderName: PREVIEW_ITEM.orderName,
        totalAmount: PREVIEW_ITEM.amount,
        currency: 'KRW',
        payMethod: 'CARD',
        redirectUrl: `${window.location.origin}/checkout-preview`,
        forceRedirect: true,
        paymentId: expect.stringMatching(/^[A-Za-z0-9_-]{6,64}$/),
      }),
    )
    // 응답 없음(리디렉트 중) — 다시 눌러도 두 번째 호출 없음(로딩 중)
    payButton().click()
    await settle()
    expect(sdk.requestPayment).toHaveBeenCalledTimes(1)
  })

  it('키가 비면 필수 2개를 체크해도 비활성 · «결제 설정을 준비하고 있어요.» · 억지로 눌러도 SDK 호출 0', async () => {
    portone.testChannelKey = ''
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    expect(payButton().disabled).toBe(true)
    expect(document.body.textContent).toContain('결제 설정을 준비하고 있어요.')
    await forcePay()
    expect(sdk.requestPayment).not.toHaveBeenCalled()
  })
})

describe('테스트 체크아웃 — 렌더된 동의 블록 글자 = 05-B(생성물) 그대로', () => {
  it('동의 3 · 선택 안내 · 개인정보 수집 · 이용 안내(체크 없음) · 결제 전 안내 — 순서 · 글자 · 링크가 정본 조각과 같고 다른 글자가 없다', async () => {
    await render()
    const block = document.body.querySelector('.checkout__agree')!
    expect(squash(block.textContent ?? '')).toBe(
      squash(
        [
          shown(CHECKOUT_NOTICE.terms),
          shown(CHECKOUT_NOTICE.age),
          shown(CHECKOUT_NOTICE.marketing),
          CHECKOUT_NOTICE.marketingInfo,
          shown(CHECKOUT_NOTICE.privacyTitle),
          CHECKOUT_NOTICE.privacyInfo,
          CHECKOUT_NOTICE.beforeTitle,
          shown(CHECKOUT_NOTICE.beforeRefund),
          CHECKOUT_NOTICE.beforeMinor,
          CHECKOUT_NOTICE.beforeNotify,
        ].join(''),
      ),
    )
    // 개인정보 «안내» 는 체크가 아니다 — 체크는 동의 3개뿐(약관 · 14세 · 마케팅)
    expect([...block.querySelectorAll('.n-checkbox')].map((l) => visible(l))).toEqual([
      shown(CHECKOUT_NOTICE.terms).replace(/ 보기 \(새 창\)$/, ''),
      CHECKOUT_NOTICE.age,
      CHECKOUT_NOTICE.marketing,
    ])
    // 링크는 새 창 · 주소는 정본 그대로(약관 · 방침 · 환불)
    expect(
      [...block.querySelectorAll('a')].map((a) => [
        a.getAttribute('href'),
        a.getAttribute('target'),
      ]),
    ).toEqual([
      ['/terms', '_blank'],
      ['/privacy', '_blank'],
      ['/refund', '_blank'],
    ])
  })
})
