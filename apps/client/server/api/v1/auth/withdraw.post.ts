// POST /api/v1/auth/withdraw {password} — 화면 안 탈퇴(F-12 · K-A6 · 법 38조④) · 204
import { authFail, memberPost, requireUser } from '../../../utils/auth-route'
import { clearSessionCookie } from '../../../utils/auth-session'
import { logEvent } from '../../../utils/issuance-log'
import { withdrawWithPassword } from '../../../utils/member-auth'
import { PASSWORD_MAX } from '../../../utils/password'

export default defineEventHandler(async (event) => {
  const { db, body } = await memberPost(event)
  const user = requireUser(event)
  const password = body.password
  if (typeof password !== 'string' || [...password].length > PASSWORD_MAX)
    return authFail(401, 'PASSWORD_MISMATCH')
  const r = await withdrawWithPassword(db, user.serviceUserId, password)
  if (!r.ok) {
    if (r.code === 'LOGIN_LOCKED') logEvent('AUTH_LOGIN_LOCKED', 'warn', 'withdraw password locked')
    return authFail(r.code === 'LOGIN_LOCKED' ? 429 : 401, r.code)
  }
  clearSessionCookie(event)
  logEvent('AUTH_WITHDRAWN', 'info', 'member withdrew', {
    serviceUserId: user.serviceUserId,
    by: 'self',
    revokedSessions: r.revokedSessions,
  })
  setResponseStatus(event, 204)
  return null
})
