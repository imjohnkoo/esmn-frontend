// POST /api/internal/members/{id}/withdraw — 대리 탈퇴(F-14 · N-11): 본인 탈퇴와 같은 효과 · 멱등 · 응답 PII 0 · 플래그 무관
import { useDB } from '../../../../db'
import { assertInternalAuth } from '../../../../utils/auth-guard'
import { authFail, defineMemberHandler, memberIdParam } from '../../../../utils/auth-route'
import { logEvent } from '../../../../utils/issuance-log'
import { withdrawMember } from '../../../../utils/member-auth'

export default defineMemberHandler(async (event) => {
  assertInternalAuth(event)
  const id = memberIdParam(getRouterParam(event, 'id'))
  if (!id) return authFail(404, 'NOT_FOUND')
  const r = await withdrawMember(useDB(), id)
  if (!r.ok) return authFail(404, r.code)
  logEvent('AUTH_WITHDRAWN', 'info', 'member withdrawn by ops', {
    serviceUserId: id,
    by: 'ops',
    revokedSessions: r.revokedSessions,
  })
  return { serviceUserId: id, status: r.status, revokedSessions: r.revokedSessions }
})
