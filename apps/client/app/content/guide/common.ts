/**
 * 설치 가이드 공통 문안(client-guide spec S-1 · S-2 · S-3) — 허브 · OS 페이지가 같이 쓴다.
 * 3단계 흐름 · 문의 문장은 2609 판(`design/install-guide/{ios,android}.html` @ eb96d75) 글자 그대로.
 */
import type { GuideOs } from './types'

export const GUIDE_FLOW = [
  { step: 'STEP 1', title: '집에서 설치', meta: '출국 전 · 5분' },
  { step: 'STEP 2', title: '회선 설정', meta: '설치 직후 · 1분' },
  { step: 'STEP 3', title: '현지에서 켜기', meta: '도착 후 · 1분' },
] as const

/**
 * OS 페이지 구간 바로가기(F-4 · D-21) — id 는 본문 구간 앵커와 같다. 칩 4개는 늘 한 줄.
 * «설치 전 확인» 은 칩이 없다(그 구간은 머리 바로 아래 — 구간 `check` 는 그대로, John 2026-10-06)
 */
export const GUIDE_SECTIONS = [
  { id: 'step1', label: 'STEP 1 설치' },
  { id: 'step2', label: 'STEP 2 설정' },
  { id: 'step3', label: 'STEP 3 현지' },
  { id: 'help', label: '문제 해결' },
] as const

export const GUIDE_HL_HINT =
  '화면의 빨간 테두리는 설명이 가리키는 곳이에요. 켜고 끄는 건 설명을 따라 주세요.'

export const GUIDE_PAGES: Record<
  GuideOs,
  { to: string; label: string; short: string; sub: string }
> = {
  ios: {
    to: '/guide/ios',
    label: '아이폰 설치 가이드',
    short: '아이폰',
    sub: 'QR 스캔 · QR 길게 누르기 · 코드 입력',
  },
  android: {
    to: '/guide/android',
    label: '안드로이드 설치 가이드',
    short: '안드로이드',
    sub: '갤럭시 기준 · QR 스캔 · QR 이미지 · 코드 입력',
  },
}

/** 가이드 전용 페이지(client-guide D-14 · S-5) — 헤더 · 하단 탭 없이 본문만. canonical 은 사이트판(`GUIDE_PAGES[os].to`) 하나 — noindex 없음(D-18) */
export const GUIDE_BARE: Record<GuideOs, string> = {
  ios: '/install-guide/ios',
  android: '/install-guide/android',
}

export const GUIDE_HUB = {
  title: '설치 가이드',
  desc: '아이폰과 안드로이드 설치 방법을 출국 전 설치부터 현지에서 켜기까지 순서대로 안내해요.',
  flowNote: '설치만으로는 사용일수가 시작되지 않아요.',
} as const

export const GUIDE_CONTACT = {
  title: '그래도 해결되지 않으면 문의해 주세요',
  /** 허브(/guide)용 — 허브에는 문제 해결 내용이 없어 «그래도» 를 뺀다 */
  hubTitle: '설치가 잘 안 되면 문의해 주세요',
  lede: '설치 화면을 캡처해 보내 주시면 더 빨리 도와드릴 수 있어요.',
  more: '고객센터 전체 보기',
} as const
