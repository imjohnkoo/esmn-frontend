// @vitest-environment happy-dom
// 발급 화면 설치 가이드 시트(client-guide spec D-13 · S-4 · DoD 8) — 실제로 마운트해 «어느 가이드가 열리는가 · 시트 안에서 움직이는가 ·
// 발급 화면을 떠나는 링크가 없는가 · 닫히는가» 를 본다. 발급 화면 카드 → v-model 연결은 guide.test.ts(소스), 실제 화면은 walk(E2E 5).
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { computed, defineComponent, h, nextTick, ref, watch } from 'vue'
import { readFileSync } from 'node:fs'
import { ANDROID_GUIDE } from '~/content/guide/android'
import { GUIDE_PAGES, GUIDE_SECTIONS } from '~/content/guide/common'
import { IOS_GUIDE } from '~/content/guide/ios'
import type { GuideOs } from '~/content/guide/types'
import { SMARTSTORE_URL, SUPPORT_KAKAO_URL } from '~/content/support'
import GuideSheet from './GuideSheet.vue'

// Nuxt 자동 import 대신 — 컴포넌트는 Nuxt 안에서처럼 전역 이름으로 찾는다
Object.assign(globalThis, { ref, computed, watch, nextTick })

// 단언이 실패해도 포털(body 로 옮겨진 시트)이 다음 테스트로 새지 않게
enableAutoUnmount(afterEach)

const settle = async () => {
  await nextTick()
  await nextTick()
}
const $ = <T extends Element = HTMLElement>(sel: string) => document.body.querySelector<T>(sel)
const $$ = <T extends Element = HTMLElement>(sel: string) => [
  ...document.body.querySelectorAll<T>(sel),
]
const title = () => $('.n-bottom-sheet__title')?.textContent?.trim()
const region = () => $('.guide-sheet')!
const buttonByText = (sel: string, text: string) =>
  $$<HTMLButtonElement>(sel).find((b) => b.textContent?.trim() === text)!

// 시트 판에는 NuxtLink 가 없어야 한다 — 쓰이면 이 대역이 표시를 남긴다
const stubs = {
  NuxtLink: defineComponent({
    props: { to: { type: String, default: '' } },
    setup:
      (props, { slots }) =>
      () =>
        h('a', { href: props.to, 'data-nuxt-link': '' }, slots.default?.()),
  }),
}

/** v-model 을 쥔 부모 — 발급 화면처럼 OS 를 넣고, 시트가 바꾸거나 닫으면 그 값이 돌아오는지 본다 */
const host = async (initial: GuideOs | null) => {
  const os = ref<GuideOs | null>(initial)
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(GuideSheet, {
          modelValue: os.value,
          'onUpdate:modelValue': (v: GuideOs | null) => {
            os.value = v
          },
        }),
    }),
    { attachTo: document.body, global: { stubs } },
  )
  await settle()
  return { os, wrapper }
}

describe.each([
  ['ios', IOS_GUIDE, 24],
  ['android', ANDROID_GUIDE, 17],
] as const)('%s 로 열면 그 가이드', (os, content, shots) => {
  it(`제목 = 카드 이름 · 본문 = 같은 가이드(이미지 ${shots}장 · 단계 문장)`, async () => {
    await host(os)
    expect(title()).toBe(GUIDE_PAGES[os].label)
    expect(region().getAttribute('aria-label')).toBe(GUIDE_PAGES[os].label)
    expect(region().getAttribute('tabindex')).toBe('0')
    expect($$('.guide-sheet img.g-shot__img')).toHaveLength(shots)
    const text = region().textContent ?? ''
    expect(text).toContain(content.step1.title)
    expect(text).toContain(content.help.title)
  })
})

describe('시트 안 이동 — 주소를 바꾸지 않는다', () => {
  it('OS 전환은 버튼 — 누르면 부모 값이 바뀌고 시트 안 내용 · 제목이 바뀐다(본문 맨 위로)', async () => {
    const { os } = await host('ios')
    const tabs = $$<HTMLButtonElement>('.guide-sheet .g-os__tab')
    expect(
      tabs.map((t) => [t.tagName, t.type, t.textContent?.trim(), t.getAttribute('aria-pressed')]),
    ).toEqual([
      ['BUTTON', 'button', GUIDE_PAGES.ios.short, 'true'],
      ['BUTTON', 'button', GUIDE_PAGES.android.short, 'false'],
    ])
    region().scrollTop = 900
    buttonByText('.guide-sheet .g-os__tab', GUIDE_PAGES.android.short).click()
    await settle()
    expect(os.value).toBe('android')
    expect(title()).toBe(GUIDE_PAGES.android.label)
    expect($$('.guide-sheet img.g-shot__img')).toHaveLength(17)
    expect(region().scrollTop).toBe(0)
    expect(
      buttonByText('.guide-sheet .g-os__tab', GUIDE_PAGES.android.short).getAttribute(
        'aria-pressed',
      ),
    ).toBe('true')
  })

  it('구간 바로가기 4 = spec 글자 · 버튼(D-21 — «설치 전 확인» 없음 · 사이트판과 같은 칩) — 누르면 시트 본문만 그 구간 머리로 움직인다(해시 그대로)', async () => {
    await host('ios')
    const chips = $$<HTMLButtonElement>('.guide-sheet .g-jump__chip')
    expect(chips.map((c) => [c.tagName, c.textContent?.trim()])).toEqual([
      ['BUTTON', 'STEP 1 설치'],
      ['BUTTON', 'STEP 2 설정'],
      ['BUTTON', 'STEP 3 현지'],
      ['BUTTON', '문제 해결'],
    ])
    expect(chips.map((c) => c.querySelector('.g-jump__step')?.textContent ?? null)).toEqual([
      'STEP 1',
      'STEP 2',
      'STEP 3',
      null,
    ])
    expect($('#gs-check'), '설치 전 확인 구간은 그대로').toBeTruthy()
    // 시트 판 구간 id 는 접두(gs-) — 발급 화면 문서의 다른 id 와 겹치지 않게 · 맨 id 는 없다
    for (const s of GUIDE_SECTIONS) {
      expect($(`#gs-${s.id}`), s.id).toBeTruthy()
      expect($(`#${s.id}`), s.id).toBeNull()
    }
    const box = region()
    const target = $('#gs-step3')!
    box.getBoundingClientRect = () => ({ top: 100 }) as DOMRect
    target.getBoundingClientRect = () => ({ top: 640 }) as DOMRect
    box.scrollTop = 50
    const hash = location.hash
    const step3 = GUIDE_SECTIONS.find((s) => s.id === 'step3')!
    buttonByText('.guide-sheet .g-jump__chip', step3.label).click()
    await settle()
    expect(box.scrollTop).toBe(50 + 540)
    expect(location.hash).toBe(hash)
    // 칩 줄이 본문 맨 위에 붙어 있으면(D-23) 그 높이만큼 덜 내려 구간 머리가 칩 줄 바로 아래에 온다
    const bar = $('.guide-sheet .g-jump')!
    bar.getBoundingClientRect = () => ({ top: 100, height: 53, bottom: 153 }) as DOMRect
    box.scrollTop = 50
    buttonByText('.guide-sheet .g-jump__chip', step3.label).click()
    await settle()
    expect(box.scrollTop).toBe(50 + 540 - 53)
    expect(location.hash).toBe(hash)
    // 포커스도 그 구간 제목으로(키보드 · 화면낭독기가 그 구간에서 이어 읽는다) — 제목은 탭 순서에 없다(-1)
    expect(document.activeElement?.id).toBe('gs-step3-title')
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1')
  })

  it('구간 머리 · 이름 연결도 접두 id 로(aria-labelledby → 실제 제목)', async () => {
    await host('android')
    for (const sec of $$('.guide-sheet section.g-sec')) {
      const ref = sec.getAttribute('aria-labelledby')!
      expect(ref).toMatch(/^gs-/)
      expect($(`#${ref}`)?.tagName).toBe('H2')
    }
  })
})

describe('발급 화면을 떠나는 링크 — 숨기거나 새 탭', () => {
  it('«내 eSIM 조회하기» 0 · 사이트 페이지로 가는 같은 탭 링크 0(NuxtLink 0)', async () => {
    await host('ios')
    expect(region().textContent).not.toContain('내 eSIM 조회하기')
    expect($$('.guide-sheet [data-nuxt-link]')).toHaveLength(0)
    for (const a of $$<HTMLAnchorElement>('.guide-sheet a[href]')) {
      // 남는 링크는 전부 새 탭(카카오톡 · 네이버 톡톡 · 고객센터)
      expect([a.getAttribute('href'), a.getAttribute('target')]).toEqual([
        a.getAttribute('href'),
        '_blank',
      ])
      expect(a.getAttribute('rel')).toContain('noopener')
      expect(a.textContent).toContain('(새 창)')
    }
  })

  it('«지원 기기 확인하기»(D-22) · «고객센터 전체 보기» = 새 탭 «(새 창)» · 카카오톡 · 네이버 톡톡 = 고객센터 정의 값 새 탭 — 시트 안 링크는 전부 새 탭', async () => {
    await host('android')
    const links = $$<HTMLAnchorElement>('.guide-sheet a[href]')
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/supported-devices',
      SUPPORT_KAKAO_URL,
      SMARTSTORE_URL,
      '/my#cs',
    ])
    for (const a of links) {
      expect(a.target, a.href).toBe('_blank')
      expect(a.rel, a.href).toContain('noopener')
    }
    const devices = $$<HTMLAnchorElement>('.guide-sheet a.g-check__link')
    expect(devices.map((a) => a.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      '지원 기기 확인하기(새 창)',
    ])
    const more = $$<HTMLAnchorElement>('.guide-sheet a.g-cs__more')
    expect(more).toHaveLength(1)
    expect(more[0]!.textContent?.replace(/\s+/g, ' ').trim()).toBe('고객센터 전체 보기(새 창)')
  })
})

describe('닫기 — X · Esc · 다시 열기', () => {
  it('X(«닫기») 를 누르면 닫히고 부모 값이 null', async () => {
    const { os } = await host('ios')
    const x = $<HTMLButtonElement>('.n-bottom-sheet__close')!
    expect(x.getAttribute('aria-label')).toBe('닫기')
    x.click()
    await settle()
    expect(os.value).toBeNull()
    expect($('.n-bottom-sheet__content')).toBeNull()
  })

  it('Esc 로 닫힌다', async () => {
    const { os } = await host('android')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(os.value).toBeNull()
    expect($('.n-bottom-sheet__content')).toBeNull()
  })

  it('닫혀 있으면 아무것도 그리지 않고, 닫은 뒤 다른 OS 로 열면 그 OS', async () => {
    const { os } = await host(null)
    expect($('.n-bottom-sheet__content')).toBeNull()
    os.value = 'ios'
    await settle()
    expect(title()).toBe(GUIDE_PAGES.ios.label)
    $<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    os.value = 'android'
    await settle()
    expect(title()).toBe(GUIDE_PAGES.android.label)
    expect($$('.guide-sheet img.g-shot__img')).toHaveLength(17)
  })
})

describe('시트 모양(S-4)', () => {
  const css =
    readFileSync(`${process.cwd()}/app/components/guide/GuideSheet.vue`, 'utf8').split(
      '<style scoped>',
    )[1] ?? ''
  it('본문만 스크롤 · 시트 높이 90% 안 · 본문 제목 줄(h1)은 시트 제목과 겹쳐 숨김', () => {
    const box = css.match(/\.guide-sheet \{([^}]*)\}/)?.[1] ?? ''
    expect(box).toMatch(/overflow-y: auto;/)
    // 위치 기준 — 화면낭독용 숨김 글자(absolute)가 시트 틀이 아니라 이 영역 안에 놓이게(없으면 시트 틀이 따로 스크롤 — QA ⑥ R1 M1 · 실측은 walk)
    expect(box).toMatch(/position: relative;/)
    expect(box).toMatch(/max-height: calc\(90dvh - 112px\);/)
    expect(css).toMatch(/\.guide-sheet :deep\(\.g-hero__title\) \{\s*display: none;\s*\}/)
  })
})
