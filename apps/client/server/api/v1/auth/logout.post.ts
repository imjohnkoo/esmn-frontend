// POST /api/v1/auth/logout — 지금 세션만 revoke · 쿠키 삭제 · 204(세션 없어도 204 — F-8)
import { defineMemberHandler } from '../../../utils/auth-route'
import { useDB } from '../../../db'
import { assertSameOrigin } from '../../../utils/auth-guard'
import { requireAuthEnabled } from '../../../utils/auth-flags'
import { clearSessionCookie, revokeSession } from '../../../utils/auth-session'
import { logEvent } from '../../../utils/issuance-log'

export default defineMemberHandler(async (event) => {
  requireAuthEnabled(event)
  assertSameOrigin(event)
  const user = event.context.auth?.user
  if (user) {
    await revokeSession(useDB(), user.sessionId)
    logEvent('AUTH_LOGOUT', 'info', 'member logged out', { serviceUserId: user.serviceUserId })
  }
  clearSessionCookie(event)
  setResponseStatus(event, 204)
  return null
})
