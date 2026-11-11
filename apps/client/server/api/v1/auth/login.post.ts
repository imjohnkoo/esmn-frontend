// POST /api/v1/auth/login {email, password} — 로그인(F-7 · I-2 · I-12 · I-14). 없는 계정 · 틀림 · 정지 · 탈퇴 = 같은 401
import { authFail, defineMemberHandler, memberPost } from '../../../utils/auth-route'
import { setSessionCookie } from '../../../utils/auth-session'
import { logEvent } from '../../../utils/issuance-log'
import { login } from '../../../utils/member-auth'
import { parseEmail } from '../../../utils/member-pii'
import { PASSWORD_MAX } from '../../../utils/password'

export default defineMemberHandler(async (event) => {
  const { keys, db, body } = await memberPost(event)
  const email = parseEmail(body.email)
  const password = body.password
  if (!email || typeof password !== 'string' || [...password].length > PASSWORD_MAX) {
    logEvent('AUTH_LOGIN_FAILED', 'warn', 'login failed', { reason: 'BAD_CREDENTIALS' })
    return authFail(401, 'INVALID_CREDENTIALS')
  }
  const r = await login(db, keys, email, password)
  if (!r.ok) {
    if (r.code === 'LOGIN_LOCKED') logEvent('AUTH_LOGIN_LOCKED', 'warn', 'login locked')
    else logEvent('AUTH_LOGIN_FAILED', 'warn', 'login failed', { reason: 'BAD_CREDENTIALS' })
    return authFail(r.code === 'LOGIN_LOCKED' ? 429 : 401, r.code)
  }
  setSessionCookie(event, r.token, r.expiresAt)
  logEvent('AUTH_LOGIN_SUCCEEDED', 'info', 'member logged in', {
    serviceUserId: r.serviceUserId,
    platform: event.context.auth?.platform ?? 'unknown',
  })
  return {}
})
