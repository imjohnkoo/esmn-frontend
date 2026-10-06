// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { readFileSync } from 'node:fs'
import { GUIDE_BARE_ROUTES } from '#shared/catalog/seo'
import { isNoindexPath } from '#shared/utils/robots'
import { GUIDE_BARE, GUIDE_SECTIONS } from '~/content/guide/common'
// 페이지는 파일 수집 때 import 한다(guide-pages.test.ts 와 같은 이유 — 테스트 안 동적 import 는 바쁜 기계에서 제한 시간을 넘긴다)
import AndroidPage from './android.vue'
import IosPage from './ios.vue'

/** client-guide spec D-14 · S-5 · F-9 · DoD 9 — 가이드 전용판: flow 레이아웃 · 같은 본문 · OS 전환은 전용판끼리 · canonical = 사이트판(noindex 없음 — D-18) */
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
  props: { to: { type: String, default: '' } },
  setup:
    (props, { slots, attrs }) =>
    () =>
      h('a', { ...attrs, href: props.to, 'data-nuxt-link': '' }, slots.default?.()),
})

// 설명은 사이트판(/guide/<os>) 글자 그대로 — spec 글자로 고정(guide-pages.test.ts 와 같은 문장)
const DESC = {
  ios: '아이폰 eSIM 설치 가이드 — QR 코드로 집에서 설치하고, 이어서 나오는 화면과 현지에서 여행용 eSIM 을 켜는 법을 화면과 함께 안내해요.',
  android:
    '안드로이드(갤럭시) eSIM 설치 가이드 — SIM 관리자에서 QR 코드로 설치하고, 현지에서 모바일 데이터와 데이터 로밍을 켜는 법을 화면과 함께 안내해요.',
} as const

describe.each([
  [
    'ios',
    IosPage,
    '아이폰 eSIM 설치 가이드',
    24,
    '/install-guide/ios',
    '/install-guide/android',
    '/guide/ios',
  ],
  [
    'android',
    AndroidPage,
    '안드로이드 eSIM 설치 가이드',
    17,
    '/install-guide/android',
    '/install-guide/ios',
    '/guide/android',
  ],
] as const)('%s 전용판', (os, Page, h1, shots, self, other, site) => {
  const render = () => mount(Page, { global: { stubs: { NuxtLink } } })

  it(`flow 레이아웃(헤더 · 하단 탭 없음) · 4-step 가드 없음 · 제목 «${h1}» · 화면 ${shots}장`, () => {
    const w = render()
    expect(pageMeta).toHaveBeenCalledTimes(1)
    expect(pageMeta.mock.calls[0]![0]).toEqual({ layout: 'flow' })
    expect(w.find('h1').text()).toBe(h1)
    expect(w.findAll('img.g-shot__img')).toHaveLength(shots)
    w.unmount()
  })

  it(`OS 전환은 전용판끼리(${self} · ${other}) — 사이트판으로 나가지 않는다 · 바로가기는 같은 페이지 앵커`, () => {
    const w = render()
    const tabs = w.findAll('.g-os__tab')
    expect(tabs.map((t) => [t.attributes('href'), t.classes('g-os__tab--on')])).toEqual(
      os === 'ios'
        ? [
            [self, true],
            [other, false],
          ]
        : [
            [other, false],
            [self, true],
          ],
    )
    expect(w.find('.g-os__tab--on').attributes('aria-current')).toBe('page')
    expect(w.findAll('.g-jump__chip').map((a) => a.attributes('href'))).toEqual(
      GUIDE_SECTIONS.map((s) => `#${s.id}`),
    )
    for (const s of GUIDE_SECTIONS) expect(w.find(`#${s.id}`).exists(), s.id).toBe(true)
    w.unmount()
  })

  it(`SEO — 제목 · 설명은 사이트판과 같고 canonical 은 사이트판(${site}) · noindex 아님(D-18 — canonical 하나로 묶는다)`, () => {
    render().unmount()
    expect(seo).toHaveBeenCalledTimes(1)
    const [meta, image, canonical] = seo.mock.calls[0]!
    expect(meta).toEqual({ title: h1, description: DESC[os] })
    expect(image).toBeUndefined()
    expect(canonical).toBe(site)
    expect(isNoindexPath(self)).toBe(false)
    expect(isNoindexPath(site)).toBe(false)
  })

  it('문제 해결 «내 eSIM 조회하기» · «고객센터 전체 보기» 는 사이트 페이지로 같은 탭(전용판은 발급 화면이 아니다)', () => {
    const w = render()
    const links = w.findAll('a[data-nuxt-link]').map((a) => a.attributes('href'))
    expect(links).toContain('/my-esim')
    expect(links).toContain('/my#cs')
    const more = w.find('a.g-cs__more')
    expect(more.attributes('target')).toBeUndefined()
    w.unmount()
  })
})

describe('전용판 경로 · 레이아웃(D-14)', () => {
  it('경로 = 콘텐츠 정의(GUIDE_BARE) = 프리렌더 목록(GUIDE_BARE_ROUTES)', () => {
    expect([GUIDE_BARE.ios, GUIDE_BARE.android]).toEqual([...GUIDE_BARE_ROUTES])
  })

  it('flow 레이아웃 = 사이트 헤더 · 하단 탭 없음 · 사업자정보 푸터(작은 판) 있음(K5)', () => {
    const layout = readFileSync(`${process.cwd()}/app/layouts/flow.vue`, 'utf8')
    expect(layout).not.toMatch(/ShellHeader|BottomTabBar/)
    expect(layout).toMatch(/<SiteFooter compact \/>/)
  })
})
