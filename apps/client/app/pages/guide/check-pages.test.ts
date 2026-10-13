// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component } from 'vue'
import { GUIDE_BARE_ROUTES, STATIC_DESCRIPTIONS, STATIC_ROUTES } from '#shared/catalog/seo'
import { isNoindexPath } from '#shared/utils/robots'
import { CHECK_ANDROID, CHECK_IOS, NETWORK_GUIDE } from '~/content/guide/check'
// 페이지는 파일 수집 때 import 한다(install-guide-pages.test.ts 와 같은 이유)
import BareCheckAndroid from '../install-guide/check/android.vue'
import BareCheckIos from '../install-guide/check/ios.vue'
import BareNetwork from '../install-guide/network.vue'
import SiteCheckAndroid from './check/android.vue'
import SiteCheckIos from './check/ios.vue'
import SiteNetwork from './network.vue'

/** client-guide-check spec F-5 · F-8 · S-1~S-3 · S-5 · DoD 1 · 2 — 페이지 6 결선: 레이아웃 · 본문 · 판 · canonical · 설명 */
const seo = vi.fn()
const pageMeta = vi.fn()
beforeEach(() => {
  seo.mockClear()
  pageMeta.mockClear()
  vi.stubGlobal('useCatalogSeo', seo)
  vi.stubGlobal('definePageMeta', pageMeta)
})
afterEach(() => vi.unstubAllGlobals())

const NuxtLink = defineComponent({
  props: { to: { type: String, default: '' }, custom: Boolean },
  setup:
    (props, { slots, attrs }) =>
    () =>
      props.custom
        ? slots.default?.({ href: props.to, navigate: () => {} })
        : h('a', { ...attrs, href: props.to }, slots.default?.()),
})

// 설명(spec §⑤ 공통 표 글자 그대로 — 상수를 비추지 않게)
const DESC = {
  '/guide/check/ios':
    '현지에서 아이폰 eSIM이 연결되지 않을 때 셀룰러 · 회선 · 셀룰러 데이터 설정을 화면과 비교해 확인해요.',
  '/guide/check/android':
    '현지에서 갤럭시 eSIM이 연결되지 않을 때 SIM 관리자 · 데이터 로밍 설정을 화면과 비교해 확인해요.',
  '/guide/network':
    '연결이 불안정할 때 아이폰 · 안드로이드에서 현지 통신사를 직접 고르는 방법이에요.',
} as const

const CASES: [string, Component, Component, keyof typeof DESC, string, string][] = [
  [
    '아이폰 설치 확인',
    SiteCheckIos,
    BareCheckIos,
    '/guide/check/ios',
    '/install-guide/check/ios',
    CHECK_IOS.title,
  ],
  [
    '안드로이드 설치 확인',
    SiteCheckAndroid,
    BareCheckAndroid,
    '/guide/check/android',
    '/install-guide/check/android',
    CHECK_ANDROID.title,
  ],
  [
    '통신사 바꾸기',
    SiteNetwork,
    BareNetwork,
    '/guide/network',
    '/install-guide/network',
    NETWORK_GUIDE.title,
  ],
]

describe.each(CASES)('%s', (_name, Site, Bare, site, bare, title) => {
  const render = (P: Component) => mount(P, { global: { stubs: { NuxtLink } } })

  it(`사이트판 ${site} — default 레이아웃 · 칩 줄 헤더 아래 · SEO = 자기 설명 · canonical 기본(자기 주소)`, () => {
    const w = render(Site)
    expect(pageMeta).not.toHaveBeenCalled()
    expect(w.find('h1').text()).toBe(title)
    expect(w.find('.g-jump').classes()).toContain('g-jump--under-header')
    expect(seo).toHaveBeenCalledWith({ title, description: DESC[site] })
    expect(STATIC_DESCRIPTIONS[site]).toBe(DESC[site])
    expect(STATIC_ROUTES as readonly string[]).toContain(site)
    expect(isNoindexPath(site)).toBe(false)
    w.unmount()
  })

  it(`전용판 ${bare} — flow 레이아웃 · 같은 본문 · 링크는 전용판끼리 · canonical = 사이트판 · noindex 아님`, () => {
    const w = render(Bare)
    expect(pageMeta).toHaveBeenCalledWith({ layout: 'flow' })
    expect(w.find('h1').text()).toBe(title)
    expect(w.find('.g-jump').classes()).not.toContain('g-jump--under-header')
    const [meta, image, canonical] = seo.mock.calls[0]!
    expect(meta).toEqual({ title, description: DESC[site] })
    expect(image).toBeUndefined()
    expect(canonical).toBe(site)
    expect(GUIDE_BARE_ROUTES as readonly string[]).toContain(bare)
    expect(isNoindexPath(bare)).toBe(false)
    const local = w
      .findAll('a')
      .map((a) => a.attributes('href'))
      .filter((h): h is string => !!h && h.startsWith('/') && h !== '/my#cs')
    expect(local.length).toBeGreaterThan(0)
    for (const h of local) expect(h).toMatch(/^\/install-guide\//)
    // 사이트판 본문 글자 = 전용판 본문 글자
    const site_ = render(Site)
    expect(w.find('article').text()).toBe(site_.find('article').text())
    site_.unmount()
    w.unmount()
  })
})
