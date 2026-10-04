/**
 * 게스트 발급 4-step 가드 (K8 · spec F-16) — 페이지별 onMounted 가드를 대신한다.
 * 4-step 4페이지가 definePageMeta({ middleware: 'order-flow' }) 로 건다.
 *
 * 실행 시점: 초기 진입은 서버(SSR — 이동이면 302)에서 한 번, hydration 때 클라이언트에서 한 번 더
 * (Nuxt router 의 app:created replace), 이후 이동마다 클라이언트에서. 서버가 복원한 Pinia 상태는 페이로드로
 * 넘어가므로 두 번째 실행은 ③ 을 건너뛴다(중복 verify 없음).
 *
 * 순서 (되먹임 대상 — apps/client/CLAUDE.md):
 *  ① 경로 주문번호가 양의 안전 정수가 아니면 /my-esim
 *  ② verify 화면은 통과
 *  ③ store 에 이 주문의 목록이 없으면 흐름 쿠키로 복원 — 쿠키 주문번호 = 경로 주문번호일 때만,
 *     쿠키의 이름 · 전화로 POST /api/v1/verify 를 «그대로» 부른다(요청 body = verify 화면과 동일 · 계약 불변).
 *     쿠키 없음 · 다른 주문 · verify 거절 · 오류 → /verify/{주문번호}?reason=reverify
 *     (거절이면 쿠키도 지운다 · 네트워크 · 서버 오류나 JSON 이 아닌 응답이면 남긴다)
 *  ④ 선택 상품이 store 에 없으면 쿠키의 상품주문번호로 목록에서 고른다(API 호출 없음)
 *  ⑤ 판정표(~/utils/flow-guard)로 이동 또는 통과
 */
import { useApi } from '~/composables/useApi'
import { useFlowSession } from '~/composables/useFlowSession'
import { useOrderStore } from '~/stores/order'
import {
  decideRestore,
  flowStepOf,
  parseOrderIdParam,
  pickSelection,
  resolveFlowRedirect,
  reverifyPath,
} from '~/utils/flow-guard'

export default defineNuxtRouteMiddleware(async (to) => {
  const step = flowStepOf(to.path)
  if (!step) return

  const orderId = parseOrderIdParam(to.params.orderId)
  if (orderId === null) return navigateTo('/my-esim', { replace: true })
  if (step === 'verify') return

  const store = useOrderStore()
  const flowSession = useFlowSession()
  const session = flowSession.read()

  const decision = decideRestore(session, orderId, store.hasOrdersFor(orderId))
  if (decision === 'reverify') return navigateTo(reverifyPath(orderId), { replace: true })
  if (decision === 'restore' && session) {
    try {
      const response = await useApi().verifyOrder({
        orderId,
        fullName: session.fullName,
        phoneNumber: session.phoneNumber,
      })
      // 2xx 인데 JSON 이 아닌 응답(CDN 오류 페이지 등)은 거절이 아니라 오류 — 쿠키를 지우지 않는다
      if (!response || typeof response !== 'object') {
        return navigateTo(reverifyPath(orderId), { replace: true })
      }
      if (!response.verified || !response.details?.length) {
        flowSession.clear()
        return navigateTo(reverifyPath(orderId), { replace: true })
      }
      store.setOrders(response.details)
      store.clearSingleOrder()
    } catch {
      return navigateTo(reverifyPath(orderId), { replace: true })
    }
  }

  if (store.singleOrder?.orderId !== orderId) {
    const picked = pickSelection(store.orders, session, orderId)
    if (picked) store.setSingleOrder(picked)
  }

  const redirect = resolveFlowRedirect(step, orderId, {
    orders: store.orders,
    selected: store.singleOrder,
  })
  if (redirect) return navigateTo(redirect, { replace: true })
})
