// 회원 화면 가드(member-client-auth F-17) — 판정은 utils/member-guard.ts. 플래그 off = 404 · 로그인 필요 → /login?next= · 로그인 상태로 로그인 화면 → next
import { decideMemberRoute } from '~/utils/member-guard'

export default defineNuxtRouteMiddleware(async (to) => {
  // 조회 실패(네트워크 · 5xx)는 판정하지 않고 화면을 연다 — 서버 API 가 다시 막는다(꺼짐 404 · 비로그인 401 · spec D-29)
  const session = await fetchAuthSession(true)
  if (!session) return
  const decision = decideMemberRoute(to.path, to.fullPath, to.query.next, session)
  if (decision.action === 'not-found') {
    return abortNavigation(
      createError({ statusCode: 404, statusMessage: 'Page Not Found', fatal: true }),
    )
  }
  if (decision.action === 'redirect') return navigateTo(decision.to)
})
