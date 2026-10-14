/**
 * 설치 가이드 공통 문안(client-guide spec S-1 · S-2 · S-3) — 허브 · OS 페이지가 같이 쓴다.
 * 3단계 흐름 · 문의 문장은 2609 판(`design/install-guide/{ios,android}.html` @ eb96d75) 글자 그대로.
 */
import type { GuideAfterRow, GuideOs } from './types'

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

/** 지원 기기 사이트판(메뉴 있음) — 사이트판 가이드의 «지원 기기 확인하기» 목적지 · 전용판의 canonical */
export const DEVICES_PAGE = '/supported-devices'

/** 지원 기기 전용판(client-guide D-24) — 헤더 · 하단 탭 없이 `DEVICES_PAGE` 본문만. 가이드 전용판 · 시트의 «지원 기기 확인하기» 가 연다 · canonical 은 사이트판 */
export const DEVICES_BARE = '/install-guide/devices'

/**
 * 설치 확인 · 현지 통신사 바꾸기 · 나라별 현지 통신사 주소(client-guide-check D-2 · S-5) — 사이트판(page) · 전용판(bare).
 * 전용판은 canonical 이 사이트판 하나 · sitemap 제외(client-guide D-18 규칙)
 */
export const GUIDE_CHECK: Record<GuideOs, { page: string; bare: string }> = {
  ios: { page: '/guide/check/ios', bare: '/install-guide/check/ios' },
  android: { page: '/guide/check/android', bare: '/install-guide/check/android' },
}
export const GUIDE_NETWORK = { page: '/guide/network', bare: '/install-guide/network' } as const
export const GUIDE_CARRIERS = { page: '/guide/carriers', bare: '/install-guide/carriers' } as const

/** «설치 확인하기» OS 두 칸(client-guide-check S-6 · S-3 끝) */
export const AFTER_CHECK_OS = [
  { label: GUIDE_PAGES.ios.short, page: GUIDE_CHECK.ios.page, bare: GUIDE_CHECK.ios.bare },
  {
    label: GUIDE_PAGES.android.short,
    page: GUIDE_CHECK.android.page,
    bare: GUIDE_CHECK.android.bare,
  },
] as const

/**
 * 허브 «설치한 뒤에»(client-guide-check S-6) — 허브가 가이드 본문 문안(ios · android · check)을 싣지 않게 여기에 둔다
 * (QA ⑥ — check.ts 에서 가져오면 허브 번들에 약 34KB 가 딸려 온다)
 */
export const GUIDE_AFTER: { title: string; rows: readonly GuideAfterRow[] } = {
  title: '설치한 뒤에',
  rows: [
    {
      title: '설치 확인하기',
      sub: '현지에서 연결이 안 될 때 설정 화면과 비교해요.',
      buttons: AFTER_CHECK_OS,
    },
    {
      title: '현지 통신사 바꾸기',
      sub: '연결이 불안정할 때 통신사를 직접 골라요. 아이폰 · 안드로이드 한 페이지예요.',
      buttons: [{ label: '통신사 바꾸는 방법 보기', page: GUIDE_NETWORK.page, bare: GUIDE_NETWORK.bare }],
    },
  ],
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
