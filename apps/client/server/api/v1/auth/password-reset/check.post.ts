// POST /api/v1/auth/password-reset/check {token} — 링크 유효 여부(F-10 · 소비하지 않는다) · 무효 410
import {
  RESET_TOKEN_RE,
  authFail,
  defineMemberHandler,
  memberPost,
} from '../../../../utils/auth-route'
import { logEvent } from '../../../../utils/issuance-log'
import { checkResetToken } from '../../../../utils/member-auth'

export default defineMemberHandler(async (event) => {
  const { keys, db, body } = await memberPost(event)
  const ok =
    typeof body.token === 'string' &&
    RESET_TOKEN_RE.test(body.token) &&
    (await checkResetToken(db, keys, body.token))
  if (!ok) {
    logEvent('AUTH_PASSWORD_RESET_REJECTED', 'warn', 'reset token rejected', {
      reason: 'TOKEN_INVALID',
    })
    return authFail(410, 'TOKEN_INVALID')
  }
  return {}
})
