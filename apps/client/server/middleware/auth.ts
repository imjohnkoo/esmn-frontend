/**
 * Auth middleware — 회원 세션(member-client-auth spec F-3 · D-12).
 *
 * 판정은 전부 `server/utils/auth-session.ts`(플랫폼 · 토큰 추출 · 조회 · 슬라이딩) — 여기서는 부르기만 한다.
 *  - Web   : HttpOnly cookie `nomacom_session`
 *  - Mobile: `Authorization: Bearer <token>` (쿼리 0)
 * 회원 수단이 하나도 켜져 있지 않으면 DB 를 보지 않는다(user = null).
 */
import { useDB } from '../db'
import { resolveRequestAuth } from '../utils/auth-session'

export default defineEventHandler(async (event) => {
  event.context.auth = await resolveRequestAuth(event, useDB)
})
