/**
 * shell 내비게이션 — 하단 탭 · 전체 메뉴 · 약관 링크의 단일 정의 (헤더 · 탭바 · 푸터 · 마이가 같은 목록을 쓴다).
 */

export type TabKey = 'home' | 'my-esim' | 'guide' | 'my'

export interface ShellTab {
  key: TabKey
  label: string
  to: string
}

export interface ShellLink {
  label: string
  to: string
}

export interface ShellMenuGroup {
  title: string
  links: readonly ShellLink[]
}

export const SHELL_TABS: readonly ShellTab[] = [
  { key: 'home', label: '홈', to: '/' },
  { key: 'my-esim', label: '내 eSIM', to: '/my-esim' },
  { key: 'guide', label: '가이드', to: '/guide' },
  { key: 'my', label: '마이', to: '/my' },
]

export const LEGAL_LINKS: readonly ShellLink[] = [
  { label: '이용약관', to: '/terms' },
  { label: '개인정보처리방침', to: '/privacy' },
  { label: '취소·환불 정책', to: '/refund' },
]

export const SHELL_MENU: readonly ShellMenuGroup[] = [
  {
    title: 'eSIM',
    links: [
      { label: '국가 검색', to: '/search' },
      { label: '내 eSIM 조회', to: '/my-esim' },
      { label: '설치 가이드', to: '/guide' },
      { label: '지원 기기 확인', to: '/supported-devices' },
    ],
  },
  { title: '고객지원', links: [{ label: '고객센터', to: '/my#cs' }] },
  { title: '약관 및 정책', links: LEGAL_LINKS },
]

function normalizePath(path: string): string {
  const bare = path.split(/[?#]/)[0] || '/'
  return bare.length > 1 && bare.endsWith('/') ? bare.replace(/\/+$/, '') : bare
}

const isUnder = (path: string, base: string) => path === base || path.startsWith(`${base}/`)

/** 경로 → 활성 탭. 탭 네 곳 밖(4-step · 체크아웃 등)은 null */
export function activeTabOf(path: string): TabKey | null {
  const p = normalizePath(path)
  if (p === '/' || p === '/search') return 'home'
  if (p === '/my-esim') return 'my-esim'
  if (isUnder(p, '/guide') || p === '/supported-devices') return 'guide'
  if (isUnder(p, '/my') || LEGAL_LINKS.some((link) => link.to === p)) return 'my'
  return null
}

/**
 * 탭의 aria-current (spec F-6) — 경로가 탭 주소와 같으면 'page', 그 탭 구역의 다른 경로(`/terms` 의 «마이» 등)면 'true'.
 * 구역 강조를 'page' 로 두면 스크린리더가 이용약관 화면에서 «마이, 현재 페이지» 로 읽는다.
 */
export function tabAriaCurrent(path: string, tab: ShellTab): 'page' | 'true' | undefined {
  if (activeTabOf(path) !== tab.key) return undefined
  return normalizePath(path) === tab.to ? 'page' : 'true'
}
