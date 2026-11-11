// POST /api/v1/auth/signup {email, code, password, consent, age14} — 계정 생성 · 로그인(F-6 · I-9 · D-17)
import { getRequestHeader } from 'h3'
import { SIGNUP_CONSENT } from '../../../../shared/consent/signup-consent'
import { authFail, defineMemberHandler, memberPost, requestIpHash } from '../../../utils/auth-route'
import { setSessionCookie } from '../../../utils/auth-session'
import { logEvent } from '../../../utils/issuance-log'
import { createAccount } from '../../../utils/member-auth'
import { parseEmail } from '../../../utils/member-pii'
import { parsePassword } from '../../../utils/password'

export default defineMemberHandler(async (event) => {
  const { keys, db, body } = await memberPost(event)
  const email = parseEmail(body.email)
  if (!email) return authFail(400, 'INVALID_EMAIL')
  if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code))
    return authFail(400, 'CODE_MISMATCH')
  const password = parsePassword(body.password)
  if (!password) return authFail(400, 'WEAK_PASSWORD')
  const c = body.consent as Record<string, unknown> | undefined
  const consentOk =
    c?.kind === SIGNUP_CONSENT.kind &&
    c?.textVersion === SIGNUP_CONSENT.textVersion &&
    c?.textHash === SIGNUP_CONSENT.textHash
  if (!consentOk || body.age14 !== true) return authFail(400, 'CONSENT_REQUIRED')

  const r = await createAccount(db, keys, {
    email,
    code: body.code,
    password,
    ipHash: requestIpHash(event),
    userAgent: getRequestHeader(event, 'user-agent') ?? null,
  })
  if (!r.ok) {
    if (r.code === 'EMAIL_TAKEN') {
      logEvent('AUTH_SIGNUP_CONFLICT', 'warn', 'email already registered')
      return authFail(409, r.code)
    }
    logEvent('AUTH_SIGNUP_CODE_REJECTED', 'warn', 'signup code rejected', {
      reason: r.code.replace('CODE_', ''),
    })
    return authFail(400, r.code)
  }
  setSessionCookie(event, r.token, r.expiresAt)
  logEvent('AUTH_SIGNUP_COMPLETED', 'info', 'member signed up', { serviceUserId: r.serviceUserId })
  setResponseStatus(event, 201)
  return {}
})
