/**
 * 설치 가이드 콘텐츠 타입(client-guide spec F-2). 문장 안 표기는 `inline.ts` 의 인라인 표기 —
 * `{{누를 이름}}` · `[[설정 › 셀룰러]]` · `**굵게**` · `((줄바꿈 금지))`. HTML 은 쓰지 않는다.
 */
import type { FigureKey } from './figures'

export type GuideOs = 'ios' | 'android'
export type CheckIcon = 'wifi' | 'update' | 'device' | 'clean'
/** info ☝️ · warn 🚨 · tip 💡 · home 🏠 (2609 판 이모지 → 사이트 아이콘 — spec D-7) */
export type NoteTone = 'info' | 'warn' | 'tip' | 'home'

export interface GuideNote {
  tone: NoteTone
  /** 문단 — 첫 문단은 보통 `**제목.**` 으로 시작한다 */
  lines: readonly string[]
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
  link?: { to: string; label: string }
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
