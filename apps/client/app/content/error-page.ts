/**
 * 오류 화면 문안(catalog spec S-7 · F-13 · D-22 — 목업 E-1 ~ E-4). 갈래 판정은 `app/utils/error-view.ts`.
 * 금지어는 `error-view.test.ts` 가 여기서 내보내는 문안 전부(준비 중 7개국 제목 포함)에 건다.
 */
export type ErrorKind = 'page' | 'upcoming' | 'product' | 'error'

export interface ErrorAction {
  label: string
  /** 링크 목적지 — 없으면 «다시 시도»(같은 주소를 다시 불러온다) */
  to?: string
}

export interface ErrorCopy {
  title: string
  /** 설명 두 줄 */
  lines: readonly [string, string]
  primary: ErrorAction
  secondary: ErrorAction
}

export const ERROR_COPY: Readonly<Record<Exclude<ErrorKind, 'upcoming'>, ErrorCopy>> = {
  page: {
    title: '찾는 페이지가 없어요',
    lines: ['주소가 바뀌었거나 없어진 페이지예요.', '가려던 나라를 다시 찾아보세요.'],
    primary: { label: '나라 찾기', to: '/search' },
    secondary: { label: '홈으로', to: '/' },
  },
  product: {
    title: '찾는 상품이 없어요',
    lines: ['상품 구성이 바뀌었을 수 있어요.', '가려는 나라로 다시 찾아보세요.'],
    primary: { label: '나라 찾기', to: '/search' },
    secondary: { label: '홈으로', to: '/' },
  },
  error: {
    title: '잠시 문제가 생겼어요',
    lines: ['잠시 뒤에 다시 시도해 주세요.', '계속되면 고객센터로 알려 주세요.'],
    primary: { label: '다시 시도' },
    secondary: { label: '홈으로', to: '/' },
  },
}

/** 준비 중 나라 — 출시 알림은 약속하지 않는다(알림 수단 없음 · D-22) */
export function upcomingCopy(nameKr: string): ErrorCopy {
  return {
    title: `${nameKr} eSIM은 아직 준비 중이에요`,
    lines: ['지금은 판매하지 않는 나라예요.', '궁금한 점은 고객센터로 물어봐 주세요.'],
    primary: { label: '다른 나라 찾기', to: '/search' },
    secondary: { label: '고객센터', to: '/my#cs' },
  }
}

export const UPCOMING_BADGE = '준비 중'
export const POPULAR_CHIPS_LABEL = '인기 국가'
export const ASIA_CHIPS_LABEL = '지금 살 수 있는 아시아 나라'

/** 준비 중 나라 화면의 대안 — 카탈로그에 있는 아시아 나라(ISO3 · 이 순서). 카탈로그에서 빠지면 테스트가 실패한다 */
export const ERROR_ASIA_COUNTRIES = ['VNM', 'THA', 'SGP', 'IDN', 'HKG'] as const
