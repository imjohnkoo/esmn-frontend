// POST /api/v1/auth/signup/verify {email, code} — 코드 확인(F-5 · 소비하지 않는다 · 시도는 예약해 센다)
import { authFail, defineMemberHandler, memberPost } from '../../../../utils/auth-route'
import { logEvent } from '../../../../utils/issuance-log'
import { checkSignupCode } from '../../../../utils/member-auth'
import { parseEmail } from '../../../../utils/member-pii'

export default defineMemberHandler(async (event) => {
  const { keys, db, body } = await memberPost(event)
  const email = parseEmail(body.email)
  if (!email) return authFail(400, 'INVALID_EMAIL')
  // 6자리 숫자가 아니면 맞을 수 없다 — 시도로 세지 않고 불일치
  if (typeof body.code !== 'string' || !/^\d{6}$/.test(body.code))
    return authFail(400, 'CODE_MISMATCH')
  const r = await checkSignupCode(db, keys, email, body.code)
  if (!r.ok) {
    logEvent('AUTH_SIGNUP_CODE_REJECTED', 'warn', 'signup code rejected', {
      reason: r.code.replace('CODE_', ''),
    })
    return authFail(400, r.code)
  }
  return {}
})
