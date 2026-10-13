/**
 * 설치 가이드 콘텐츠 타입(client-guide spec F-2). 문장 안 표기는 `inline.ts` 의 인라인 표기 —
 * `{{누를 이름}}` · `[[설정 › 셀룰러]]` · `**굵게**` · `((줄바꿈 금지))`. HTML 은 쓰지 않는다.
 */
import type { FigureKey } from './figures'

export type GuideOs = 'ios' | 'android'
export type CheckIcon = 'wifi' | 'update' | 'device' | 'clean'
/** info ☝️ · warn 🚨 · tip 💡 · home 🏠 (2609 판 이모지 → 사이트 아이콘 — spec D-7) */
export type NoteTone = 'info' | 'warn' | 'tip' | 'home'

/** 사이트 안 링크 — 사이트판(`page`) · 전용판(`bare` — 메뉴 없는 판)이 다른 주소로 연다(client-guide-check S-5) */
export interface GuideLink {
  label: string
  page: string
  bare: string
}

export interface GuideNote {
  tone: NoteTone
  /** 문단 — 첫 문단은 보통 `**제목.**` 으로 시작한다 */
  lines: readonly string[]
  /** 문단 아래 링크 한 줄(client-guide-check S-3 · S-4) */
  link?: GuideLinkLine
}

/** 글자 사이 링크 하나 — «before<a>link</a>after» */
export interface GuideLinkLine {
  before: string
  link: GuideLink
  after: string
}

export interface GuideStep {
  text: string
  /** 작은 회색 보조 문장 */
  sub?: string
  /** 화면 이미지 */
  figure?: FigureKey
  /** 이미지 대신 상태 표시줄 그림(신호 · 5G) */
  status?: GuideOs
}

export interface GuideMethod {
  tag: string
  badge: string
  title: string
  desc: string
  steps: readonly GuideStep[]
  note?: GuideNote
}

export interface GuideFaq {
  q: string
  a: readonly string[]
  figure?: FigureKey
  /**
   * 답 아래 링크. bareTo — 전용판에서 여는 메뉴 없는 판이자, 발급 · 본인 확인 화면 하단 시트에서 새 탭으로 여는 주소
   * (client-guide-check D-13). bareTo 가 없으면 시트에서는 그리지 않는다(«내 eSIM 조회하기» — client-guide D-13)
   */
  link?: { to: string; label: string; bareTo?: string }
}

export interface GuideSectionHead {
  badge: string
  title: string
  lede: string
}

export interface GuideCheck {
  icon: CheckIcon
  title: string
  body: string
  /**
   * 본문 아래 사이트 페이지 링크(client-guide D-22 — «지원 기기» → /supported-devices).
   * bareTo — 메뉴 없는 화면(전용판 · 시트)에서 여는 메뉴 없는 판(D-24)
   */
  link?: { to: string; label: string; bareTo?: string }
}

export interface GuideContent {
  os: GuideOs
  eyebrow: string
  title: string
  lede: readonly string[]
  checks: {
    lede: string
    items: readonly GuideCheck[]
    alert: { title: string; body: string }
  }
  step1: GuideSectionHead & { methods: readonly GuideMethod[]; notes: readonly GuideNote[] }
  step2: GuideSectionHead & { steps: readonly GuideStep[]; notes: readonly GuideNote[] }
  step3: GuideSectionHead & { steps: readonly GuideStep[]; notes: readonly GuideNote[] }
  help: GuideSectionHead & { faqs: readonly GuideFaq[] }
}

/**
 * 설치 확인 · 현지 통신사 바꾸기 페이지(client-guide-check spec S-1 · S-2 · S-3) — 설치 가이드와 같은 틀(머리 · 칩 · 구간)에
 * 구간 구성만 다르다. 문장 안 표기는 설치 가이드와 같은 `inline.ts`.
 */
export interface GuideCheckSection {
  /** 구간 id = 칩 목적지(#id) */
  id: string
  badge: string
  title: string
  /** 회색 바탕 구간 */
  alt: boolean
  /** 제목 아래 설명(경로 표기 등) */
  lede?: string
  /** 확인 목록 — 화면과 비교할 상태 한 줄씩 */
  points?: readonly string[]
  /** 확인 목록 아래 화면 창 */
  figures?: readonly FigureKey[]
  /** 확인 목록 아래 상태 표시줄 그림 */
  status?: GuideOs
  /** 단계(통신사 바꾸기) */
  steps?: readonly GuideStep[]
  notes?: readonly GuideNote[]
}

/** 머리 설명 한 줄 — 글자만(인라인 표기), 또는 글자 사이 링크 하나 */
export type GuideLede = string | GuideLinkLine

/** 끝 구간 카드 — 이름 · 설명 · 목적지(사이트판 · 전용판) · 아이콘 */
export interface GuideEndCard extends GuideLink {
  sub: string
  icon: 'network' | 'help' | 'carriers'
}

/** «설치한 뒤에» 줄 — 제목 · 설명 · 버튼 1~2(client-guide-check S-6 · S-3 끝) */
export interface GuideAfterRow {
  title: string
  sub: string
  buttons: readonly GuideLink[]
}

export interface GuideCheckContent {
  key: 'check-ios' | 'check-android' | 'network' | 'carriers'
  eyebrow: string
  title: string
  lede: readonly GuideLede[]
  /** 있으면 머리 OS 전환(설치 확인 두 페이지) — 지금 페이지 OS */
  os?: GuideOs
  /** 바로가기 칩 — id 는 구간 id, step 은 «확인 1» 처럼 붙여 둘 앞 토막(없으면 칩 줄 없음 — 나라별 통신사) */
  chips: readonly { id: string; step?: string; label: string }[]
  /** 빨간 테두리 안내 줄(화면 그림이 없는 페이지는 빈 글자 — 줄 없음) */
  hint: string
  /** 칩 줄 · 안내 줄 아래 흰 구간의 안내 상자(통신사 바꾸기 머리 tip) */
  intro?: readonly GuideNote[]
  sections: readonly GuideCheckSection[]
  end: {
    alt: boolean
    title?: string
    lede?: string
    after?: readonly GuideAfterRow[]
    cards: readonly GuideEndCard[]
  }
}

