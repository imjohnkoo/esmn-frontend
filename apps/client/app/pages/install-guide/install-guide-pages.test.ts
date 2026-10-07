// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { readFileSync } from 'node:fs'
import { GUIDE_BARE_ROUTES, STATIC_ROUTES } from '#shared/catalog/seo'
import { isNoindexPath } from '#shared/utils/robots'
import { DEVICES_BARE, DEVICES_PAGE, GUIDE_BARE, GUIDE_SECTIONS } from '~/content/guide/common'
// 페이지는 파일 수집 때 import 한다(guide-pages.test.ts 와 같은 이유 — 테스트 안 동적 import 는 바쁜 기계에서 제한 시간을 넘긴다)
import SiteDevicesPage from '../supported-devices.vue'
import AndroidPage from './android.vue'
import DevicesPage from './devices.vue'
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

  it('문제 해결 «내 eSIM 조회하기» · «고객센터 전체 보기» 는 사이트 페이지로 · 확인 «지원 기기 확인하기» 는 메뉴 없는 지원 기기 전용판으로(D-24) — 모두 같은 탭(전용판은 발급 화면이 아니다)', () => {
    const w = render()
    const links = w.findAll('a[data-nuxt-link]').map((a) => a.attributes('href'))
    expect(links).toContain('/my-esim')
    expect(links).toContain('/my#cs')
    expect(w.find('a.g-check__link').attributes('href')).toBe('/install-guide/devices')
    expect(links).not.toContain('/supported-devices')
    expect(w.find('a.g-check__link').attributes('target')).toBeUndefined()
    // 바로가기 칩 4개(D-21) — «설치 전 확인» 없음
    expect(w.findAll('.g-jump__chip').map((c) => c.text())).toEqual([
      'STEP 1 설치',
      'STEP 2 설정',
      'STEP 3 현지',
      '문제 해결',
    ])
    const more = w.find('a.g-cs__more')
    expect(more.attributes('target')).toBeUndefined()
    w.unmount()
  })
})

describe('전용판 경로 · 레이아웃(D-14)', () => {
  it('경로 = 콘텐츠 정의(GUIDE_BARE) = 프리렌더 목록(GUIDE_BARE_ROUTES)', () => {
    expect([GUIDE_BARE.ios, GUIDE_BARE.android, DEVICES_BARE]).toEqual([...GUIDE_BARE_ROUTES])
  })

  it('flow 레이아웃 = 사이트 헤더 · 하단 탭 없음 · 사업자정보 푸터(작은 판) 있음(K5 — 전용판은 끄지 않는다 · D-20 은 본인 확인 화면만)', () => {
    const layout = readFileSync(`${process.cwd()}/app/layouts/flow.vue`, 'utf8')
    expect(layout).not.toMatch(/ShellHeader|BottomTabBar/)
    expect(layout).toMatch(/<SiteFooter v-if="showFooter" compact \/>/)
  })
})

describe('지원 기기 전용판 /install-guide/devices(D-24)', () => {
  // 기종 목록 컴포넌트는 Nuxt 자동 import(ref)를 쓴다 — 테스트가 끼운다
  beforeEach(() => vi.stubGlobal('ref', ref))
  const strip = (html: string) => html.replace(/\sdata-v-[\w-]+(="[^"]*")?/g, '')

  it('flow 레이아웃(헤더 · 하단 탭 없음) · 머리 · 기종 목록이 /supported-devices 와 글자 · 구조 그대로', () => {
    const bare = mount(DevicesPage, { global: { stubs: { NuxtLink } } })
    expect(pageMeta).toHaveBeenCalledTimes(1)
    expect(pageMeta.mock.calls[0]![0]).toEqual({ layout: 'flow' })
    const site = mount(SiteDevicesPage, { global: { stubs: { NuxtLink } } })
    expect(bare.find('.devices-page').exists()).toBe(true)
    expect(strip(bare.find('.devices-page').html())).toBe(strip(site.find('.devices-page').html()))
    expect(bare.text()).toContain('지원하는지 확인해 주세요')
    bare.unmount()
    site.unmount()
  })

  it('템플릿 · 스타일이 /supported-devices 와 한 글자도 다르지 않다(여백 · 배경까지 — 사이트판만 고치면 실패)', () => {
    const block = (f: string, tag: 'template' | 'style') =>
      readFileSync(`${process.cwd()}/app/pages/${f}`, 'utf8').match(
        new RegExp(`<${tag}[^>]*>[\\s\\S]*</${tag}>`),
      )?.[0]
    for (const tag of ['template', 'style'] as const) {
      const site = block('supported-devices.vue', tag)
      expect(site, tag).toBeTruthy()
      expect(block('install-guide/devices.vue', tag), tag).toBe(site)
    }
  })

  it('SEO — 제목 · 설명은 사이트판과 같고 canonical 은 사이트판 주소(DEVICES_PAGE = /supported-devices · 정적 라우트) · noindex 아님 · 주소 = DEVICES_BARE', () => {
    mount(DevicesPage, { global: { stubs: { NuxtLink } } }).unmount()
    expect(seo).toHaveBeenCalledTimes(1)
    const [meta, image, canonical] = seo.mock.calls[0]!
    expect(meta).toEqual({
      title: '지원 기기',
      description: 'eSIM 을 쓸 수 있는 아이폰 · 갤럭시 기종을 확인해 보세요.',
    })
    expect(image).toBeUndefined()
    expect(canonical).toBe(DEVICES_PAGE)
    expect(DEVICES_PAGE).toBe('/supported-devices')
    expect(STATIC_ROUTES).toContain(DEVICES_PAGE)
    expect(DEVICES_BARE).toBe('/install-guide/devices')
    expect(isNoindexPath(DEVICES_BARE)).toBe(false)
  })
})
