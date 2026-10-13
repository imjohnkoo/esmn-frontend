// @vitest-environment happy-dom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Suspense, defineComponent, h, ref, type Component } from 'vue'
import { GUIDE_BARE_ROUTES, STATIC_DESCRIPTIONS, STATIC_ROUTES } from '#shared/catalog/seo'
import { isNoindexPath } from '#shared/utils/robots'
import { carrierGroups } from '#shared/catalog/pages'
import { fixtureCatalog } from '#shared/catalog/test-data'
import { CARRIERS_GUIDE, CHECK_ANDROID, CHECK_IOS, NETWORK_GUIDE } from '~/content/guide/check'
// 페이지는 파일 수집 때 import 한다(install-guide-pages.test.ts 와 같은 이유)
import BareCarriers from '../install-guide/carriers.vue'
import BareCheckAndroid from '../install-guide/check/android.vue'
import BareCheckIos from '../install-guide/check/ios.vue'
import BareNetwork from '../install-guide/network.vue'
import SiteCarriers from './carriers.vue'
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

describe('나라별 현지 통신사 — 데이터 라우트 · 같은 key · 실패하면 500(fail-closed — D-15)', () => {
  const groups = carrierGroups(fixtureCatalog())
  const fetch = vi.fn()
  const createError = vi.fn((e: unknown) => Object.assign(new Error('createError'), e))
  beforeEach(() => {
    fetch.mockReset()
    vi.stubGlobal('useFetch', fetch)
    vi.stubGlobal('createError', createError)
  })
  const mountPage = async (P: Component) => {
    const errors: unknown[] = []
    const w = mount(
      defineComponent({ render: () => h(Suspense, null, { default: () => h(P) }) }),
      { global: { stubs: { NuxtLink }, config: { errorHandler: (e) => void errors.push(e) } } },
    )
    await flushPromises()
    return { w, errors }
  }

  it.each([
    ['사이트판 /guide/carriers', SiteCarriers, false],
    ['전용판 /install-guide/carriers', BareCarriers, true],
  ] as const)('%s — 머리 · 안내 · 목록 · SEO · canonical', async (_n, P, bare) => {
    fetch.mockResolvedValue({ data: ref(groups), error: ref(null) })
    const { w, errors } = await mountPage(P)
    expect(errors).toEqual([])
    expect(fetch).toHaveBeenCalledWith('/api/catalog/carriers', { key: 'catalog-carriers' })
    expect(w.find('h1').text()).toBe(CARRIERS_GUIDE.title)
    expect(w.find('.g-jump').exists()).toBe(false)
    expect(w.find('.g-hero__hint').exists()).toBe(false)
    expect(w.findAll('.g-carriers__row').length).toBe(groups.flatMap((g) => g.rows).length)
    expect(w.find('.g-note__link').attributes('href')).toBe(bare ? '/install-guide/network' : '/guide/network')
    const [meta, , canonical] = seo.mock.calls[0]!
    expect(meta).toEqual({
      title: CARRIERS_GUIDE.title,
      description: '이심마니 여행용 eSIM이 나라마다 연결할 수 있는 현지 통신사 목록이에요.',
    })
    expect(STATIC_DESCRIPTIONS['/guide/carriers']).toBe(meta.description)
    if (bare) {
      expect(pageMeta).toHaveBeenCalledWith({ layout: 'flow' })
      expect(canonical).toBe('/guide/carriers')
      expect(GUIDE_BARE_ROUTES as readonly string[]).toContain('/install-guide/carriers')
    } else {
      expect(pageMeta).not.toHaveBeenCalled()
      expect(canonical).toBeUndefined()
      expect(STATIC_ROUTES as readonly string[]).toContain('/guide/carriers')
    }
    w.unmount()
  })

  it.each([
    ['라우트 오류', { data: ref(null), error: ref(new Error('x')) }],
    ['빈 응답', { data: ref(null), error: ref(null) }],
  ])('%s → 500 으로 던진다(빈 목록 페이지를 만들지 않는다)', async (_n, res) => {
    fetch.mockResolvedValue(res)
    const { errors } = await mountPage(SiteCarriers)
    expect(createError).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500, fatal: true }))
    expect(errors.length).toBe(1)
  })
})
