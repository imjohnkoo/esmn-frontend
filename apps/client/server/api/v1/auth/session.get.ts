// GET /api/v1/auth/session — 화면이 회원 플래그 · 로그인 상태를 아는 유일한 길(member-client-auth F-11 · D-1). no-store · 꺼짐이면 {methods:[], user:null}
import { useDB } from '../../../db'
import { authMethods } from '../../../utils/auth-flags'
import { defineMemberHandler, noStore } from '../../../utils/auth-route'
import { logEvent } from '../../../utils/issuance-log'
import { memberSummary } from '../../../utils/member-auth'
import { loadMemberKeys, MemberKeysUnavailable } from '../../../utils/member-pii'
import { dbCause } from '../../../utils/auth-session'

export default defineMemberHandler(async (event) => {
  noStore(event)
  const methods = authMethods(event)
  const user = event.context.auth?.user
  if (methods.length === 0 || !user) return { methods, user: null }
  try {
    return { methods, user: await memberSummary(useDB(), loadMemberKeys(), user.serviceUserId) }
  } catch (e) {
    // 키 · DB 실패 — 로그인 상태를 숨기는 쪽으로(화면은 비로그인으로 그린다). 원인별로 따로 남긴다
    if (e instanceof MemberKeysUnavailable) {
      logEvent('AUTH_KEYS_UNAVAILABLE', 'error', 'session summary failed', { key: e.key })
    } else {
      logEvent('AUTH_SESSION_LOOKUP_FAILED', 'error', dbCause(e))
    }
    return { methods, user: null }
  }
})
