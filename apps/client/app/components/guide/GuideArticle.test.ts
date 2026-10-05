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
import {
  ArrowPathIcon,
  DevicePhoneMobileIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  InformationCircleIcon,
  LightBulbIcon,
  PowerIcon,
  WifiIcon,
} from '@heroicons/vue/24/outline'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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
      content.eyebrow,
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
      ...content.help.faqs.flatMap((f) => [f.q, ...f.a, f.link?.label ?? '']),
    ].filter(Boolean)
    for (const s of all) expect(text, s).toContain(norm(guidePlainText(s)))
  })

  it('화면 글자에 인라인 표기({{ [[ ** (( 와 짝)가 하나도 남지 않는다', () => {
    expect(text).not.toMatch(/\{\{|\}\}|\[\[|\]\]|\*\*|\(\(|\)\)/)
  })

  it('삭제 경고가 설치 단계보다 앞에 있다(확인 구간 → STEP 1 순서)', () => {
    const alert = w.find('.g-alert').element
    const step1 = w.find('#step1').element
    expect(alert.compareDocumentPosition(step1) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('문제 해결은 접지 않는다(D-6) — details · 숨김 · display:none 0, 질문 번호 Q1…', () => {
    expect(w.findAll('details')).toHaveLength(0)
    expect(w.findAll('[hidden]')).toHaveLength(0)
    for (const el of w.findAll('.g-faq, .g-faq__a, .g-faq__a p')) {
      expect((el.element as HTMLElement).style.display).not.toBe('none')
      expect(getComputedStyle(el.element).display).not.toBe('none')
      expect(getComputedStyle(el.element).visibility).not.toBe('hidden')
    }
    expect(w.findAll('.g-faq__n').map((n) => n.text())).toEqual(
      content.help.faqs.map((_, i) => `Q${i + 1}`),
    )
  })

  it('구간 바로가기 5개 — 글자 · 목적지가 spec F-4 그대로이고, 목적지 구간에 그 단계의 배지 · 제목이 있다', () => {
    const chips = w.findAll('.g-jump__chip')
    expect(chips.map((c) => [c.text(), c.attributes('href')])).toEqual([
      ['설치 전 확인', '#check'],
      ['STEP 1 설치', '#step1'],
      ['STEP 2 설정', '#step2'],
      ['STEP 3 현지', '#step3'],
      ['문제 해결', '#help'],
    ])
    const sec = (id: string) => norm(w.find(`#${id}`).text())
    expect(sec('check')).toContain('설치 전에 확인해 주세요')
    expect(sec('check')).toContain(content.checks.alert.title)
    for (const [id, part, step] of [
      ['step1', content.step1, 'STEP 1'],
      ['step2', content.step2, 'STEP 2'],
      ['step3', content.step3, 'STEP 3'],
    ] as const) {
      expect(sec(id)).toContain(part.title)
      expect(w.find(`#${id} .g-badge`).text().startsWith(step), id).toBe(true)
    }
    expect(w.find('#step3 .g-badge').text()).toBe('STEP 3 · 현지 도착 후')
    expect(sec('help')).toContain('설치나 연결이 잘 안 되나요?')
    expect(GUIDE_SECTIONS).toHaveLength(5)
  })

  it('단계 번호는 구간마다 1부터 순서대로 · n번째 단계는 n번째 문장(본문의 «7번» · «4~5번» 이 맞으려면)', () => {
    const lists = [
      ...content.step1.methods.map((m) => m.steps),
      content.step2.steps,
      content.step3.steps,
    ]
    const ols = w.findAll('ol.g-steps')
    expect(ols).toHaveLength(lists.length)
    ols.forEach((ol, k) => {
      const items = ol.findAll('li.g-step')
      expect(items.map((li) => li.find('.g-step__num').text().replace(/\D/g, ''))).toEqual(
        lists[k]!.map((_, i) => String(i + 1)),
      )
      items.forEach((li, i) =>
        expect(norm(li.text())).toContain(norm(guidePlainText(lists[k]![i]!.text))),
      )
    })
  })

  it('문의 · 흐름 글자(D-4 · 2609 판) — OS 페이지 문의 제목은 «그래도 …» · 흐름 칸에 소요 시간', () => {
    expect(w.find('#guide-cs-title').text()).toBe('그래도 해결되지 않으면 문의해 주세요')
    expect(text).toContain('설치 화면을 캡처해 보내 주시면 더 빨리 도와드릴 수 있어요.')
    expect(
      w
        .findAll('.g-flow__item')
        .map((li) =>
          ['.g-flow__step', '.g-flow__title', '.g-flow__meta'].map((c) => norm(li.find(c).text())),
        ),
    ).toEqual([
      ['STEP 1', '집에서 설치', '출국 전 · 5분'],
      ['STEP 2', '회선 설정', '설치 직후 · 1분'],
      ['STEP 3', '현지에서 켜기', '도착 후 · 1분'],
    ])
  })

  it('OS 전환 — 지금 페이지만 aria-current="page", 두 링크는 /guide/ios · /guide/android', () => {
    const tabs = w.findAll('.g-os__tab')
    expect(tabs.map((t) => [t.attributes('href'), t.attributes('aria-current') ?? null])).toEqual([
      [GUIDE_PAGES.ios.to, os === 'ios' ? 'page' : null],
      [GUIDE_PAGES.android.to, os === 'android' ? 'page' : null],
    ])
  })

  it('상태 표시줄 그림 1개 — 캡션 · 대체 글이 2609 판 뜻 그대로(아이폰: 위 칸 = 여행용 eSIM)', () => {
    const st = w.findAll('.g-status')
    expect(st).toHaveLength(1)
    expect(st[0]!.attributes('role')).toBe('img')
    if (os === 'ios') {
      expect(norm(st[0]!.find('.g-status__cap').text())).toBe(
        '위 칸 = 여행용 eSIM · 아래 칸 = 한국 회선',
      )
      expect(st[0]!.attributes('aria-label')).toContain('위 칸은 여행용 eSIM, 아래 칸은 한국 회선')
    } else {
      expect(norm(st[0]!.find('.g-status__cap').text())).toBe('신호 표시 + 5G 또는 LTE')
      expect(st[0]!.attributes('aria-label')).toContain('5G 또는 LTE')
    }
  })

  it('안내 박스 종류(경고 · 팁 · 참고 · 귀국)가 콘텐츠 순서 그대로 화면 클래스로 — 경고는 빨간 박스', () => {
    const want = [
      ...content.step1.methods.flatMap((m) => (m.note ? [m.note.tone] : [])),
      ...content.step1.notes.map((n) => n.tone),
      ...content.step2.notes.map((n) => n.tone),
      ...content.step3.notes.map((n) => n.tone),
    ]
    const got = w.findAll('.g-note').map((n) =>
      n
        .classes()
        .find((c) => c.startsWith('g-note--'))
        ?.slice(8),
    )
    expect(got).toEqual(want)
    expect(got.filter((t) => t === 'warn').length).toBeGreaterThanOrEqual(2)
  })

  it('아이콘 짝 — 안내 박스(경고 = 삼각 느낌표 · 참고 = 동그라미 i · 팁 = 전구 · 귀국 = 집) · 확인 카드(인터넷 = Wi-Fi 등)', () => {
    const svg = (c: unknown) =>
      mount(c as never)
        .find('svg')
        .html()
        .replace(/\s(class|aria-hidden|data-v-[\w-]+)="[^"]*"/g, '')
    const NOTE = {
      warn: ExclamationTriangleIcon,
      info: InformationCircleIcon,
      tip: LightBulbIcon,
      home: HomeIcon,
    } as const
    for (const n of w.findAll('.g-note')) {
      const tone = n
        .classes()
        .find((c) => c.startsWith('g-note--'))!
        .slice(8) as keyof typeof NOTE
      expect(
        n
          .find('svg')
          .html()
          .replace(/\s(class|aria-hidden|data-v-[\w-]+)="[^"]*"/g, ''),
        tone,
      ).toBe(svg(NOTE[tone]))
    }
    const CHECK = {
      wifi: WifiIcon,
      update: ArrowPathIcon,
      device: DevicePhoneMobileIcon,
      clean: PowerIcon,
    } as const
    const tiles = w.findAll('.g-check__tile')
    expect(tiles).toHaveLength(content.checks.items.length)
    content.checks.items.forEach((c, i) =>
      expect(
        tiles[i]!.find('svg')
          .html()
          .replace(/\s(class|aria-hidden|data-v-[\w-]+)="[^"]*"/g, ''),
        c.title,
      ).toBe(svg(CHECK[c.icon])),
    )
    expect(
      content.checks.items.map((c) => [c.icon, c.title.includes('인터넷') ? 'net' : ''])[0],
    ).toEqual(['wifi', 'net'])
  })

  it('머리 안내 줄(빨간 테두리 = 설명이 가리키는 곳 — «누를 곳» 이 아니다, D-10) · 단계 번호 화면낭독 글자 «N번.» · 새 창 링크 안내', () => {
    // «꺼 두세요» 단계도 스위치를 강조한다 — «누를 곳» 으로 읽히면 로밍 요금 위험(QA ⑥ R5)
    expect(w.find('.g-hero__hint').text()).toBe(
      '화면의 빨간 테두리는 설명이 가리키는 곳이에요. 켜고 끄는 건 설명을 따라 주세요.',
    )
    expect(w.find('.g-hero__hint').text()).not.toMatch(/누를 곳|누르세요/)
    const first = w.find('ol.g-steps .g-step__num')
    expect(first.text()).toBe('1번.')
    expect(first.find('.g-step__sr').text()).toBe('번.')
    for (const a of w.findAll('a.g-cs__card')) expect(a.text()).toContain('(새 창)')
  })

  it('문의 — 카카오톡 채널 · 네이버 톡톡이 새 탭 링크 · 고객센터 전체 보기(F-5)', () => {
    const cards = w.findAll('a.g-cs__card')
    expect(
      cards.map((a) => [a.attributes('href'), a.attributes('target'), a.attributes('rel')]),
    ).toEqual([
      [SUPPORT_KAKAO_URL, '_blank', 'noopener noreferrer'],
      [SMARTSTORE_URL, '_blank', 'noopener noreferrer'],
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

describe('화면 스타일 고정(spec ⑤ · D-6 — happy-dom 은 컴포넌트 CSS 를 적용하지 않아 소스로 본다)', () => {
  const css = (f: string) =>
    readFileSync(`${process.cwd()}/app/components/guide/${f}`, 'utf8').split('<style scoped>')[1] ??
    ''
  const rule = (f: string, sel: string) =>
    css(f).match(
      new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
    )?.[2] ?? ''
  it('줄바꿈 금지 묶음 · 이미지 창 폭 · 이미지가 창 폭을 채움', () => {
    expect(rule('GuideText.vue', '.g-nw')).toMatch(/white-space:\s*nowrap/)
    expect(rule('GuideShot.vue', '.g-shot')).toMatch(/max-width:\s*calc\(368px \+ 10px\)/)
    expect(rule('GuideShot.vue', '.g-shot')).toMatch(/width:\s*100%/)
    expect(rule('GuideShot.vue', '.g-shot__img')).toMatch(/width:\s*100%/)
  })
  it('가이드 화면 어디에도 숨김(display:none · visibility:hidden · 높이 0 · max-height) 규칙이 없다 — 문제 해결은 전부 펼침', () => {
    for (const f of [
      'GuideArticle.vue',
      'GuideSteps.vue',
      'GuideNote.vue',
      'GuideText.vue',
      'GuideShot.vue',
      'GuideContact.vue',
      'GuideFlow.vue',
      'GuideStatusBar.vue',
    ]) {
      expect(css(f), f).not.toMatch(
        /display:\s*none|visibility:\s*hidden|max-height|height:\s*0[^.\d]/,
      )
    }
  })
})

/**
 * 화면 골든(client-guide spec S-2 · S-3 · ⑤) — 렌더된 본문 구조(태그 · 클래스 · 속성 · 글자 · 순서)와 가이드 스타일 전체.
 * 단계 ↔ 이미지 짝 · 보조 문장 칸 · 문단 경계 · 화면낭독 속성 · 줄간격 · 줄바꿈 규칙 · 색 · 테두리를 한 번에 고정한다.
 * 고정한 상태 = QA ⑥ 8회차 실측(폭 320–440 · 원본 대조 · 명암비)으로 확인한 화면. 일부러 바꾸면 spec 을 먼저 고치고
 * WRITE_GUIDE_GOLDEN=1 로 다시 쓴다.
 */
describe('화면 골든 — 본문 DOM · 가이드 스타일', () => {
  const dir = `${process.cwd()}/app/components/guide/__golden__`
  const check = (name: string, now: string) => {
    const f = `${dir}/${name}`
    if (process.env.WRITE_GUIDE_GOLDEN === '1') writeFileSync(f, now)
    expect(existsSync(f), `${name} 없음 — WRITE_GUIDE_GOLDEN=1 로 쓴다`).toBe(true)
    expect(now).toBe(readFileSync(f, 'utf8'))
  }
  const dom = (html: string) => html.replace(/\sdata-v-[\w-]+(="[^"]*")?/g, '') + '\n'
  it.each([
    ['ios', IOS_GUIDE],
    ['android', ANDROID_GUIDE],
  ] as const)('%s 본문 DOM', (os, content) => {
    check(`article.${os}.html`, dom(render(content).html()))
  })
  it('가이드 컴포넌트 · 허브 스타일(줄간격 · keep-all · 색 · 테두리 · 폭)', () => {
    const files = [
      'app/components/guide/GuideArticle.vue',
      'app/components/guide/GuideContact.vue',
      'app/components/guide/GuideFlow.vue',
      'app/components/guide/GuideNote.vue',
      'app/components/guide/GuideShot.vue',
      'app/components/guide/GuideStatusBar.vue',
      'app/components/guide/GuideSteps.vue',
      'app/components/guide/GuideText.vue',
      'app/pages/guide/index.vue',
    ]
    const css = files
      .map(
        (f) =>
          `/* ${f} */\n` +
          (readFileSync(`${process.cwd()}/${f}`, 'utf8').split('<style scoped>')[1] ?? '').replace(
            /<\/style>\s*$/,
            '',
          ),
      )
      .join('\n')
    check('styles.css', css)
  })
})
