import { describe, expect, it } from 'vitest'
import { OPERATOR_NOTE } from '../product-detail'
import { ANDROID_GUIDE } from './android'
import {
  CARRIERS_GUIDE,
  CHECK_ANDROID,
  CHECK_CONTACT_LEDE,
  CHECK_IOS,
  GUIDE_AFTER,
  NETWORK_GUIDE,
} from './check'
import { GUIDE_CARRIERS, GUIDE_CHECK, GUIDE_NETWORK } from './common'
import type { FigureKey } from './figures'
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

describe('금지 글자(F-10 · 불변식)', () => {
  const plain = plainAll()
  it('공급사 · 홈망 · 옛 네트워크 이름 0 (D-6)', () => {
    expect(plain).not.toMatch(
      /sparks?|maya|telco-?vision|polkomtel|tsim|airalo|스파크|마야|티심|connect|starhub|start ?hub|\bplay\b|\bplus\b|cmhk|cmlink/i,
    )
  })
  it('eSIM 을 지우라는 문장 0 (D-6)', () => {
    expect(plain).not.toMatch(/지우(고|세요|면 돼|셔도)|삭제(하|해|후)|재설치/)
  })
  it('자정 기준 · 재개통 · iPhone · 옛 사이트 · URL · 전화 0', () => {
    expect(plain).not.toMatch(/자정|0시|매일|하루씩|재개통|나라마다 다시|국가마다 다시/)
    expect(plain).not.toContain('iPhone')
    expect(plain).not.toMatch(/super\.site|https?:\/\/|\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/)
    expect(plain).not.toMatch(/\(추천\)|계약/)
  })
})
