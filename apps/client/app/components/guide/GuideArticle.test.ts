// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { ANDROID_GUIDE } from '~/content/guide/android'
import { GUIDE_PAGES, GUIDE_SECTIONS } from '~/content/guide/common'
import { GUIDE_FIGURES, figureSize, figureSrc, type FigureKey } from '~/content/guide/figures'
import { guidePlainText } from '~/content/guide/inline'
import { IOS_GUIDE } from '~/content/guide/ios'
import type { GuideContent } from '~/content/guide/types'
import { SMARTSTORE_URL, SUPPORT_KAKAO_URL } from '~/content/support'
import GuideArticle from './GuideArticle.vue'
import GuideText from './GuideText.vue'

/** client-guide spec S-2 · S-3 · F-3 · F-4 · F-5 · D-6 — 본문이 콘텐츠를 빠짐없이 그리는가 */
const stubs = {
  NuxtLink: defineComponent({
    props: { to: { type: String, default: '' } },
    setup:
      (props, { slots, attrs }) =>
      () =>
        h('a', { ...attrs, href: props.to }, slots.default?.()),
  }),
}
const render = (content: GuideContent) =>
  mount(GuideArticle, { props: { content }, global: { stubs } })
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

describe.each([
  ['ios', IOS_GUIDE, 24],
  ['android', ANDROID_GUIDE, 17],
] as const)('%s 가이드 본문', (os, content, shots) => {
  const w = render(content)
  const text = norm(w.text())

  it(`화면 이미지 ${shots}장 — src · alt · width · height · lazy 가 매니페스트와 같다`, () => {
    const imgs = w.findAll('img.g-shot__img')
    expect(imgs).toHaveLength(shots)
    for (const img of imgs) {
      const src = img.attributes('src')!
      const key = src.match(/^\/guide-screens\/([a-z0-9-]+)\.v\d+\.png$/)?.[1] as FigureKey
      expect(key, src).toBeTruthy()
      expect(src).toBe(figureSrc(key))
      expect(img.attributes('alt')).toBe(GUIDE_FIGURES[key].alt)
      const { width, height } = figureSize(key)
      expect([img.attributes('width'), img.attributes('height')]).toEqual([
        String(width),
        String(height),
      ])
      expect(img.attributes('loading')).toBe('lazy')
    }
  })

  it('모든 단계 · 보조 문장 · 안내 · 질문 · 답이 화면 글자에 있다(표기를 걷은 글자 그대로)', () => {
    const all = [
      content.title,
      ...content.lede,
      content.checks.lede,
      ...content.checks.items.flatMap((c) => [c.title, c.body]),
      content.checks.alert.title,
      content.checks.alert.body,
      ...[content.step1, content.step2, content.step3, content.help].flatMap((s) => [
        s.badge,
        s.title,
        s.lede,
      ]),
      ...content.step1.methods.flatMap((m) => [
        m.tag,
        m.badge,
        m.title,
        m.desc,
        ...(m.note?.lines ?? []),
        ...m.steps.flatMap((s) => [s.text, s.sub ?? '']),
      ]),
      ...[content.step2, content.step3].flatMap((s) =>
        s.steps.flatMap((st) => [st.text, st.sub ?? '']),
      ),
      ...[content.step1, content.step2, content.step3].flatMap((s) =>
        s.notes.flatMap((n) => n.lines),
      ),
      ...content.help.faqs.flatMap((f) => [f.q, ...f.a]),
    ].filter(Boolean)
    for (const s of all) expect(text, s).toContain(norm(guidePlainText(s)))
  })

  it('문제 해결은 접지 않는다(D-6) — details · 숨김 0, 질문 번호 Q1…', () => {
    expect(w.findAll('details')).toHaveLength(0)
    expect(w.findAll('[hidden]')).toHaveLength(0)
    expect(w.findAll('.g-faq__n').map((n) => n.text())).toEqual(
      content.help.faqs.map((_, i) => `Q${i + 1}`),
    )
  })

  it('구간 바로가기 5개가 같은 페이지의 구간 id 를 가리킨다(F-4)', () => {
    const chips = w.findAll('.g-jump__chip')
    expect(chips.map((c) => c.attributes('href'))).toEqual(GUIDE_SECTIONS.map((s) => `#${s.id}`))
    for (const s of GUIDE_SECTIONS) expect(w.find(`#${s.id}`).exists(), s.id).toBe(true)
  })

  it('OS 전환 — 지금 페이지만 aria-current="page", 두 링크는 /guide/ios · /guide/android', () => {
    const tabs = w.findAll('.g-os__tab')
    expect(tabs.map((t) => [t.attributes('href'), t.attributes('aria-current') ?? null])).toEqual([
      [GUIDE_PAGES.ios.to, os === 'ios' ? 'page' : null],
      [GUIDE_PAGES.android.to, os === 'android' ? 'page' : null],
    ])
  })

  it('상태 표시줄 그림 1개(이미지 대신 그림 · 대체 글 있음)', () => {
    const st = w.findAll('.g-status')
    expect(st).toHaveLength(1)
    expect(st[0]!.attributes('role')).toBe('img')
    expect(st[0]!.attributes('aria-label')).toContain('5G')
  })

  it('문의 — 카카오톡 채널 · 네이버 톡톡이 새 탭 링크 · 고객센터 전체 보기(F-5)', () => {
    const cards = w.findAll('a.g-cs__card')
    expect(cards.map((a) => [a.attributes('href'), a.attributes('target')])).toEqual([
      [SUPPORT_KAKAO_URL, '_blank'],
      [SMARTSTORE_URL, '_blank'],
    ])
    expect(w.find('.g-cs__more').attributes('href')).toBe('/my#cs')
  })

  it('«QR 코드를 잃어버렸나요?» 답에 내 eSIM 조회 링크(D-4)', () => {
    expect(w.findAll('.g-faq__link').map((a) => a.attributes('href'))).toEqual(['/my-esim'])
  })
})

describe('GuideText — 글자는 원문 그대로, 이름 · 경로 뒤 조사는 줄바꿈 금지 묶음 안', () => {
  // GuideText 는 여러 루트(토막 배열)라 감싼 p 의 글자로 잰다
  const text = (src: string) =>
    mount(defineComponent({ setup: () => () => h('p', h(GuideText, { src })) }))
  it('표기를 걷은 글자와 화면 글자가 한 글자도 다르지 않다(공백 포함)', () => {
    for (const src of [
      '[[설정 › 셀룰러]]에서 {{eSIM 추가}}를 눌러요.',
      '설치하는 동안 인터넷이 필요해요. ((Wi-Fi나)) 국내 데이터가 연결된 곳에서 설치해 주세요.',
      '**한국 회선의 데이터 로밍은 꺼 두세요.** 켜져 있으면 통신사 로밍 요금이 나올 수 있어요.',
    ])
      expect(text(src).element.textContent).toBe(guidePlainText(src))
  })
  it('{{eSIM 추가}}를 → 이름과 «를» 이 같은 nowrap 묶음 · 경로 마지막 토막에 «에서»', () => {
    const w = text('[[설정 › 셀룰러]]에서 {{eSIM 추가}}를 눌러요.')
    const ui = w.find('.g-ui')
    expect(ui.text()).toBe('eSIM 추가')
    expect(ui.element.parentElement!.className).toBe('g-nw')
    expect(ui.element.parentElement!.textContent).toBe('eSIM 추가를')
    const segs = w.findAll('.g-path > .g-nw').map((s) => s.text())
    expect(segs).toEqual(['설정', '셀룰러에서'])
  })
})
