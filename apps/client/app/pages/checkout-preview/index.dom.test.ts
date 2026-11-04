// @vitest-environment happy-dom
// 테스트 체크아웃 동작(client-shell spec F-19 · F-22 · D-38 (b) · D-59) — 페이지를 실제로 마운트하고 토스 SDK 는 가짜로 바꿔 끼운다.
// 보는 것: 동의 전에는 어떤 버튼 · 링크 · 경로로도 결제 요청 0 · 렌더된 동의 블록 글자 = 05-B · 필수 2개(약관 · 14세) ∧ 위젯 준비 뒤에만 결제 버튼 활성 ·
// 동의 기본 해제 · 선택(마케팅)은 결제와 무관 · 키가 비면 SDK 로드 0 · 동의해도 요청 0.
// 소스 배선(문구 출처 · 결제 경로 · 블록 밖 글자)은 legal-links.test.ts 가 정적으로, 실제 결제창은 walk(E2E-6)가 본다.
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { CHECKOUT_NOTICE } from '~/content/legal/checkout-notice'
import { PENDING_PAYMENT_KEY } from '~/utils/checkout-preview'
import { checkoutPreviewFromCatalog } from '#shared/catalog/preview'
import { fixtureRaw } from '#shared/catalog/test-data'
import { parseCatalog } from '#shared/catalog/validate'
import Page from './index.vue'

// 위젯 가짜 — 두 render 는 테스트가 끝낼 때까지 걸어 둘 수 있다(위젯 미준비 상태)
const sdk = vi.hoisted(() => {
  // 약관 위젯 — 실제 위젯처럼(⑦ walk 실측) 필수 약관이 체크된 채 그려지고, 구독해도 처음 상태를 알리지 않는다 · 바뀔 때만 emit
  const agreement = {
    emit: null as null | ((s: { agreedRequiredTerms: boolean }) => void),
    on: vi.fn((_name: string, cb: (s: { agreedRequiredTerms: boolean }) => void) => {
      agreement.emit = cb
    }),
  }
  const widgets = {
    agreement,
    setAmount: vi.fn(async () => undefined),
    renderPaymentMethods: vi.fn(async () => ({})),
    renderAgreement: vi.fn(async () => agreement),
    requestPayment: vi.fn(async (_req: { orderId: string }): Promise<undefined> => undefined),
  }
  const toss = { widgets: vi.fn(() => widgets) }
  return { widgets, toss, loadTossPayments: vi.fn(async () => toss), ANONYMOUS: '@@ANONYMOUS' }
})
vi.mock('@tosspayments/tosspayments-sdk', () => ({
  loadTossPayments: sdk.loadTossPayments,
  ANONYMOUS: sdk.ANONYMOUS,
}))
const requestPayment = sdk.widgets.requestPayment

const toss = { clientKey: 'test_ck_test_only' }
// 상품 = 빌드 모듈이 앱 설정에 넣는 값(catalog F-12) — 여기서는 카탈로그 픽스처로 같은 함수를 돌린다
const PREVIEW_ITEM = checkoutPreviewFromCatalog(parseCatalog(fixtureRaw()))
const navigateTo = vi.fn()
const route: { query: Record<string, string> } = { query: {} }
// Nuxt 자동 import 대신 — 페이지가 전역 이름으로 찾는다
Object.assign(globalThis, {
  ref,
  computed,
  onMounted,
  onBeforeUnmount,
  definePageMeta: () => {},
  useHead: () => {},
  useRoute: () => route,
  useRuntimeConfig: () => ({ public: { toss } }),
  useAppConfig: () => ({ checkoutPreview: PREVIEW_ITEM }),
  navigateTo,
})

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.clearAllMocks()
  sdk.widgets.renderPaymentMethods.mockImplementation(async () => ({}))
  requestPayment.mockReset()
  requestPayment.mockImplementation(async () => undefined)
  sessionStorage.clear()
  route.query = {}
  toss.clientKey = 'test_ck_test_only'
})

const settle = async () => {
  await flushPromises()
  await nextTick()
}
let current: ReturnType<typeof mount> | null = null
const render = async () => {
  current = mount(Page, { attachTo: document.body })
  await settle()
  return current
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
/** «억지로» 결제를 부른다 — ① disabled 를 걷고 누른다(DS 버튼은 disabled prop 이면 click 을 내보내지 않는다 — 버튼이 막는지)
 *  ② 페이지 결제 핸들러를 직접 부른다(버튼을 거치지 않는 길 — 핸들러 자신의 조건 검사가 막는지) */
const forcePay = async () => {
  const b = payButton()
  b.removeAttribute('disabled')
  b.click()
  await settle()
  await (current!.vm as unknown as { onPay: () => Promise<void> }).onPay()
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
    expect(requestPayment).not.toHaveBeenCalled()
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
    expect(requestPayment).not.toHaveBeenCalled()
    expect(payButton().disabled).toBe(true)
  })

  it.each([
    [{}],
    [
      {
        paymentId: 'pv-1790105212345-abababababababababababab',
        code: 'FAILURE_TYPE_PG',
        message: '테스트',
      },
    ],
    [{ retry: '1', pay: '1' }],
  ])(
    '동의 전 — 모든 요소에 여러 입력(click · pointer · mouse · touch · Enter) · 복귀 쿼리 %o · 타이머를 끝까지 돌려도 SDK 호출 0',
    async (query) => {
      route.query = query
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
      try {
        await render()
        const stop = (e: Event) => e.preventDefault()
        document.addEventListener('click', stop)
        for (const el of document.body.querySelectorAll('*')) {
          if (el.closest('.n-checkbox')) continue // 동의 자체 — 이 테스트는 동의 전 상태를 지킨다
          for (const type of [
            'click',
            'pointerdown',
            'pointerup',
            'mousedown',
            'mouseup',
            'touchstart',
            'touchend',
          ])
            el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }))
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
          )
          el.dispatchEvent(
            new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }),
          )
        }
        document.removeEventListener('click', stop)
        await vi.runAllTimersAsync()
        await settle()
        expect(
          [...document.body.querySelectorAll('[role="checkbox"]')].map((b) =>
            b.getAttribute('aria-checked'),
          ),
        ).toEqual(['false', 'false', 'false'])
        expect(requestPayment).not.toHaveBeenCalled()
      } finally {
        vi.useRealTimers()
      }
    },
  )

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
    expect(requestPayment).not.toHaveBeenCalled()
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
    expect(requestPayment).not.toHaveBeenCalled()
  })

  it('진입 시 위젯을 그린다 — 클라이언트 키 · 비회원(ANONYMOUS) · 원화 금액 · 결제수단 DEFAULT · 약관 AGREEMENT', async () => {
    await render()
    expect(sdk.loadTossPayments).toHaveBeenCalledWith('test_ck_test_only')
    expect(sdk.toss.widgets).toHaveBeenCalledWith({ customerKey: '@@ANONYMOUS' })
    expect(sdk.widgets.setAmount).toHaveBeenCalledWith({
      currency: 'KRW',
      value: PREVIEW_ITEM.amount,
    })
    expect(sdk.widgets.renderPaymentMethods).toHaveBeenCalledWith({
      selector: '#payment-method',
      variantKey: 'DEFAULT',
    })
    expect(sdk.widgets.renderAgreement).toHaveBeenCalledWith({
      selector: '#agreement',
      variantKey: 'AGREEMENT',
    })
    // 금액을 먼저 정하고 그린다(토스 레퍼런스 순서)
    const order = (f: { mock: { invocationCallOrder: number[] } }) => f.mock.invocationCallOrder[0]!
    expect(order(sdk.widgets.setAmount)).toBeLessThan(order(sdk.widgets.renderPaymentMethods))
    expect(order(sdk.widgets.setAmount)).toBeLessThan(order(sdk.widgets.renderAgreement))
    expect(document.body.querySelector('#payment-method')).not.toBeNull()
    expect(document.body.querySelector('#agreement')).not.toBeNull()
    // 우리 «신용 · 체크카드» 라디오는 없다 — 결제수단은 위젯이 그린다
    expect(document.body.textContent).not.toContain('신용 · 체크카드')
  })

  it('위젯이 아직 준비되지 않았으면 필수 2개를 체크해도 비활성 · 억지로 불러도 결제 요청 0 — 준비되면 활성', async () => {
    let finish!: () => void
    sdk.widgets.renderPaymentMethods.mockImplementation(
      () => new Promise((resolve) => (finish = () => resolve({}))),
    )
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    expect(payButton().disabled).toBe(true)
    await forcePay()
    expect(requestPayment).not.toHaveBeenCalled()
    finish()
    await settle()
    expect(payButton().disabled).toBe(false)
  })

  it('토스 약관 위젯에서 필수 약관을 끄면 비활성 · 억지로 불러도 요청 0 — 다시 켜면 활성', async () => {
    await render()
    expect(sdk.widgets.agreement.on).toHaveBeenCalledWith(
      'agreementStatusChange',
      expect.any(Function),
    )
    await toggle(TERMS)
    await toggle(AGE)
    expect(payButton().disabled).toBe(false)
    sdk.widgets.agreement.emit!({ agreedRequiredTerms: false })
    await settle()
    expect(payButton().disabled).toBe(true)
    await forcePay()
    expect(requestPayment).not.toHaveBeenCalled()
    sdk.widgets.agreement.emit!({ agreedRequiredTerms: true })
    await settle()
    expect(payButton().disabled).toBe(false)
  })

  it('SDK 스크립트를 못 불러오면(차단 · 네트워크 · 잘못된 키) 비활성 · 결제 수단 자리에 안내', async () => {
    sdk.loadTossPayments.mockImplementationOnce(async () => {
      throw new Error('script blocked')
    })
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    expect(payButton().disabled).toBe(true)
    expect(document.body.textContent).toContain('결제창을 불러오지 못했어요. 새로고침해 주세요.')
    expect(document.body.textContent).not.toContain('script blocked')
  })

  it('위젯 로드가 실패하면 비활성 · 결제 수단 자리에 안내', async () => {
    sdk.widgets.renderAgreement.mockImplementationOnce(async () => {
      throw new Error('위젯 로드 실패')
    })
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    expect(payButton().disabled).toBe(true)
    expect(document.body.textContent).toContain('결제창을 불러오지 못했어요. 새로고침해 주세요.')
    expect(document.body.textContent).not.toContain('위젯 로드 실패')
  })

  it('필수 2개 ∧ 위젯 준비 뒤 결제 버튼 → 결제 요청 한 번(주문번호 · 주문명 · 복귀 주소 2 · 고객 정보 0) · 주문번호를 이 탭에 기억', async () => {
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    payButton().click()
    await settle()
    expect(requestPayment).toHaveBeenCalledTimes(1)
    const [req] = requestPayment.mock.calls[0] as unknown as [Record<string, unknown>]
    expect(req).toEqual({
      orderId: expect.stringMatching(/^pv-\d+-[0-9a-f]{24}$/),
      orderName: PREVIEW_ITEM.orderName,
      successUrl: `${window.location.origin}/checkout-preview/success`,
      failUrl: `${window.location.origin}/checkout-preview/fail`,
    })
    expect(sessionStorage.getItem(PENDING_PAYMENT_KEY)).toBe(req.orderId)
    // 반환 = 리디렉트 중 — 다시 눌러도 두 번째 호출 없음(로딩 중)
    payButton().click()
    await settle()
    expect(requestPayment).toHaveBeenCalledTimes(1)
  })

  it('주문번호는 결제창을 열기 **전에** 이 탭에 적힌다(리디렉트는 돌아오지 않는다 — 뒤에 적으면 success 가 늘 «이 창 아님»)', async () => {
    let storedAtCall: string | null = 'unset'
    requestPayment.mockImplementationOnce(async (req: { orderId: string }) => {
      storedAtCall = sessionStorage.getItem(PENDING_PAYMENT_KEY)
      expect(storedAtCall).toBe(req.orderId)
      return new Promise<undefined>(() => {}) // 페이지를 떠나는 중 — 끝나지 않는다
    })
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    payButton().click()
    await settle()
    expect(requestPayment).toHaveBeenCalledTimes(1)
    expect(storedAtCall).toMatch(/^pv-\d+-[0-9a-f]{24}$/)
  })

  it('결제 핸들러를 직접 두 번 불러도 요청은 한 번 · 주문번호를 덮지 않는다(요청 중 가드)', async () => {
    requestPayment.mockImplementation(() => new Promise<undefined>(() => {}))
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    const vm = current!.vm as unknown as { onPay: () => Promise<void> }
    void vm.onPay()
    await settle()
    const first = sessionStorage.getItem(PENDING_PAYMENT_KEY)
    void vm.onPay()
    await settle()
    expect(requestPayment).toHaveBeenCalledTimes(1)
    expect(sessionStorage.getItem(PENDING_PAYMENT_KEY)).toBe(first)
  })

  it('위젯 준비 전 결제 핸들러를 직접 불러도 주문번호를 만들지 않고 사유 줄도 없다(준비 가드)', async () => {
    sdk.widgets.renderPaymentMethods.mockImplementation(() => new Promise(() => {}))
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    await (current!.vm as unknown as { onPay: () => Promise<void> }).onPay()
    await settle()
    expect(requestPayment).not.toHaveBeenCalled()
    expect(sessionStorage.getItem(PENDING_PAYMENT_KEY)).toBeNull()
    expect(document.body.querySelector('[role="alert"]')).toBeNull()
  })

  it('결제창에서 뒤로 와 bfcache 로 복원되면(pageshow persisted) 로딩이 풀려 다시 누를 수 있다(D-21) — persisted 아니면 그대로', async () => {
    requestPayment.mockImplementation(() => new Promise<undefined>(() => {}))
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    payButton().click()
    await settle()
    expect(payButton().disabled).toBe(true)
    const show = (persisted: boolean) => {
      const e = new Event('pageshow') as PageTransitionEvent
      Object.defineProperty(e, 'persisted', { value: persisted })
      window.dispatchEvent(e)
    }
    show(false)
    await settle()
    expect(payButton().disabled).toBe(true)
    show(true)
    await settle()
    expect(payButton().disabled).toBe(false)
  })

  it('결제 요청이 거절되면 사유 한 줄 · 버튼이 다시 활성', async () => {
    requestPayment.mockImplementationOnce(async () => {
      throw new Error('결제 요청 실패')
    })
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    payButton().click()
    await settle()
    expect(document.body.textContent).toContain('결제창을 열지 못했어요. (결제 요청 실패)')
    expect(payButton().disabled).toBe(false)
  })

  it('키가 비면 SDK 를 불러오지 않는다 · 필수 2개를 체크해도 비활성 · «결제 설정을 준비하고 있어요.» · 억지로 불러도 요청 0', async () => {
    toss.clientKey = ''
    await render()
    await toggle(TERMS)
    await toggle(AGE)
    expect(sdk.loadTossPayments).not.toHaveBeenCalled()
    expect(payButton().disabled).toBe(true)
    expect(document.body.textContent).toContain('결제 설정을 준비하고 있어요.')
    await forcePay()
    expect(requestPayment).not.toHaveBeenCalled()
  })
})

describe('테스트 체크아웃 — 바깥에서 들어오는 길(D-38 (b) · F-19)', () => {
  it('읽는 쿼리 키 = 0 · 전역 리스너 = pageshow 하나뿐(쿼리 · 포커스 · 메시지 · 키 입력으로 동의를 미리 채우거나 결제를 부르는 길 0)', async () => {
    const readKeys = new Set<string>()
    route.query = new Proxy({} as Record<string, string>, {
      get: (t, k, r) => (typeof k === 'string' && readKeys.add(k), Reflect.get(t, k, r)),
      has: (t, k) => (typeof k === 'string' && readKeys.add(k), Reflect.has(t, k)),
      ownKeys: (t) => (readKeys.add('*'), Reflect.ownKeys(t)),
    })
    const added: string[] = []
    const watch = (target: EventTarget, name: string) => {
      const orig = target.addEventListener.bind(target)
      return vi.spyOn(target, 'addEventListener').mockImplementation((type, ...rest) => {
        added.push(`${name}:${type}`)
        return orig(
          type,
          ...(rest as [EventListenerOrEventListenerObject, AddEventListenerOptions]),
        )
      })
    }
    const spies = [watch(window, 'window'), watch(document, 'document')]
    try {
      await render()
      await toggle(TERMS)
      await toggle(AGE)
      payButton().click()
      await settle()
    } finally {
      spies.forEach((s) => s.mockRestore())
    }
    expect([...readKeys].filter((k) => !k.startsWith('__v_'))).toEqual([])
    expect([...new Set(added)]).toEqual(['window:pageshow'])
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
