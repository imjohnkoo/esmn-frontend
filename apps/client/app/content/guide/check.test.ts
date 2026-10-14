import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import { OPERATOR_NOTE } from '../product-detail'
import { ANDROID_GUIDE } from './android'
import {
  CARRIERS_GUIDE,
  CHECK_ANDROID,
  CHECK_CONTACT_LEDE,
  CHECK_IOS,
  NETWORK_GUIDE,
} from './check'
import { GUIDE_AFTER, GUIDE_CARRIERS, GUIDE_CHECK, GUIDE_NETWORK } from './common'
import { GUIDE_FIGURES, type FigureKey } from './figures'
import { guidePlainText, parseGuideInline } from './inline'
import { IOS_GUIDE } from './ios'
import type { GuideCheckContent, GuideLink } from './types'

/** client-guide-check spec F-1~F-3 · F-10 · S-1~S-4 · S-6 · DoD 4 · 6 · D-6 · D-9 · D-14 */
const PAGES = {
  'check-ios': CHECK_IOS,
  'check-android': CHECK_ANDROID,
  network: NETWORK_GUIDE,
} as const
const ALL = [CHECK_IOS, CHECK_ANDROID, NETWORK_GUIDE, CARRIERS_GUIDE, GUIDE_AFTER] as const

function strings(v: unknown, out: string[] = []): string[] {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out))
  return out
}
const plainAll = () =>
  ALL.flatMap((c) => strings(c))
    .map(guidePlainText)
    .join('\n')

function links(v: unknown, out: GuideLink[] = []): GuideLink[] {
  if (Array.isArray(v)) v.forEach((x) => links(x, out))
  else if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>
    if (typeof o.page === 'string' && typeof o.bare === 'string')
      out.push(o as unknown as GuideLink)
    Object.values(o).forEach((x) => links(x, out))
  }
  return out
}

function figuresOf(c: GuideCheckContent): FigureKey[] {
  return c.sections.flatMap((s) => [
    ...(s.figures ?? []),
    ...(s.steps ?? []).flatMap((st) => (st.figure ? [st.figure] : [])),
  ])
}

describe('주소(spec D-2 · S-5) — 사이트판 · 전용판 글자 그대로', () => {
  it('설치 확인 · 통신사 바꾸기 · 나라별 통신사', () => {
    expect(GUIDE_CHECK).toEqual({
      ios: { page: '/guide/check/ios', bare: '/install-guide/check/ios' },
      android: { page: '/guide/check/android', bare: '/install-guide/check/android' },
    })
    expect(GUIDE_NETWORK).toEqual({ page: '/guide/network', bare: '/install-guide/network' })
    expect(GUIDE_CARRIERS).toEqual({ page: '/guide/carriers', bare: '/install-guide/carriers' })
  })

  it('모든 링크의 전용판 주소 = 사이트판 주소의 /guide → /install-guide (메뉴 없는 판끼리 — S-5)', () => {
    const all = links(ALL)
    expect(all.length).toBeGreaterThan(10)
    for (const l of all) {
      expect(l.page, l.label).toMatch(/^\/guide\//)
      expect(l.bare, l.label).toBe(l.page.replace(/^\/guide\//, '/install-guide/'))
    }
  })
})

describe('구조 수(DoD 4)', () => {
  it('확인 목록 — 아이폰 3 · 3 · 2 · 2 / 안드로이드 3 · 2', () => {
    expect(CHECK_IOS.sections.map((s) => s.points?.length)).toEqual([3, 3, 2, 2])
    expect(CHECK_ANDROID.sections.map((s) => s.points?.length)).toEqual([3, 2])
  })
  it('통신사 바꾸기 단계 — 아이폰 3 · 안드로이드 3 (한 페이지 두 구간 — D-10)', () => {
    expect(NETWORK_GUIDE.sections.map((s) => [s.id, s.steps?.length])).toEqual([
      ['ios', 3],
      ['android', 3],
    ])
    expect(NETWORK_GUIDE.os).toBeUndefined()
  })
  it('칩 — 아이폰 확인 4 · 안드로이드 확인 2 · 통신사 2, 칩 id = 구간 id(같은 순서)', () => {
    expect(CHECK_IOS.chips.map((c) => `${c.step} ${c.label}`)).toEqual([
      '확인 1 셀룰러',
      '확인 2 회선',
      '확인 3 데이터',
      '확인 4 신호',
    ])
    expect(CHECK_ANDROID.chips.map((c) => `${c.step} ${c.label}`)).toEqual([
      '확인 1 SIM 관리자',
      '확인 2 데이터 로밍',
    ])
    expect(NETWORK_GUIDE.chips.map((c) => c.label)).toEqual(['아이폰', '안드로이드'])
    for (const c of Object.values(PAGES)) {
      expect(c.chips.map((x) => x.id)).toEqual(c.sections.map((s) => s.id))
    }
  })
  it('구간 바탕 — 흰 · 회색 교대(S-1 · S-2 · S-3)', () => {
    expect(CHECK_IOS.sections.map((s) => s.alt)).toEqual([false, true, false, true])
    expect(CHECK_ANDROID.sections.map((s) => s.alt)).toEqual([false, true])
    expect(NETWORK_GUIDE.sections.map((s) => s.alt)).toEqual([true, false])
  })
  it('화면 창 순서 — spec F-6 · S-1~S-3', () => {
    expect(figuresOf(CHECK_IOS)).toEqual([
      'ios-cellular-arrival',
      'ios-line-check',
      'ios-celldata-travel',
    ])
    expect(CHECK_IOS.sections.find((s) => s.id === 'signal')?.status).toBe('ios')
    expect(figuresOf(CHECK_ANDROID)).toEqual([
      'aos-sim-esim1',
      'aos-sim-arrival-data',
      'aos-roaming-esim',
    ])
    expect(figuresOf(NETWORK_GUIDE)).toEqual([
      'ios-line-network',
      'ios-network-auto',
      'aos-carrier-auto',
    ])
  })
})

describe('문장 — 파서 · 표기 · spec 글자', () => {
  it('모든 문장이 인라인 파서를 통과한다', () => {
    for (const s of ALL.flatMap((c) => strings(c)))
      expect(() => parseGuideInline(s), s).not.toThrow()
  })
  it('제목 · 배지 · 눈썹 · 칩 · 안내 줄 · 카드 · 버튼 글자에는 표기가 없다(그대로 그린다)', () => {
    const plain = [
      ...Object.values(PAGES).flatMap((c) => [
        c.eyebrow,
        c.title,
        c.hint,
        ...c.chips.flatMap((x) => [x.label, x.step ?? '']),
        ...c.sections.flatMap((s) => [s.badge, s.title]),
        ...c.end.cards.flatMap((x) => [x.label, x.sub]),
      ]),
      CARRIERS_GUIDE.eyebrow,
      CARRIERS_GUIDE.title,
      ...CARRIERS_GUIDE.lede.filter((l): l is string => typeof l === 'string'),
      GUIDE_AFTER.title,
      ...links(ALL).map((l) => l.label),
    ]
    for (const s of plain) expect(s, s).not.toMatch(/\{\{|\}\}|\[\[|\]\]|\*\*|\(\(|\)\)/)
  })
  it('요금 경고 두 줄 = 설치 가이드 STEP 3 경고(같은 글자 — 불변식)', () => {
    const iosWarn = IOS_GUIDE.step3.notes.find((n) => n.tone === 'warn')
    const aosWarn = ANDROID_GUIDE.step3.notes.find((n) => n.tone === 'warn')
    expect(CHECK_IOS.sections.find((s) => s.id === 'data')?.notes).toContainEqual(iosWarn)
    expect(CHECK_ANDROID.sections.find((s) => s.id === 'roaming')?.notes).toContainEqual(aosWarn)
    expect(iosWarn?.lines.map(guidePlainText)).toEqual([
      '한국 회선의 데이터 로밍은 꺼 두세요. 켜져 있으면 통신사 로밍 요금이 나올 수 있어요.',
      '셀룰러 데이터 전환 허용도 꺼 두세요. 켜 두면 데이터가 한국 회선으로 넘어갈 수 있어요.',
    ])
  })
  it('다른 여행용 eSIM 은 꺼 두기 · 지우지 않기(D-6) — 두 확인 페이지 확인 1 에', () => {
    const want = [
      '다른 여행용 eSIM이 더 보이나요? 이번에 설치한 것 말고 다른 여행용 eSIM은 꺼 두세요. 지우지 않아도 돼요.',
      '어느 회선인지 모르겠으면 지우지 말고 고객센터로 문의해 주세요. 한 번 지운 eSIM은 다시 설치할 수 없어요.',
    ]
    for (const c of [CHECK_IOS, CHECK_ANDROID]) {
      const warn = c.sections[0]!.notes?.find((n) => n.tone === 'warn')
      expect(warn?.lines.map(guidePlainText)).toEqual(want)
    }
  })
  it('통신사 바꾸기 — 되돌리기 · 나라 이동 전 자동(D-14) · 일반화 문장(D-9)', () => {
    const lines = (id: string) =>
      NETWORK_GUIDE.sections
        .find((s) => s.id === id)!
        .notes!.flatMap((n) => n.lines.map(guidePlainText))
    expect(lines('ios')).toEqual([
      '고른 통신사로도 안 되면 다시 자동으로 돌려 주세요.',
      '다른 나라로 옮기기 전에는 자동을 다시 켜 두세요. 자동이면 폰이 그 나라 통신사로 알아서 바꿔요.',
    ])
    expect(lines('android')).toEqual([
      '고른 통신사로도 안 되면 다시 자동 선택으로 돌려 주세요.',
      '다른 나라로 옮기기 전에는 자동 선택을 다시 켜 두세요. 자동이면 폰이 그 나라 통신사로 알아서 바꿔요.',
    ])
    expect(NETWORK_GUIDE.lede).toEqual([
      '나라와 지역에 따라 잘 잡히는 통신사가 달라요.',
      '연결이 불안정하면 다른 통신사로 바꿔 보세요.',
    ])
    expect(guidePlainText(NETWORK_GUIDE.intro![0]!.lines[0]!)).toBe(
      '여행용 eSIM은 나라에 따라 여러 통신사에 연결할 수 있어요. 통신사마다 잘 잡히는 곳이 달라, 신호가 약한 곳에서는 바꾸면 나아질 수 있어요.',
    )
  })
  it('안드로이드 SKT 경로(D-7) · 확인 시점(D-11) · 문의 설명 · 통신사 단서', () => {
    const plain = plainAll()
    expect(plain).toContain('SKT 폰은 설정 › T로밍 › 로밍 이동통신사 선택에 있어요.')
    expect(plain).toContain(
      'SKT 폰은 메뉴가 달라요. 설정 › T로밍 › 로밍 상세 설정에서 데이터 로밍을 확인해 주세요.',
    )
    expect(guidePlainText(CHECK_IOS.lede[0] as string)).toBe(
      '현지에 도착해 여행용 eSIM을 켠 뒤, 아래 화면과 비교해 확인해 주세요.',
    )
    expect(plain).toContain(
      '한국에서는 여행용 회선이 ‘활성화 중…’으로 보이고 셀룰러 데이터는 메인이에요. 정상이에요.',
    )
    expect(CHECK_CONTACT_LEDE).toBe('설정 화면을 캡처해 보내 주시면 더 빨리 도와드릴 수 있어요.')
    expect(CARRIERS_GUIDE.intro?.map((n) => n.lines)).toEqual([[OPERATOR_NOTE]])
    expect(CARRIERS_GUIDE.chips).toEqual([])
    expect(CARRIERS_GUIDE.sections).toEqual([])
  })
  it('허브 «설치한 뒤에»(S-6) — 줄 2 · 버튼 3 · 목적지', () => {
    expect(GUIDE_AFTER.title).toBe('설치한 뒤에')
    expect(
      GUIDE_AFTER.rows.map((r) => [r.title, r.buttons.map((b) => `${b.label}→${b.page}`)]),
    ).toEqual([
      ['설치 확인하기', ['아이폰→/guide/check/ios', '안드로이드→/guide/check/android']],
      ['현지 통신사 바꾸기', ['통신사 바꾸는 방법 보기→/guide/network']],
    ])
  })
  it('끝 카드 — 문제 해결 질문 수는 가이드에서 센다', () => {
    expect(CHECK_IOS.end.cards.map((c) => `${c.label}|${c.sub}|${c.page}`)).toEqual([
      '현지 통신사 바꾸기|설정에서 통신사를 직접 골라요|/guide/network#ios',
      `설치 가이드 문제 해결|자주 받는 문의 ${IOS_GUIDE.help.faqs.length}가지|/guide/ios#help`,
    ])
    expect(CHECK_ANDROID.end.cards.map((c) => c.page)).toEqual([
      '/guide/network#android',
      '/guide/android#help',
    ])
  })
})

describe('금지 글자(F-10 · 불변식) — 새 콘텐츠 · 새 화면 대체 글 · 새 페이지 · 컴포넌트 소스(주석 제외)', () => {
  // 검사 대상 1 — 콘텐츠 문장 + 새로 굽는 화면 4장의 대체 글 + 새 페이지 설명(SEO)
  const NEW_FIGURES = [
    'ios-cellular-arrival',
    'ios-line-check',
    'ios-line-network',
    'aos-sim-arrival-data',
  ] as const
  const NEW_ROUTES = ['/guide/check/ios', '/guide/check/android', '/guide/network', '/guide/carriers'] as const
  const content = [
    plainAll(),
    // 설치 가이드에 더한 문제 해결 링크 이름(S-6)
    ...[IOS_GUIDE, ANDROID_GUIDE].flatMap((g) => g.help.faqs.flatMap((f) => (f.link ? [f.link.label] : []))),
    ...NEW_FIGURES.map((k) => GUIDE_FIGURES[k].alt),
    ...NEW_ROUTES.map((r) => STATIC_DESCRIPTIONS[r]),
  ].join('\n')
  // 검사 대상 2 — 새 페이지 · 컴포넌트 소스(주석은 뺀다 — «사업자정보» 안 «자정» 같은 오탐)
  const SOURCES = [
    'app/components/guide/GuideCheckArticle.vue',
    'app/components/guide/GuidePoints.vue',
    'app/components/guide/GuideAfter.vue',
    'app/components/guide/GuideCarriers.vue',
    'app/pages/guide/check/ios.vue',
    'app/pages/guide/check/android.vue',
    'app/pages/guide/network.vue',
    'app/pages/guide/carriers.vue',
    'app/pages/install-guide/check/ios.vue',
    'app/pages/install-guide/check/android.vue',
    'app/pages/install-guide/network.vue',
    'app/pages/install-guide/carriers.vue',
  ]
  const source = SOURCES.map((f) =>
    readFileSync(new URL(`../../../${f}`, import.meta.url), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, ''),
  ).join('\n')
  const ALL_TEXT = [content, source] as const

  // 지우지 말라는 문장만 허용(D-6) — 그 밖의 «지우 · 지워 · 지운 · 지울 · 삭제 · (다시 · 새로) 설치 · 다시 깔» 은 전부 삭제 권유로 본다
  const ALLOWED_DELETE = [
    '지우지 않아도 돼요',
    '지우지 말고',
    '한 번 지운 eSIM은 다시 설치할 수 없어요',
  ]
  const NAMES =
    /sparks?|maya|telco[- ]?vision|polkomtel|tsim|airalo|connect|star ?hub|start ?hub|\bplay\b|\bplus\b|cmhk|cm ?link|스파크|마야|티심|에어알로|텔코 ?비전|폴콤텔|커넥트|스타 ?허브|플레이|플러스|씨엠 ?링크|씨엠에이치케이/i
  const DELETE = /지우|지워|지운|지울|삭제|제거|초기화|재설치|다시 설치|새로 설치|다시 깔|delete|remove|erase/i
  const MIDNIGHT =
    /자정|0시|날짜가 바뀌|매일|하루씩|그때부터 사용일수|설치하면 사용일수가 시작|켜면 사용일수가 시작/

  it('검사 대상이 실제로 읽혔다(소스 12 · 화면 대체 글 4 · 설명 4)', () => {
    expect(source).toContain('GuideCheckArticle')
    expect(source.match(/<template>/g)?.length).toBe(SOURCES.length)
    for (const k of NEW_FIGURES) expect(GUIDE_FIGURES[k].alt.length, k).toBeGreaterThan(5)
    for (const r of NEW_ROUTES) expect(STATIC_DESCRIPTIONS[r], r).toBeTruthy()
  })
  it.each(['콘텐츠', '소스'] as const)('%s — 공급사 · 홈망 · 옛 네트워크 이름 0(영문 · 한글 음역 — D-6)', (k) => {
    expect(ALL_TEXT[k === '콘텐츠' ? 0 : 1]).not.toMatch(NAMES)
  })
  it.each(['콘텐츠', '소스'] as const)('%s — eSIM 을 지우라는 문장 0 (D-6 — 허용 세 마디 밖)', (k) => {
    let text = ALL_TEXT[k === '콘텐츠' ? 0 : 1]
    for (const a of ALLOWED_DELETE) text = text.split(a).join('')
    expect(text).not.toMatch(DELETE)
  })
  it('허용 세 마디는 실제로 쓰인다(지우지 말라는 안내가 사라지지 않게)', () => {
    for (const a of ALLOWED_DELETE) expect(content).toContain(a)
  })
  it.each(['콘텐츠', '소스'] as const)('%s — 자정 기준 · 재개통 · iPhone · 옛 사이트 · URL · 전화 · «(추천)» · «계약» 0', (k) => {
    const text = ALL_TEXT[k === '콘텐츠' ? 0 : 1]
    expect(text).not.toMatch(MIDNIGHT)
    expect(text).not.toMatch(/재개통|나라마다 다시|국가마다 다시/)
    expect(text).not.toContain('iPhone')
    expect(text).not.toMatch(/super\.site|https?:\/\/|\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/)
    expect(text).not.toMatch(/\(추천\)|계약/)
    if (k === '콘텐츠') expect(text).not.toMatch(/\b[a-z0-9-]+\.(com|net|io|global|kr|co|org)\b/i)
  })
  it('검사가 실제로 잡는다 — 바꿔 쓴 삭제 권유 · 한글 음역 이름(QA ⑥ 변이 문장)', () => {
    for (const bad of [
      '안 되면 이 eSIM을 지워 주세요.',
      '안 되면 eSIM을 삭제 후 QR로 다시 설치해 주세요.',
      '지운 뒤 QR 코드로 다시 깔아 주세요.',
      '{{eSIM 삭제}}를 눌러요.',
    ])
      expect(guidePlainText(bad)).toMatch(DELETE)
    expect('네트워크 이름이 커넥트 · 스타허브 · 플레이면 저희 eSIM이에요.').toMatch(NAMES)
    expect('Telco Vision 회선').toMatch(NAMES)
    for (const bad of ['안 되면 eSIM을 제거해 보세요', '설정을 초기화해 보세요']) expect(bad).toMatch(DELETE)
    expect('날짜가 바뀌면 사용일수가 하루 줄어요').toMatch(MIDNIGHT)
  })
})

/**
 * spec §⑤ 글자 그대로(S-1 · S-2 · S-3) — 구간마다 설명 · 확인 목록 · 단계 · 안내 상자 문단을 표기를 벗긴 글자로 고정한다
 * (QA ⑥ — 콘텐츠 ↔ 렌더 대조는 콘텐츠를 비추므로, 문장이 뒤집혀도(«메인» → «여행» · «두 칸» → «한 칸») 잡지 못했다)
 */
describe('spec §⑤ 문장 고정', () => {
  const p = (s: string) => guidePlainText(s)
  const view = (c: GuideCheckContent) => ({
    lede: c.lede.map((l) => (typeof l === 'string' ? p(l) : `${l.before}${l.link.label}${l.after} → ${l.link.page}`)),
    sections: c.sections.map((s) => ({
      lede: s.lede ? p(s.lede) : null,
      points: (s.points ?? []).map(p),
      steps: (s.steps ?? []).map((st) => (st.sub ? `${p(st.text)} | ${p(st.sub)}` : p(st.text))),
      notes: (s.notes ?? []).map((n) => [`(${n.tone})`, ...n.lines.map(p)]),
    })),
  })
  const OTHER = [
    '(warn)',
    '다른 여행용 eSIM이 더 보이나요? 이번에 설치한 것 말고 다른 여행용 eSIM은 꺼 두세요. 지우지 않아도 돼요.',
    '어느 회선인지 모르겠으면 지우지 말고 고객센터로 문의해 주세요. 한 번 지운 eSIM은 다시 설치할 수 없어요.',
  ]

  it('S-1 아이폰 설치 확인', () => {
    expect(view(CHECK_IOS)).toEqual({
      lede: [
        '현지에 도착해 여행용 eSIM을 켠 뒤, 아래 화면과 비교해 확인해 주세요.',
        '설치 방법은 아이폰 설치 가이드에서 볼 수 있어요. → /guide/ios',
      ],
      sections: [
        {
          lede: '설정 › 셀룰러를 열어 세 가지를 확인해요.',
          points: [
            '셀룰러 데이터가 여행용 회선이에요.',
            'SIMs의 메인과 여행용 회선이 모두 켬이에요.',
            '기본 음성 회선은 메인이에요.',
          ],
          steps: [],
          notes: [
            [
              '(info)',
              '여행용 회선 이름은 폰이 붙여요. ‘여행’ · ‘보조’처럼 폰마다 달라도 괜찮아요.',
              '한국에서는 여행용 회선이 ‘활성화 중…’으로 보이고 셀룰러 데이터는 메인이에요. 정상이에요.',
            ],
            OTHER,
          ],
        },
        {
          lede: '셀룰러 화면에서 여행용 회선을 눌러 세부 화면을 열어요.',
          points: [
            '이 회선 켜기가 켜져 있어요.',
            '음성 및 데이터는 5G 자동이에요. 5G를 지원하지 않는 아이폰(11 이하 · SE 2세대)은 LTE로 보여요.',
            '데이터 로밍이 켜져 있어요. 가장 중요해요.',
          ],
          steps: [],
          notes: [],
        },
        {
          lede: '설정 › 셀룰러 › 셀룰러 데이터를 열어요.',
          points: ['여행용 회선에 체크 표시가 있어요.', '셀룰러 데이터 전환 허용은 꺼져 있어요.'],
          steps: [],
          notes: [
            [
              '(warn)',
              '한국 회선의 데이터 로밍은 꺼 두세요. 켜져 있으면 통신사 로밍 요금이 나올 수 있어요.',
              '셀룰러 데이터 전환 허용도 꺼 두세요. 켜 두면 데이터가 한국 회선으로 넘어갈 수 있어요.',
            ],
          ],
        },
        {
          lede: '화면 맨 위 상태 표시줄을 봐요.',
          points: ['신호 표시가 위아래 두 칸으로 나뉘어 있어요.', 'Wi-Fi를 끄면 신호 옆에 5G나 LTE가 떠요.'],
          steps: [],
          notes: [
            [
              '(info)',
              '신호가 한 칸뿐인가요? 여행용 회선이 꺼져 있거나 설치되지 않은 거예요. 확인 1부터 다시 봐 주세요.',
            ],
          ],
        },
      ],
    })
    expect([CHECK_IOS.eyebrow, CHECK_IOS.title, CHECK_IOS.hint]).toEqual([
      'Install check · iOS',
      '아이폰 eSIM 설치 확인',
      '화면의 빨간 테두리가 확인할 곳이에요.',
    ])
    expect([CHECK_IOS.end.title, CHECK_IOS.end.lede, CHECK_IOS.end.alt]).toEqual([
      '그래도 연결이 안 되나요?',
      '연결이 불안정하면 현지 통신사를 바꿔 보세요.',
      false,
    ])
  })

  it('S-2 안드로이드 설치 확인', () => {
    expect(view(CHECK_ANDROID)).toEqual({
      lede: [
        '현지에 도착해 모바일 데이터를 eSIM 1로 바꾼 뒤, 아래 화면과 비교해 확인해 주세요.',
        '갤럭시 화면으로 안내해요. 설치 방법은 안드로이드 설치 가이드에서 볼 수 있어요. → /guide/android',
      ],
      sections: [
        {
          lede: '설정 › 연결 › SIM 관리자를 열어요.',
          points: [
            '여행용 eSIM(eSIM 1)이 켜져 있어요.',
            '주 사용 SIM 카드의 모바일 데이터가 eSIM 1이에요.',
            '같은 화면 아래 데이터 전환은 꺼져 있어요.',
          ],
          steps: [],
          notes: [
            ['(info)', 'eSIM 이름은 폰마다 달라요. 여행용 eSIM 이름과 모바일 데이터에 고른 이름이 같으면 돼요.'],
            OTHER,
          ],
        },
        {
          lede: '설정 › 연결 › 해외 로밍을 열어요.',
          points: ['데이터 로밍 eSIM 1이 켜져 있어요.', '데이터 로밍 SIM 1은 꺼져 있어요.'],
          steps: [],
          notes: [
            ['(info)', 'SKT 폰은 메뉴가 달라요. 설정 › T로밍 › 로밍 상세 설정에서 데이터 로밍을 확인해 주세요.'],
            [
              '(warn)',
              '데이터 로밍 SIM 1은 꺼 두세요. 켜져 있으면 통신사 로밍 요금이 나올 수 있어요.',
              '데이터 전환도 꺼 두세요. 켜 두면 데이터가 국내 SIM으로 넘어갈 수 있어요.',
            ],
          ],
        },
      ],
    })
    expect([CHECK_ANDROID.eyebrow, CHECK_ANDROID.title, CHECK_ANDROID.hint, CHECK_ANDROID.end.alt]).toEqual([
      'Install check · Android',
      '안드로이드 eSIM 설치 확인',
      '화면의 빨간 테두리가 확인할 곳이에요.',
      false,
    ])
  })

  it('S-3 현지 통신사 바꾸기', () => {
    const wait = '잠시 기다리면 고를 수 있는 통신사 목록이 나와요.'
    const done =
      '목록에서 다른 통신사를 골라요. | 연결까지 길게는 10분 정도 걸릴 수 있어요. 바로 연결되지 않아도 잠시 기다려 주세요.'
    expect(view(NETWORK_GUIDE)).toEqual({
      lede: ['나라와 지역에 따라 잘 잡히는 통신사가 달라요.', '연결이 불안정하면 다른 통신사로 바꿔 보세요.'],
      sections: [
        {
          lede: null,
          points: [],
          steps: [
            '설정 › 셀룰러에서 여행용 회선을 누르고 네트워크 선택을 눌러요.',
            `자동을 꺼요. | ${wait}`,
            done,
          ],
          notes: [
            [
              '(info)',
              '고른 통신사로도 안 되면 다시 자동으로 돌려 주세요.',
              '다른 나라로 옮기기 전에는 자동을 다시 켜 두세요. 자동이면 폰이 그 나라 통신사로 알아서 바꿔요.',
            ],
          ],
        },
        {
          lede: '갤럭시 화면으로 안내해요. 다른 안드로이드 폰은 메뉴 이름이 조금 다를 수 있어요.',
          points: [],
          steps: [
            '설정 › 연결 › 모바일 네트워크 › 로밍 이동통신사 선택을 눌러요. | SKT 폰은 설정 › T로밍 › 로밍 이동통신사 선택에 있어요.',
            `위 탭에서 eSIM 1을 누르고 자동 선택을 꺼요. | ${wait}`,
            done,
          ],
          notes: [
            [
              '(info)',
              '고른 통신사로도 안 되면 다시 자동 선택으로 돌려 주세요.',
              '다른 나라로 옮기기 전에는 자동 선택을 다시 켜 두세요. 자동이면 폰이 그 나라 통신사로 알아서 바꿔요.',
            ],
          ],
        },
      ],
    })
    expect([
      NETWORK_GUIDE.eyebrow,
      NETWORK_GUIDE.title,
      NETWORK_GUIDE.hint,
      NETWORK_GUIDE.sections.map((s) => `${s.badge}|${s.title}`),
      NETWORK_GUIDE.end.alt,
      NETWORK_GUIDE.end.after?.map((r) => `${r.title}|${r.sub}`),
      NETWORK_GUIDE.end.cards.map((c) => `${c.label}|${c.sub}|${c.page}`),
    ]).toEqual([
      'Change network',
      '현지 통신사 바꾸기',
      '화면의 빨간 테두리는 설명이 가리키는 곳이에요.',
      ['아이폰|아이폰에서 바꾸기', '안드로이드|안드로이드에서 바꾸기'],
      true,
      ['설치 확인하기|설정을 화면과 비교해요.'],
      ['나라별 현지 통신사|나라마다 연결할 수 있는 통신사|/guide/carriers'],
    ])
  })

  it('페이지 OS(머리 OS 전환의 «지금») · 새 화면 대체 글(spec F-6 표)', () => {
    expect([CHECK_IOS.os, CHECK_ANDROID.os, NETWORK_GUIDE.os, CARRIERS_GUIDE.os]).toEqual([
      'ios',
      'android',
      undefined,
      undefined,
    ])
    expect(
      (['ios-cellular-arrival', 'ios-line-check', 'ios-line-network', 'aos-sim-arrival-data'] as const).map(
        (k) => GUIDE_FIGURES[k].alt,
      ),
    ).toEqual([
      '설정 › 셀룰러 화면 — 셀룰러 데이터 여행 · 기본 음성 회선 메인 · 두 회선 켬 표시',
      '여행용 회선 세부 화면 — 이 회선 켜기 · 음성 및 데이터 5G 자동 · 데이터 로밍 표시',
      '여행용 회선 세부 화면 — 네트워크 선택 표시',
      'SIM 관리자 화면 아래 — 모바일 데이터 eSIM 1 · 데이터 전환 스위치 표시',
    ])
    expect(CARRIERS_GUIDE.intro?.map((n) => n.tone)).toEqual(['info'])
    expect(NETWORK_GUIDE.intro?.map((n) => n.tone)).toEqual(['tip'])
  })

  it('S-4 나라별 현지 통신사 머리 · S-1/S-2 구간 배지 · 제목', () => {
    expect([CARRIERS_GUIDE.eyebrow, CARRIERS_GUIDE.title, ...CARRIERS_GUIDE.lede]).toEqual([
      'Carriers',
      '나라별 현지 통신사',
      '여행용 eSIM이 나라마다 연결할 수 있는 통신사예요.',
      '연결이 불안정하면 이 중 다른 통신사로 바꿔 보세요.',
    ])
    expect(CARRIERS_GUIDE.intro?.[0]?.link?.link).toEqual({
      label: '통신사 바꾸는 방법 보기',
      page: '/guide/network',
      bare: '/install-guide/network',
    })
    expect(CHECK_IOS.sections.map((s) => `${s.badge}|${s.title}`)).toEqual([
      '확인 1|셀룰러 화면',
      '확인 2|여행용 회선 설정',
      '확인 3|셀룰러 데이터',
      '확인 4|신호 표시',
    ])
    expect(CHECK_ANDROID.sections.map((s) => `${s.badge}|${s.title}`)).toEqual([
      '확인 1|SIM 관리자',
      '확인 2|데이터 로밍',
    ])
  })
})
