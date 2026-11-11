import { safeNext } from '#shared/utils/safe-next'

// 회원 화면 진입 판정(member-client-auth F-17) — 순수 함수. 미들웨어 member.ts 가 결과대로 움직인다.
// 판정 재료는 GET /api/v1/auth/session 하나(D-1 — 프리렌더 · 공개 runtimeConfig 0)

export interface AuthSessionView {
  methods: string[]
  user: { emailMasked: string | null; providers: string[] } | null
}

/** 로그인해야 들어오는 화면 */
const MEMBER_ONLY = ['/my/withdraw']
/** 비로그인만 쓰는 화면 — 로그인 상태로 오면 next 로 */
const GUEST_ONLY = ['/login', '/signup', '/password/reset', '/password/reset/new']

export type MemberRouteDecision =
  | { action: 'continue' }
  | { action: 'not-found' }
  | { action: 'redirect'; to: string }

export function decideMemberRoute(
  path: string,
  fullPath: string,
  nextQuery: unknown,
  session: AuthSessionView,
): MemberRouteDecision {
  if (session.methods.length === 0) return { action: 'not-found' }
  if (MEMBER_ONLY.includes(path) && !session.user) {
    return { action: 'redirect', to: `/login?next=${encodeURIComponent(fullPath)}` }
  }
  if (GUEST_ONLY.includes(path) && session.user)
    return { action: 'redirect', to: safeNext(nextQuery) }
  return { action: 'continue' }
}
