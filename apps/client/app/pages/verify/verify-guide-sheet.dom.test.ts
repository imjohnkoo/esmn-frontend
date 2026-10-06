// @vitest-environment happy-dom
// 본인 확인 화면 설치 가이드(client-guide spec D-19 · DoD 6 · E2E 5) — 화면을 실제로 마운트해
// «약관 링크 아래 · 주문 확인하기 위 카드 2 · 보조키 없는 클릭은 그 OS 시트 · 뒤로 가기 = 시트 닫기 · 입력한 이름 · 전화 그대로 · 주소의 다른 값(reason) 그대로» 를 본다.
// 서버 호출 · 흐름 쿠키는 대역(누르지 않는 «주문 확인하기» 외에는 부르지 않는다). 라우터는 주소 · 기록만 흉내 내는 대역.
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { readFileSync } from 'node:fs'
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

describe('«주문 확인하기» 는 화면 아래에 붙어 있다(D-25) — 스크롤하면 내용만 움직이고 버튼은 그대로', () => {
  it('버튼 줄은 페이지 맨 끝(폼 바로 뒤 · 설치 가이드 카드 아래) — sticky 의 기준 상자가 페이지라 화면이 낮아도 붙는다 · 제출 버튼은 form 속성으로 폼에 이어진다', async () => {
    await render()
    const page = document.body.querySelector('.verify-page')!
    const form = page.querySelector<HTMLFormElement>('.verify-page__form')!
    const cta = page.querySelector('.verify-page__cta')!
    expect(cta.parentElement).toBe(page)
    expect(form.nextElementSibling).toBe(cta)
    expect(form.contains(cta)).toBe(false)
    const button = cta.querySelector('button')!
    expect(button.getAttribute('type')).toBe('submit')
    expect(form.id).toBe('verify-form')
    expect(button.getAttribute('form')).toBe(form.id)
    expect(cta.textContent?.trim()).toBe('주문 확인하기')
    const guides = form.querySelector('.guide-cards')!
    expect(guides.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // 버튼 뒤로는 화면에 그려지는 형제가 없다(대화상자는 body 로 옮겨진다) — 버튼이 늘 맨 끝
    let next = cta.nextElementSibling
    while (next) {
      expect(next.tagName, next.className).toBe('TEMPLATE')
      next = next.nextElementSibling
    }
  })

  it('CSS — sticky · bottom 0 · 다른 내용 위(z-index) · 흰 바탕(위쪽 흐림) · 내용이 짧으면 맨 아래(margin-top auto) · 포커스한 입력칸 · 링크 아래 여백', () => {
    const css = readFileSync(`${process.cwd()}/app/pages/verify/[orderId].vue`, 'utf8').split(
      '<style scoped>',
    )[1]!
    const rule = (sel: string) =>
      css.match(
        new RegExp(`\\n${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
      )?.[1] ?? ''
    const cta = rule('.verify-page__cta')
    expect(cta).toMatch(/position:\s*sticky/)
    expect(cta).toMatch(/\bbottom:\s*0;/)
    expect(cta).toMatch(/z-index:\s*[1-9]/)
    expect(cta).toMatch(/margin:\s*auto -24px 0;/)
    // 버튼 줄은 불투명 · 누름을 받는다(R12 M1 — 여백을 눌러 밑의 숨은 카드 · 링크가 눌리던 것)
    expect(cta).toMatch(/background:\s*#ffffff;/)
    expect(cta).not.toMatch(/pointer-events/)
    // 흐림은 버튼 줄 위 20px 띠만 — 그 띠만 누름을 밑으로 넘긴다
    const fade = rule('.verify-page__cta::before')
    expect(fade).toMatch(/bottom:\s*100%/)
    expect(fade).toMatch(/height:\s*20px/)
    expect(fade).toMatch(/pointer-events:\s*none/)
    expect(fade).toMatch(/linear-gradient\(to bottom, rgb\(255 255 255 \/ 0\), #ffffff\)/)
    // 끝까지 내렸을 때 흐림 띠가 카드를 덮지 않게 카드 아래 20px
    expect(rule('.verify-page__guides')).toMatch(/margin-bottom:\s*20px/)
    expect(rule('.verify-page__form :deep(:is(input, a))')).toMatch(/scroll-margin-bottom:\s*120px/)
    // sticky 를 푸는 것 — 버튼과 화면 사이 조상(페이지 · flow 레이아웃 · 앱 프레임 — 폼도 덤으로)이 스크롤 상자가 되는 overflow(QA ⑥ R11 m1 · R12 m3)
    const forbidden = /overflow(-x|-y)?:\s*(hidden|auto|scroll)/
    expect(rule('.verify-page__form')).not.toMatch(forbidden)
    expect(rule('.verify-page')).not.toMatch(forbidden)
    const styleOf = (f: string) =>
      readFileSync(`${process.cwd()}/app/${f}`, 'utf8').split(/<style[^>]*>/)[1] ?? ''
    expect(styleOf('layouts/flow.vue')).not.toMatch(forbidden)
    expect(styleOf('app.vue')).not.toMatch(forbidden)
    // 전역 CSS 의 html · body · #__nuxt 도(앱 main.css · DS base.css)
    for (const f of [
      `${process.cwd()}/app/assets/css/main.css`,
      `${process.cwd()}/../../packages/design-vue/src/styles/base.css`,
    ]) {
      const g = readFileSync(f, 'utf8')
      // 가장 안쪽 블록(@media 안 규칙 포함) — 버튼과 화면 사이 조상(html · body · #__nuxt · 앱 프레임 · flow 레이아웃 · 페이지)(R13 m4)
      for (const m of g.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (
          /(^|[\s,])(html|body|#__nuxt|\.app-bg|\.app-frame|\.layout-flow(__main)?|\.verify-page)\b/.test(
            m[1]!,
          )
        )
          expect(m[2], `${f} ${m[1]!.trim()}`).not.toMatch(forbidden)
      }
    }
    // 버튼이 늘 위 — 본인 확인 화면 · 카드 CSS 에 버튼보다 위로 올라오는 쌓임이 없다
    const z = [...css.matchAll(/z-index:\s*(\d+)/g)].map((m) => Number(m[1]))
    expect(z).toEqual([2])
    expect(styleOf('components/guide/GuideCards.vue')).not.toMatch(/z-index|position:/)
  })
})

describe('제출 검증 실패 — 첫 오류 칸으로 포커스(D-25 · QA ⑥ R11 m3 — 아래 붙은 버튼 밑에 오류가 숨지 않게)', () => {
  const submit = async () => {
    document.body.querySelector<HTMLFormElement>('.verify-page__form')!.requestSubmit()
    await settle()
  }

  it('둘 다 비면 이름 칸 · 이름만 넣으면 전화 칸으로 포커스 · 오류 문구가 보인다 · 서버 호출 0', async () => {
    await render()
    await submit()
    expect(document.activeElement).toBe(inputs()[0])
    expect(document.body.querySelectorAll('.verify-page__err')).toHaveLength(2)
    await typeInto(inputs()[0]!, '테스트고객')
    await submit()
    expect(document.activeElement).toBe(inputs()[1])
    expect(document.body.querySelector('.verify-page__err')?.textContent).toContain('전화번호')
    expect(verifyOrder).not.toHaveBeenCalled()
  })

  it('카드를 누를 때 카드 포커스는 스크롤 없이(QA ⑥ R11 m4 — 반쯤 가린 카드를 누르면 뒤 페이지가 밀리던 것)', async () => {
    await render()
    const card = cards()[0]!
    const focus = vi.spyOn(card, 'focus')
    press(card)
    await settle()
    expect(focus).toHaveBeenCalledWith({ preventScroll: true })
  })
})

describe('시트를 닫을 때 페이지가 움직이지 않는다(S-4 · QA ⑥ R12 m1 · R13 m1 · m3 — 포커스 복귀가 만든 스크롤을 되돌린다)', () => {
  // 브라우저가 포커스를 돌려주며 스크롤한 것처럼 — 위치를 바꾸고 scroll 이벤트
  const browserScroll = (y: number) => {
    window.scrollTo(0, y)
    window.dispatchEvent(new Event('scroll'))
  }
  const closeBy = {
    X: () => document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click(),
    뒤로가기: () => router.back(),
  }

  it.each(Object.keys(closeBy) as (keyof typeof closeBy)[])(
    '설치 가이드 시트 — %s 로 닫은 뒤 생긴 스크롤은 닫을 때 자리로 · 사용자가 움직이면 그 뒤는 그대로',
    async (how) => {
      await render()
      press(cards()[1]!)
      await settle()
      window.scrollTo(0, 338)
      closeBy[how]()
      await settle()
      browserScroll(366.5)
      expect(window.scrollY).toBe(338)
      window.dispatchEvent(new Event('wheel'))
      browserScroll(500)
      expect(window.scrollY).toBe(500)
    },
  )

  it('약관 시트(개인정보처리방침) — 닫은 뒤 생긴 스크롤은 닫을 때 자리로', async () => {
    await render()
    document.body.querySelector<HTMLAnchorElement>('.verify-page__policy-link--privacy')!.click()
    await settle()
    expect(document.body.querySelector('.n-bottom-sheet__content')).toBeTruthy()
    window.scrollTo(0, 100)
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    browserScroll(140.5)
    expect(window.scrollY).toBe(100)
    window.dispatchEvent(new Event('touchstart'))
  })
})

describe('폼 밖 «주문 확인하기» 가 폼을 제출한다(D-25 — form 속성)', () => {
  it('버튼의 폼 소유자 = 본인 확인 폼(form 속성) · 그 버튼을 제출자로 내면 submit 1회 · 빈 칸이면 검증에서 멈춘다(서버 호출 0)', async () => {
    // happy-dom 은 form 속성 버튼의 «클릭 → 제출» 을 구현하지 않는다 — 소유자 연결과 제출자 제출로 본다(실제 클릭 제출은 Chromium 실측 — plan as-built)
    await render()
    const form = document.body.querySelector<HTMLFormElement>('.verify-page__form')!
    const button = document.body.querySelector<HTMLButtonElement>('.verify-page__cta button')!
    expect(button.form).toBe(form)
    let submits = 0
    form.addEventListener('submit', () => submits++)
    form.requestSubmit(button)
    await settle()
    expect(submits).toBe(1)
    expect(document.body.querySelectorAll('.verify-page__err')).toHaveLength(2)
    expect(verifyOrder).not.toHaveBeenCalled()
  })

  it('이미 포커스된 칸에서 검증이 실패해도(Enter 제출) 그 칸을 화면 안으로 — scrollIntoView(nearest)(QA ⑥ R13 m2)', async () => {
    await render()
    const [name] = inputs()
    name!.focus()
    const into = vi.fn()
    name!.scrollIntoView = into
    document.body.querySelector<HTMLFormElement>('.verify-page__form')!.requestSubmit()
    await settle()
    expect(document.activeElement).toBe(name)
    expect(into).toHaveBeenCalledWith({ block: 'nearest' })
  })
})
