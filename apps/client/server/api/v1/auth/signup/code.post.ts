// POST /api/v1/auth/signup/code {email} — 가입 코드 발송(F-4 · D-9 · I-2). 가입 여부와 상관없이 같은 판정 · 202
import { authFail, memberPost } from '../../../../utils/auth-route'
import { logEvent } from '../../../../utils/issuance-log'
import { requestSignupCode } from '../../../../utils/member-auth'
import { parseEmail } from '../../../../utils/member-pii'
import { emailConfigured, sendMemberEmail } from '../../../../utils/notify-email'

export default defineEventHandler(async (event) => {
  const { keys, db, body } = await memberPost(event)
  const email = parseEmail(body.email)
  if (!email) return authFail(400, 'INVALID_EMAIL')
  if (!emailConfigured()) {
    logEvent('AUTH_EMAIL_SEND_FAILED', 'error', 'email endpoint not configured', {
      kind: 'signup_code',
      upstreamStatus: null,
    })
    return authFail(503, 'EMAIL_UNAVAILABLE')
  }
  const r = await requestSignupCode(db, keys, email)
  if (!r.ok) {
    logEvent('AUTH_SIGNUP_CODE_THROTTLED', 'warn', 'signup code throttled', { reason: r.reason })
    return authFail(429, r.code)
  }
  const sent = await sendMemberEmail('signup_code', email, { code: r.code })
  if (!sent.ok) {
    logEvent('AUTH_EMAIL_SEND_FAILED', 'error', 'signup code send failed', {
      kind: 'signup_code',
      upstreamStatus: sent.upstreamStatus,
    })
    return authFail(502, 'EMAIL_SEND_FAILED')
  }
  logEvent('AUTH_SIGNUP_CODE_SENT', 'info', 'signup code sent', {
    result: sent.result,
    ms: sent.ms,
  })
  setResponseStatus(event, 202)
  return {}
})
