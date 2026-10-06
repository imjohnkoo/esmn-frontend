// @vitest-environment happy-dom
// 본인 확인 화면 설치 가이드(client-guide spec D-19 · DoD 6 · E2E 5) — 화면을 실제로 마운트해
// «약관 링크 아래 · 주문 확인하기 위 카드 2 · 보조키 없는 클릭은 그 OS 시트 · 뒤로 가기 = 시트 닫기 · 입력한 이름 · 전화 그대로 · 주소의 다른 값(reason) 그대로» 를 본다.
// 서버 호출 · 흐름 쿠키는 대역(누르지 않는 «주문 확인하기» 외에는 부르지 않는다). 라우터는 주소 · 기록만 흉내 내는 대역.
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { GUIDE_PAGES } from '~/content/guide/common'
import VerifyPage from './[orderId].vue'

const verifyOrder = vi.fn()
vi.mock('~/composables/useApi', () => ({ useApi: () => ({ verifyOrder }) }))
vi.mock('~/composables/useFlowSession', () => ({
  useFlowSession: () => ({ read: () => null, start: vi.fn(), select: vi.fn(), clear: vi.fn() }),
}))

// Nuxt 자동 import 대신
Object.assign(globalThis, { ref, computed, watch, nextTick })

type Query = Record<string, string>
const VERIFY = '/verify/2026092300000101'
const fullPathOf = (q: Query) => {
  const qs = new URLSearchParams(q).toString()
  return qs ? `${VERIFY}?${qs}` : VERIFY
}
const route = reactive({ params: { orderId: '2026092300000101' }, query: {} as Query })
let stack: Query[] = []
// vue-router 처럼 앞 칸 주소를 history.state.back 에 적는다
const syncState = () =>
  window.history.replaceState(
    { back: stack.length ? fullPathOf(stack[stack.length - 1]!) : null },
    '',
  )
const router = {
  push: vi.fn(async (to: string | { query: Query }) => {
    if (typeof to === 'string') return
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
  verifyOrder.mockReset()
  router.push.mockClear()
  router.replace.mockClear()
  router.back.mockClear()
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('useRoute', () => route)
  vi.stubGlobal('useRouter', () => router)
})
afterEach(() => vi.unstubAllGlobals())
enableAutoUnmount(afterEach)

// 링크 기본 동작(새 탭)은 문서 끝에서 막는다 — 테스트 환경이 링크를 실제로 따라가 네트워크 요청을 보내지 않게
let prevented: boolean | null = null
const stopNavigation = (e: Event) => {
  prevented = e.defaultPrevented
  e.preventDefault()
}
beforeEach(() => document.addEventListener('click', stopNavigation))
afterEach(() => document.removeEventListener('click', stopNavigation))
const press = (card: HTMLElement) => {
  prevented = null
  card.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
  return prevented
}

const settle = async () => {
  await nextTick()
  await nextTick()
  await nextTick()
}
const render = async (query: Query = {}) => {
  route.query = { ...query }
  const w = mount(VerifyPage, { attachTo: document.body })
  await settle()
  return w
}
const cards = () => [
  ...document.body.querySelectorAll<HTMLAnchorElement>('.verify-page .guide-cards__list > a'),
]
const inputs = () => [
  ...document.body.querySelectorAll<HTMLInputElement>('.verify-page__form input'),
]
const title = () => document.body.querySelector('.n-bottom-sheet__title')?.textContent?.trim()
const sheetOpen = () => !!document.body.querySelector('.n-bottom-sheet__content')
const typeInto = async (el: HTMLInputElement, value: string) => {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await settle()
}

describe('본인 확인 화면 설치 가이드 — 약관 링크 아래(D-19)', () => {
  it('개인정보처리방침 · 이용약관 링크 바로 아래 · «주문 확인하기» 위에 카드 2 = 사이트판 링크(새 탭) · 시트를 연다고 알린다', async () => {
    await render()
    expect(
      cards().map((a) => [
        a.getAttribute('href'),
        a.getAttribute('target'),
        a.getAttribute('aria-haspopup'),
      ]),
    ).toEqual([
      [GUIDE_PAGES.ios.to, '_blank', 'dialog'],
      [GUIDE_PAGES.android.to, '_blank', 'dialog'],
    ])
    const policy = document.body.querySelector('.verify-page__policy')!
    const guides = document.body.querySelector('.verify-page .guide-cards')!
    const cta = document.body.querySelector('.verify-page__cta')!
    // 문서 순서 — 약관 링크 → 설치 가이드 → 주문 확인하기(D-19)
    expect(policy.compareDocumentPosition(guides) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(guides.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(sheetOpen()).toBe(false)
  })

  it('입력을 채운 채 카드 · 시트 안 버튼 · X 를 눌러도 폼 제출(submit) 0 · 로딩 0 · 서버 호출 0 — 카드는 링크, 시트는 폼 밖(body)', async () => {
    await render()
    const [name, phone] = inputs()
    await typeInto(name!, '테스트고객')
    await typeInto(phone!, '01000000001')
    const form = document.body.querySelector<HTMLFormElement>('.verify-page__form')!
    let submits = 0
    form.addEventListener('submit', () => submits++)
    press(cards()[0]!)
    await settle()
    const sheet = document.body.querySelector('.n-bottom-sheet__content')!
    expect(form.contains(sheet)).toBe(false)
    for (const b of document.body.querySelectorAll<HTMLButtonElement>('.guide-sheet button')) {
      b.click()
      await settle()
    }
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')?.click()
    await settle()
    press(cards()[1]!)
    await settle()
    expect(submits).toBe(0)
    expect(document.body.querySelector('.n-loader-dialog__content')).toBeNull()
    expect(verifyOrder).not.toHaveBeenCalled()
    // 대조 — 같은 폼을 진짜로 제출하면 이 검사가 잡는다(검사가 비어 있지 않다). 입력을 비워 검증에서 멈추게 —
    // 다음 테스트로 넘어가는 지연 호출을 남기지 않는다
    await typeInto(name!, '')
    form.requestSubmit()
    expect(submits).toBe(1)
  })

  it('입력한 채 카드 → 시트(?guide=ios) · 뒤로 가기 → 시트만 닫히고 입력은 그대로 · 서버 호출 0', async () => {
    await render()
    const [name, phone] = inputs()
    await typeInto(name!, '테스트고객')
    await typeInto(phone!, '01000000001')
    expect(press(cards()[0]!)).toBe(true)
    await settle()
    expect(router.push).toHaveBeenCalledWith({ query: { guide: 'ios' } })
    expect(title()).toBe(GUIDE_PAGES.ios.label)
    expect(document.body.querySelectorAll('.guide-sheet img.g-shot__img')).toHaveLength(24)
    router.back() // 휴대폰 뒤로 가기
    await settle()
    expect(sheetOpen()).toBe(false)
    expect(inputs().map((i) => i.value)).toEqual(['테스트고객', '010-0000-0001'])
    expect(verifyOrder).not.toHaveBeenCalled()
  })

  it('X 로 닫으면 기록 한 칸 뒤로(쌓이지 않음) · 입력 그대로 — 안드로이드', async () => {
    await render()
    await typeInto(inputs()[0]!, '테스트고객')
    press(cards()[1]!)
    await settle()
    expect(title()).toBe(GUIDE_PAGES.android.label)
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    expect(router.back).toHaveBeenCalledTimes(1)
    expect(stack).toEqual([])
    expect(sheetOpen()).toBe(false)
    expect(inputs()[0]!.value).toBe('테스트고객')
  })

  it('다시 확인으로 돌아온 화면(?reason=reverify)은 그 값을 남긴 채 ?guide 만 붙였다 뗀다 · 안내 문구 그대로', async () => {
    await render({ reason: 'reverify' })
    expect(document.body.querySelector('.verify-page__reverify')).toBeTruthy()
    press(cards()[0]!)
    await settle()
    expect(router.push).toHaveBeenCalledWith({ query: { reason: 'reverify', guide: 'ios' } })
    expect(document.body.querySelector('.verify-page__reverify')).toBeTruthy()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(route.query).toEqual({ reason: 'reverify' })
    expect(sheetOpen()).toBe(false)
  })
})
