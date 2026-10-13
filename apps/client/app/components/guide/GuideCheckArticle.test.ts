// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { CHECK_ANDROID, CHECK_IOS, NETWORK_GUIDE } from '~/content/guide/check'
import { figureSrc, type FigureKey } from '~/content/guide/figures'
import { guidePlainText } from '~/content/guide/inline'
import type { GuideCheckContent } from '~/content/guide/types'
import GuideCheckArticle from './GuideCheckArticle.vue'

/** client-guide-check spec S-1 · S-2 · S-3 · S-5 · F-1~F-3 · F-5 · DoD 4 · 5 — 본문이 콘텐츠를 빠짐없이 그리고, 판마다 링크가 맞는가 */
const NuxtLink = defineComponent({
  props: { to: { type: String, default: '' }, custom: Boolean },
  setup:
    (props, { slots, attrs }) =>
    () =>
      props.custom
        ? slots.default?.({ href: props.to, navigate: () => {} })
        : h('a', { ...attrs, href: props.to }, slots.default?.()),
})
const render = (content: GuideCheckContent, mode: 'page' | 'bare' = 'page') =>
  mount(GuideCheckArticle, { props: { content, mode }, global: { stubs: { NuxtLink } } })
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out))
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      // 주소 · 키 · 아이콘 이름은 화면 글자가 아니다
      if (!['page', 'bare', 'key', 'id', 'os', 'icon', 'tone', 'status', 'figure', 'figures'].includes(k))
        strings(x, out)
    }
  return out
}

const CASES = [
  ['check-ios', CHECK_IOS, ['ios-cellular-arrival', 'ios-line-check', 'ios-celldata-travel'], 1],
  [
    'check-android',
    CHECK_ANDROID,
    ['aos-sim-esim1', 'aos-sim-arrival-data', 'aos-roaming-esim'],
    0,
  ],
  ['network', NETWORK_GUIDE, ['ios-line-network', 'ios-network-auto', 'aos-carrier-auto'], 0],
] as const

describe.each(CASES)('%s 본문', (_key, content, figures, statusBars) => {
  const w = render(content)
  const text = norm(w.text())

  it('콘텐츠의 모든 문장이 화면 글자에 있다 · 표기 잔여 0', () => {
    for (const s of strings(content)) expect(text, s).toContain(norm(guidePlainText(s)))
    expect(text).not.toMatch(/\{\{|\}\}|\[\[|\]\]|\*\*|\(\(|\)\)/)
  })

  it('머리 h1 하나 · 구간 = 콘텐츠 순서 · 구간 id = 칩 목적지', () => {
    expect(w.findAll('h1').map((x) => x.text())).toEqual([content.title])
    expect(w.findAll('section.g-sec[id]').map((s) => s.attributes('id'))).toEqual(
      content.sections.map((s) => s.id),
    )
    expect(w.findAll('.g-jump__chip').map((a) => a.attributes('href'))).toEqual(
      content.chips.map((c) => `#${c.id}`),
    )
    for (const s of content.sections) {
      const sec = w.find(`#${s.id}`)
      expect(sec.attributes('aria-labelledby')).toBe(`${s.id}-title`)
      expect(sec.find(`#${s.id}-title`).text()).toBe(s.title)
      expect(sec.classes().includes('g-sec--alt')).toBe(s.alt)
    }
  })

  it('화면 창 · 상태 표시줄 그림 수와 순서(DoD 5)', () => {
    expect(w.findAll('img.g-shot__img').map((i) => i.attributes('src'))).toEqual(
      figures.map((k) => figureSrc(k as FigureKey)),
    )
    expect(w.findAll('.g-status').length).toBe(statusBars)
  })

  it('사이트판 칩 줄은 헤더 아래(--under-header) · 전용판은 화면 맨 위', () => {
    expect(w.find('.g-jump').classes()).toContain('g-jump--under-header')
    expect(render(content, 'bare').find('.g-jump').classes()).not.toContain('g-jump--under-header')
  })

  it('문의 블록 하나 · 설명은 «설정 화면을 캡처해 …»', () => {
    expect(w.findAll('#guide-cs-title').length).toBe(1)
    expect(w.find('.g-cs__lede').text()).toBe(
      '설정 화면을 캡처해 보내 주시면 더 빨리 도와드릴 수 있어요.',
    )
  })
})

describe('링크 목적지 — 사이트판 / 전용판(S-5 — 메뉴 없는 판끼리)', () => {
  const hrefs = (content: GuideCheckContent, mode: 'page' | 'bare') =>
    render(content, mode)
      .findAll('a')
      .map((a) => a.attributes('href'))
      .filter((h): h is string => !!h && h.startsWith('/'))

  it('아이폰 설치 확인 — 머리 링크 · OS 전환 · 끝 카드 · 고객센터', () => {
    expect(hrefs(CHECK_IOS, 'page')).toEqual([
      '/guide/ios',
      '/guide/check/ios',
      '/guide/check/android',
      '/guide/network#ios',
      '/guide/ios#help',
      '/my#cs',
    ])
    expect(hrefs(CHECK_IOS, 'bare')).toEqual([
      '/install-guide/ios',
      '/install-guide/check/ios',
      '/install-guide/check/android',
      '/install-guide/network#ios',
      '/install-guide/ios#help',
      '/my#cs',
    ])
  })

  it('안드로이드 설치 확인 — OS 전환 «안드로이드» 가 지금 페이지', () => {
    const w = render(CHECK_ANDROID)
    expect(w.findAll('.g-os__tab').map((t) => [t.text(), t.attributes('aria-current')])).toEqual([
      ['아이폰', undefined],
      ['안드로이드', 'page'],
    ])
    expect(hrefs(CHECK_ANDROID, 'bare')).toContain('/install-guide/android#help')
  })

  it('통신사 바꾸기 — OS 전환 없음 · 칩 2 · tip 링크 · 설치 확인 두 칸 · 나라별 통신사 카드', () => {
    const w = render(NETWORK_GUIDE)
    expect(w.find('.g-os').exists()).toBe(false)
    expect(w.findAll('.g-jump__chip').map((c) => c.text())).toEqual(['아이폰', '안드로이드'])
    expect(hrefs(NETWORK_GUIDE, 'page')).toEqual([
      '/guide/carriers',
      '/guide/check/ios',
      '/guide/check/android',
      '/guide/carriers',
      '/my#cs',
    ])
    expect(hrefs(NETWORK_GUIDE, 'bare')).toEqual([
      '/install-guide/carriers',
      '/install-guide/check/ios',
      '/install-guide/check/android',
      '/install-guide/carriers',
      '/my#cs',
    ])
    // tip 링크는 문장 사이(«… 통신사는 <a>나라별 현지 통신사</a>에서 볼 수 있어요.»)
    expect(norm(w.find('.g-note--tip .g-note__more').text())).toBe(
      '나라별로 연결할 수 있는 통신사는 나라별 현지 통신사에서 볼 수 있어요.',
    )
  })

  it('새 탭으로 여는 사이트 안 링크는 없다(카카오 · 네이버만 새 탭)', () => {
    for (const c of [CHECK_IOS, CHECK_ANDROID, NETWORK_GUIDE]) {
      const blank = render(c)
        .findAll('a[target="_blank"]')
        .map((a) => a.attributes('href'))
      for (const h of blank) expect(h).toMatch(/^https:\/\//)
    }
  })
})

describe('칩 글자 — «확인 n» 은 붙여 둔다(설치 가이드 «STEP n» 과 같은 구조)', () => {
  it('아이폰 칩 4 · 안드로이드 칩 2', () => {
    const chips = (c: GuideCheckContent) =>
      render(c)
        .findAll('.g-jump__chip')
        .map((x) => [x.find('.g-jump__step').text(), norm(x.text())])
    expect(chips(CHECK_IOS)).toEqual([
      ['확인 1', '확인 1 셀룰러'],
      ['확인 2', '확인 2 회선'],
      ['확인 3', '확인 3 데이터'],
      ['확인 4', '확인 4 신호'],
    ])
    expect(chips(CHECK_ANDROID)).toEqual([
      ['확인 1', '확인 1 SIM 관리자'],
      ['확인 2', '확인 2 데이터 로밍'],
    ])
  })
})
