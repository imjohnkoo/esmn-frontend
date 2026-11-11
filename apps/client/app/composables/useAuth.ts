import type { AuthSessionView } from '~/utils/member-guard'
import type { MemberFlash } from '~/content/member'

// 회원 화면 공용(member-client-auth F-11 · F-17) — 세션 판정은 GET /api/v1/auth/session 하나.
// SSR 에서는 useRequestFetch 가 들어온 쿠키를 넘긴다. 결과는 요청마다 useState 에 둔다(프리렌더 · 공개 runtimeConfig 0 — D-1).

const EMPTY: AuthSessionView = { methods: [], user: null }

export function useAuthSession() {
  return useState<AuthSessionView | null>('auth-session', () => null)
}

/** 세션 상태 불러오기 — force 면 다시(로그인 · 로그아웃 뒤). 실패하면 꺼짐 쪽(진입점 숨김)으로 */
export async function loadAuthSession(force = false): Promise<AuthSessionView> {
  return (await fetchAuthSession(force)) ?? EMPTY
}

/** 같은 일 — 조회가 실패하면 null(가드는 404 로 덮지 않고 화면을 연다 — spec D-29) */
export async function fetchAuthSession(force = false): Promise<AuthSessionView | null> {
  const state = useAuthSession()
  if (state.value && !force) return state.value
  try {
    state.value = await useRequestFetch()<AuthSessionView>('/api/v1/auth/session')
    return state.value
  } catch {
    state.value = EMPTY
    return null
  }
}

/** 도착 화면에 한 번 보이는 안내(토스트 대신) — 보여 준 화면이 지운다 */
export function useMemberFlash() {
  return useState<MemberFlash | null>('member-flash', () => null)
}

// 라우트 타입 추론을 끈 $fetch — 경로를 문자열로 조립하면 Nitro 라우트 타입 비교가 너무 깊어진다(TS2321)
const post = $fetch as unknown as (
  url: string,
  opts: { method: 'POST'; body: Record<string, unknown> },
) => Promise<unknown>

/** auth API 호출 — 실패면 서버가 단 data.code(없으면 상태 코드 문자열)를 던진다 */
export async function authPost(path: string, body: Record<string, unknown> = {}): Promise<void> {
  try {
    await post(`/api/v1/auth/${path}`, { method: 'POST', body })
  } catch (e) {
    const err = e as { data?: { data?: { code?: string } }; statusCode?: number }
    throw new AuthApiError(
      err.data?.data?.code ?? `HTTP_${err.statusCode ?? 0}`,
      err.statusCode ?? 0,
    )
  }
}

export class AuthApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code)
  }
}
