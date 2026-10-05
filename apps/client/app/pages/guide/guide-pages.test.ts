// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

/** client-guide spec S-2 · S-3 · F-7 — 각 OS 페이지가 자기 콘텐츠 · 제목 · 설명으로 그려진다(페이지 ↔ 콘텐츠 결선) */
const seo = vi.fn()
beforeEach(() => {
  seo.mockClear()
  vi.stubGlobal('useCatalogSeo', seo)
})
afterEach(() => vi.unstubAllGlobals())

const NuxtLink = defineComponent({
  props: { to: { type: String, default: '' } },
  setup:
    (props, { slots, attrs }) =>
    () =>
      h('a', { ...attrs, href: props.to }, slots.default?.()),
})

const PAGES = {
  './ios.vue': () => import('./ios.vue'),
  './android.vue': () => import('./android.vue'),
} as const

describe.each([
  ['ios', './ios.vue', '아이폰 eSIM 설치 가이드', 24, '/guide/ios', '아이폰'],
  ['android', './android.vue', '안드로이드 eSIM 설치 가이드', 17, '/guide/android', '안드로이드'],
] as const)('%s 페이지', (_os, file, h1, shots, path, word) => {
  it(`제목 «${h1}» · 화면 ${shots}장 · OS 탭 · SEO 제목과 설명(${path})`, async () => {
    const Page = (await PAGES[file]()).default
    const w = mount(Page, { global: { stubs: { NuxtLink } } })
    expect(w.find('h1').text()).toBe(h1)
    expect(w.findAll('img.g-shot__img')).toHaveLength(shots)
    expect(w.find('.g-os__tab--on').attributes('href')).toBe(path)
    expect(seo).toHaveBeenCalledTimes(1)
    const meta = seo.mock.calls[0]![0] as { title: string; description: string }
    expect(meta.title).toBe(h1)
    expect(meta.description).toContain(word)
    expect(meta.description).toContain('설치 가이드')
  })
})
