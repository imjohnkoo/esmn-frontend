// 회원 화면 가드(member-client-auth F-17) — 판정은 utils/member-guard.ts. 플래그 off = 404 · 로그인 필요 → /login?next= · 로그인 상태로 로그인 화면 → next
import { decideMemberRoute } from '~/utils/member-guard'

export default defineNuxtRouteMiddleware(async (to) => {
  const decision = decideMemberRoute(
    to.path,
    to.fullPath,
    to.query.next,
    await loadAuthSession(true),
  )
  if (decision.action === 'not-found') {
    return abortNavigation(
      createError({ statusCode: 404, statusMessage: 'Page Not Found', fatal: true }),
    )
  }
  if (decision.action === 'redirect') return navigateTo(decision.to)
})
