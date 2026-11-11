// POST /api/internal/members/{id}/suspend — 운영 정지(F-14 · N-11): status suspended + 세션 전부 revoke. 호출자 = CTO 래퍼 · 응답 PII 0 · 플래그 무관
import { useDB } from '../../../../db'
import { assertInternalAuth } from '../../../../utils/auth-guard'
import { authFail, memberIdParam } from '../../../../utils/auth-route'
import { logEvent } from '../../../../utils/issuance-log'
import { suspendMember } from '../../../../utils/member-auth'

export default defineEventHandler(async (event) => {
  assertInternalAuth(event)
  const id = memberIdParam(getRouterParam(event, 'id'))
  if (!id) return authFail(404, 'NOT_FOUND')
  const r = await suspendMember(useDB(), id)
  if (!r.ok) return authFail(r.code === 'NOT_FOUND' ? 404 : 409, r.code)
  logEvent('MEMBER_SUSPENDED', 'info', 'member suspended', {
    serviceUserId: id,
    revokedSessions: r.revokedSessions,
  })
  return { serviceUserId: id, status: r.status, revokedSessions: r.revokedSessions }
})
