// POST /api/v1/auth/password-reset {email} — 늘 202(F-9 · I-2). 계정 확인 · 토큰 · 발송은 응답 뒤에 — 시간 차로 가입 여부가 드러나지 않게
import { authFail, memberPost } from '../../../../utils/auth-route'
import { authConfig } from '../../../../utils/auth-flags'
import { logEvent } from '../../../../utils/issuance-log'
import { requestPasswordReset } from '../../../../utils/member-auth'
import { parseEmail } from '../../../../utils/member-pii'
import { sendMemberEmail } from '../../../../utils/notify-email'
import { dbCause } from '../../../../utils/auth-session'

export default defineEventHandler(async (event) => {
  const { keys, db, body } = await memberPost(event)
  const email = parseEmail(body.email)
  if (!email) return authFail(400, 'INVALID_EMAIL')
  const origin = String(authConfig(event).linkOrigin || 'https://esimmany.com').replace(/\/+$/, '')

  const work = (async () => {
    const r = await requestPasswordReset(db, keys, email)
    if (!r.token) {
      logEvent('AUTH_PASSWORD_RESET_REQUESTED', 'info', 'password reset requested', {
        sent: false,
        ...(r.serviceUserId ? { serviceUserId: r.serviceUserId } : {}),
      })
      return
    }
    // 토큰은 프래그먼트에만(D-8) — 서버 · CloudFront 로그 · Referer 0
    const sent = await sendMemberEmail('password_reset', email, {
      resetUrl: `${origin}/password/reset/new#${r.token}`,
    })
    if (!sent.ok) {
      logEvent('AUTH_EMAIL_SEND_FAILED', 'error', 'password reset send failed', {
        kind: 'password_reset',
        upstreamStatus: sent.upstreamStatus,
      })
      return
    }
    logEvent('AUTH_PASSWORD_RESET_REQUESTED', 'info', 'password reset requested', {
      sent: true,
      serviceUserId: r.serviceUserId,
    })
  })().catch((e) => logEvent('AUTH_PASSWORD_RESET_FAILED', 'error', dbCause(e)))
  event.waitUntil?.(work)

  setResponseStatus(event, 202)
  return {}
})
