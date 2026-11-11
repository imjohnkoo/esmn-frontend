// POST /api/v1/auth/password-reset/confirm {token, password} — 새 비밀번호 · 세션 전부 revoke(F-10 · I-4) · 204(새 세션 없음)
import { authFail, memberPost, RESET_TOKEN_RE } from '../../../../utils/auth-route'
import { clearSessionCookie } from '../../../../utils/auth-session'
import { logEvent } from '../../../../utils/issuance-log'
import { confirmPasswordReset } from '../../../../utils/member-auth'
import { hashPassword, parsePassword } from '../../../../utils/password'

export default defineEventHandler(async (event) => {
  const { keys, db, body } = await memberPost(event)
  if (typeof body.token !== 'string' || !RESET_TOKEN_RE.test(body.token)) {
    logEvent('AUTH_PASSWORD_RESET_REJECTED', 'warn', 'reset token rejected', {
      reason: 'TOKEN_INVALID',
    })
    return authFail(410, 'TOKEN_INVALID')
  }
  const password = parsePassword(body.password)
  if (!password) return authFail(400, 'WEAK_PASSWORD')
  const r = await confirmPasswordReset(db, keys, body.token, await hashPassword(password))
  if (!r.ok) {
    logEvent('AUTH_PASSWORD_RESET_REJECTED', 'warn', 'reset token rejected', {
      reason: 'TOKEN_INVALID',
    })
    return authFail(410, r.code)
  }
  clearSessionCookie(event)
  logEvent('AUTH_PASSWORD_RESET_COMPLETED', 'info', 'password reset', {
    serviceUserId: r.serviceUserId,
    revokedSessions: r.revokedSessions,
  })
  setResponseStatus(event, 204)
  return null
})
