// GET /api/v1/auth/withdraw — 탈퇴 화면 경고 재료(F-12 · D-14): QR 을 아직 받지 않은 자체 구매 주문 수
import { useDB } from '../../../db'
import { requireAuthEnabled } from '../../../utils/auth-flags'
import { defineMemberHandler, noStore, requireUser } from '../../../utils/auth-route'
import { unissuedOrderCount } from '../../../utils/member-auth'

export default defineMemberHandler(async (event) => {
  requireAuthEnabled(event)
  noStore(event)
  const user = requireUser(event)
  return { unissuedOrderCount: await unissuedOrderCount(useDB(), user.serviceUserId) }
})
