// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
// 페이지는 파일 수집 때 import 한다 — 테스트 안 동적 import 는 첫 변환(SFC 전부)이 제한 시간에 들어가 바쁜 기계에서 넘친다(turbo 병렬 실행)
import AndroidPage from './android.vue'
import IosPage from './ios.vue'

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

const PAGES = { './ios.vue': IosPage, './android.vue': AndroidPage } as const

// 페이지 설명은 spec 글자로 고정한다(아이폰 설명을 안드로이드 페이지에 붙여도 통과하지 않게)
const DESC = {
  ios: '아이폰 eSIM 설치 가이드 — QR 코드로 집에서 설치하고, 이어서 나오는 화면과 현지에서 여행용 eSIM 을 켜는 법을 화면과 함께 안내해요.',
  android:
    '안드로이드(갤럭시) eSIM 설치 가이드 — SIM 관리자에서 QR 코드로 설치하고, 현지에서 모바일 데이터와 데이터 로밍을 켜는 법을 화면과 함께 안내해요.',
} as const

describe.each([
  ['ios', './ios.vue', '아이폰 eSIM 설치 가이드', 24, '/guide/ios', '아이폰'],
  ['android', './android.vue', '안드로이드 eSIM 설치 가이드', 17, '/guide/android', '안드로이드'],
] as const)('%s 페이지', (os, file, h1, shots, path, word) => {
  it(`제목 «${h1}» · 화면 ${shots}장 · OS 탭 · SEO 제목과 설명(${path})`, () => {
    const w = mount(PAGES[file], { global: { stubs: { NuxtLink } } })
    expect(w.find('h1').text()).toBe(h1)
    expect(w.findAll('img.g-shot__img')).toHaveLength(shots)
    expect(w.find('.g-os__tab--on').attributes('href')).toBe(path)
    expect(seo).toHaveBeenCalledTimes(1)
    const meta = seo.mock.calls[0]![0] as { title: string; description: string }
    expect(meta.title).toBe(h1)
    expect(meta.description).toContain(word)
    expect(meta.description).toBe(DESC[os])
    w.unmount()
  })
})
