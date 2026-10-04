<script setup lang="ts">
import {
  NStepProgress,
  NPageHeading,
  NInfoChip,
  NStatusPill,
  NButton,
  NAlertDialog,
  NConfirmDialog,
  NLoaderDialog,
} from '@imjohnkoo/design-vue'
import { useOrderStore } from '~/stores/order'
import { useApi } from '~/composables/useApi'
import { useFlowSession } from '~/composables/useFlowSession'
import { formatDateString } from '~/utils/date'
import { decideSelection, isFullyIssued } from '~/utils/flow-guard'
import type { Order } from '~/types/order'

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const api = useApi()
const flowSession = useFlowSession()

const orderId = computed(() => Number(route.params.orderId))

const isNoOrderAlertVisible = ref(false)
const isCancelledOrderVisible = ref(false)
const isLoadingVisible = ref(false)
const isWithdrawCancelVisible = ref(false)
const withdrawTargetIndex = ref<number | null>(null)
const isWithdrawingVisible = ref(false)
const withdrawErrorTitle = ref('')
const withdrawErrorDesc = ref('')
const isWithdrawErrorVisible = ref(false)

const openWithdrawCancelDialog = (idx: number) => {
  withdrawTargetIndex.value = idx
  isWithdrawCancelVisible.value = true
}

// 철회 성공/경합 후 최신 주문 상태로 store 갱신 — backend 가 공유 DB 를 이미
// 갱신했으므로 재-verify 만으로 카드 상태 (cancelled/cancelWithdrawable) 가 수렴
const refreshOrders = async (receiverName: string, receiverPhoneNumber: string) => {
  const response = await api.verifyOrder({
    orderId: orderId.value,
    fullName: receiverName,
    phoneNumber: receiverPhoneNumber,
  })
  if (response.verified && response.details) {
    orderStore.setOrders(response.details)
  }
  return response
}

const handleWithdrawCancel = async () => {
  const idx = withdrawTargetIndex.value
  const target = idx != null ? orderStore.orders?.[idx] : undefined
  if (!target || !target.cancelWithdrawable) return

  isWithdrawingVisible.value = true
  try {
    // 철회 (Naver 재확인 + dispatch + DB 갱신은 backend 전담 — Nitro 위임 호출)
    await api.withdrawCancel(target)

    // 철회 성공 — 최신 상태 로드 후 발급 흐름 (select-date) 진입
    const response = await refreshOrders(target.receiverName, target.receiverPhoneNumber)
    const refreshed = response.details?.find(
      (o) => o.productOrderId === target.productOrderId,
    )
    isWithdrawingVisible.value = false

    if (refreshed && !refreshed.cancelled) {
      orderStore.setSingleOrder(refreshed)
      flowSession.select(orderId.value, refreshed.productOrderId)
      router.push(`/select-date/${orderId.value}`)
    } else {
      // 철회는 됐으나 sync 가 아직 안 잡힌 극단 케이스 — 카드 화면 유지
      withdrawErrorTitle.value = '철회가 접수됐어요'
      withdrawErrorDesc.value = '잠시 후 새로고침하면 발급을 진행할 수 있어요.'
      isWithdrawErrorVisible.value = true
    }
  } catch (error) {
    isWithdrawingVisible.value = false
    const err = error as { statusCode?: number; status?: number; data?: { data?: { code?: string } } }
    const status = err.statusCode ?? err.status
    const code = err.data?.data?.code

    if (status === 409 && code === 'CANCEL_DONE') {
      withdrawErrorTitle.value = '이미 취소가 완료된 주문이에요'
      withdrawErrorDesc.value = '환불까지 완료되어 철회할 수 없어요.\n다시 이용하려면 새로 주문해 주세요.'
    } else if (status === 503) {
      withdrawErrorTitle.value = '아직 준비 중인 기능이에요'
      withdrawErrorDesc.value = '잠시 후 다시 시도해 주세요.'
    } else {
      withdrawErrorTitle.value = '철회에 실패했어요'
      withdrawErrorDesc.value = '잠시 후 다시 시도해 주세요.\n문제가 계속되면 고객센터로 문의해 주세요.'
    }
    isWithdrawErrorVisible.value = true

    // 경합 (이미 취소완료) 이면 카드 상태도 최신으로 — 철회 버튼이 사라지도록
    if (status === 409) {
      try {
        await refreshOrders(target.receiverName, target.receiverPhoneNumber)
      } catch {
        /* 갱신 실패는 무시 — 다음 진입 시 verify 로 수렴 */
      }
    }
  }
}

// 발급 상태 판정 — quantity 대비 esims 수 기준. 부분 발급 (activate 중간 실패)
// 은 "이어서 발급하기" 로 select-date 재진입시켜 서버 resume 로직과 연결
const isPartiallyIssued = (order: Order) =>
  (order.esims?.length ?? 0) > 0 && !isFullyIssued(order)

const handleSelectOrder = async (idx: number) => {
  const orders = orderStore.orders

  // 취소된 상품주문은 진행 불가 (버튼 disabled 의 이중 방어)
  if (orders?.[idx]?.cancelled) return

  if (!orders) {
    isNoOrderAlertVisible.value = true
    setTimeout(() => {
      isNoOrderAlertVisible.value = false
      router.push(`/verify/${orderId.value}`)
    }, 3000)
    return
  }

  isLoadingVisible.value = true
  await new Promise((resolve) => setTimeout(resolve, 1500))

  try {
    const verifyDto = {
      orderId: orderId.value,
      phoneNumber: orders[idx]?.receiverPhoneNumber || '',
      fullName: orders[idx]?.receiverName || '',
    }

    const response = await api.verifyOrder(verifyDto)
    // 새 응답에서 productOrderId 로 찾아 진행 · 취소 · 없음을 가른다 — 위치(idx)로 집지 않는다 (flow-guard 순수함수)
    const outcome = decideSelection(response, orders[idx]?.productOrderId)

    if (outcome.kind === 'proceed') {
      const { target } = outcome
      orderStore.setOrders(response.details || [])
      orderStore.setSingleOrder(target)
      flowSession.select(orderId.value, target.productOrderId)
      isLoadingVisible.value = false
      if (isFullyIssued(target)) {
        router.push(`/view/${orderId.value}`)
      } else {
        // 미발급 + 부분 발급 (resume) 모두 select-date 로
        router.push(`/select-date/${orderId.value}`)
      }
    } else if (outcome.kind === 'cancelled') {
      isLoadingVisible.value = false
      isCancelledOrderVisible.value = true
      setTimeout(() => {
        isCancelledOrderVisible.value = false
        router.push(`/verify/${orderId.value}`)
      }, 2000)
    } else {
      isLoadingVisible.value = false
      isNoOrderAlertVisible.value = true
      setTimeout(() => {
        isNoOrderAlertVisible.value = false
        router.push(`/verify/${orderId.value}`)
      }, 2000)
    }
  } catch (error) {
    console.error(error)
    isLoadingVisible.value = false
    isNoOrderAlertVisible.value = true
    setTimeout(() => {
      isNoOrderAlertVisible.value = false
      router.push(`/verify/${orderId.value}`)
    }, 2000)
  }
}

// 진입 가드는 order-flow 미들웨어 — 주문 목록이 없으면 흐름 쿠키로 복원, 안 되면 본인 확인으로 (K8 · spec S-8)
// 게스트 발급 4-step 은 헤더 · 하단 탭 없는 flow 레이아웃 (spec D-2)
definePageMeta({ layout: 'flow', middleware: 'order-flow' })
</script>

<template>
  <div class="details-page">
    <div class="details-page__top">
      <NStepProgress :step="2" :total="4" label="이심 선택" />
    </div>

    <div class="details-page__heading">
      <NPageHeading
        eyebrow="eSIM QR 코드 발급"
        :title="`발행할 이심을\n선택해 주세요`"
        :description="`주문하신 상품이 여러 개라면\n발급할 항목을 골라 주세요.`"
      />
    </div>

    <div class="details-page__chip">
      <NInfoChip label="주문번호" :value="String(orderId)">
        <template #icon>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M8 2v4M16 2v4M3 10h18" />
          </svg>
        </template>
      </NInfoChip>
    </div>

    <ul v-if="orderStore.orders && orderStore.orders.length > 0" class="details-page__list">
      <li
        v-for="(order, index) in orderStore.orders"
        :key="order.productOrderId"
        class="details-page__card"
      >
        <div class="details-page__card-head">
          <NStatusPill v-if="order.cancelled" color="error" dot>주문취소</NStatusPill>
          <NStatusPill v-else-if="isFullyIssued(order)" color="info" dot>발급완료</NStatusPill>
          <NStatusPill v-else-if="isPartiallyIssued(order)" color="warning" dot>
            발급 미완료
          </NStatusPill>
          <NStatusPill v-else color="success" dot>주문완료</NStatusPill>
          <span class="details-page__date">
            {{ formatDateString(order.placeOrderDate) }}
          </span>
        </div>

        <h3 class="details-page__plan">{{ order.planNameKr }}</h3>
        <p class="details-page__meta">
          {{ order.planDataTypeKr }} · {{ order.planDataLimitKr }} · {{ order.planDataDuration }}일
        </p>

        <div class="details-page__countries">
          <span
            v-for="(country, countryIndex) in order.planCountriesKr"
            :key="countryIndex"
            class="details-page__country"
          >
            {{ country }}
          </span>
        </div>

        <div class="details-page__qty">
          <span>수량</span>
          <strong>{{ order.quantity }}개</strong>
        </div>

        <div class="details-page__action">
          <!-- 취소요청 (CANCEL_REQUEST) 중에만 철회 가능 — 취소완료는 단일 disabled -->
          <div
            v-if="order.cancelled && order.cancelWithdrawable"
            class="details-page__action-row"
          >
            <NButton variant="secondary" size="lg" full-width disabled>취소된 주문</NButton>
            <NButton variant="danger" size="lg" full-width @click="openWithdrawCancelDialog(index)">
              취소철회
            </NButton>
          </div>
          <NButton
            v-else-if="order.cancelled"
            variant="secondary"
            size="lg"
            full-width
            disabled
          >
            취소된 주문
          </NButton>
          <NButton
            v-else
            :variant="isFullyIssued(order) ? 'success' : 'primary'"
            size="lg"
            full-width
            @click="handleSelectOrder(index)"
          >
            {{
              isFullyIssued(order)
                ? 'QR 코드 보기'
                : isPartiallyIssued(order)
                  ? '이어서 발급하기'
                  : '선택하기'
            }}
          </NButton>
        </div>
      </li>
    </ul>

    <div v-else class="details-page__empty">
      <p>주문 정보를 불러오는 중이에요…</p>
    </div>

    <NLoaderDialog
      v-model="isLoadingVisible"
      title="이심을 준비하고 있어요"
      description="잠시만 기다려주세요…"
    />

    <NAlertDialog
      v-model="isNoOrderAlertVisible"
      title="주문 정보를 찾을 수 없어요"
      color="warning"
      :closable="false"
    >
      <p class="details-page__dialog-desc">
        주문번호를 다시 확인해 주세요.<br />본인 확인 페이지로 돌아갈게요.
      </p>
    </NAlertDialog>

    <NAlertDialog
      v-model="isCancelledOrderVisible"
      title="이미 취소된 주문이에요"
      color="warning"
      :closable="false"
    >
      <p class="details-page__dialog-desc">
        취소된 주문은 발급할 수 없어요.<br />본인 확인 페이지로 돌아갈게요.
      </p>
    </NAlertDialog>

    <NConfirmDialog
      v-model="isWithdrawCancelVisible"
      title="취소 철회"
      message="주문취소를 철회하고 QR코드를 발급합니다. 취소를 철회하시겠습니까?"
      confirm-text="철회하기"
      cancel-text="닫기"
      @confirm="handleWithdrawCancel"
    />

    <NLoaderDialog
      v-model="isWithdrawingVisible"
      title="취소를 철회하고 있어요"
      description="잠시만 기다려주세요…"
    />

    <NAlertDialog v-model="isWithdrawErrorVisible" :title="withdrawErrorTitle" color="warning">
      <p class="details-page__dialog-desc" style="white-space: pre-line">
        {{ withdrawErrorDesc }}
      </p>
    </NAlertDialog>
  </div>
</template>

<style scoped>
.details-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 20px 24px 32px;
  background: #ffffff;
}

.details-page__heading {
  margin-top: 28px;
}

.details-page__chip {
  margin-top: 18px;
}

.details-page__list {
  list-style: none;
  margin: 28px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.details-page__card {
  display: flex;
  flex-direction: column;
  padding: 18px;
  border-radius: var(--n-radius-xl, 18px);
  background: #ffffff;
  border: 1px solid #eef2f7;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px -16px rgba(15, 23, 42, 0.12);
}

.details-page__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.details-page__date {
  font-size: 12px;
  color: #94a3b8;
  letter-spacing: -0.01em;
}

.details-page__plan {
  margin: 14px 0 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.01em;
  line-height: 1.35;
}

.details-page__meta {
  margin: 6px 0 0;
  font-size: 13px;
  color: #64748b;
  letter-spacing: -0.005em;
}

.details-page__countries {
  margin-top: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.details-page__country {
  font-size: 11.5px;
  font-weight: 500;
  color: #475569;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 999px;
}

.details-page__qty {
  margin-top: 14px;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
  color: #64748b;
}

.details-page__qty strong {
  color: #0f172a;
  font-weight: 700;
}

.details-page__action {
  margin-top: 16px;
}

.details-page__action-row {
  display: flex;
  gap: 8px;
}

/* 취소된 주문 2/3 : 취소철회 1/3 */
.details-page__action-row > :first-child {
  flex: 2;
}

.details-page__action-row > :last-child {
  flex: 1;
}

.details-page__empty {
  margin-top: 60px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.details-page__dialog-desc {
  margin: -6px 0 0;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
  line-height: 1.55;
}
</style>
