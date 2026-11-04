<script setup lang="ts">
// 테스트 체크아웃 결제 성공 복귀(spec F-19 · S-7 · D-59) — 링크 0 · noindex(/checkout-preview/**).
// 쿼리 paymentKey · orderId · amount → ① 이 탭이 만든 주문번호가 아니면 ② 금액이 다르면 안내만(서버 호출 0) ③ 맞으면 confirm 1회.
// 쓴 주문번호(sessionStorage)는 결과를 그린 뒤 지운다 — 새로고침 · 뒤로 와도 confirm 을 다시 부르지 않는다.
import { NButton } from '@imjohnkoo/design-vue'
import type { PreviewItem } from '#shared/catalog/preview'
import {
  type ConfirmedPayment,
  NOT_CONFIGURED_MESSAGE,
  clearPendingPayment,
  formatApprovedAt,
  formatWon,
  judgeSuccessReturn,
  readFailReason,
  paymentStatusLabel,
  readPendingPayment,
  readSuccessReturn,
} from '~/utils/checkout-preview'

definePageMeta({ layout: 'flow' })
useHead({ title: '결제 결과' })

const preview = (useAppConfig() as { checkoutPreview?: PreviewItem }).checkoutPreview
if (!preview)
  throw createError({
    statusCode: 500,
    statusMessage: 'Checkout preview item missing',
    fatal: true,
  })
const PREVIEW_ITEM: PreviewItem = preview

const route = useRoute()

type View =
  | { kind: 'checking' }
  | { kind: 'foreign' }
  | { kind: 'amount' }
  | { kind: 'done'; payment: ConfirmedPayment }
  | { kind: 'error'; code: string; message: string }
const view = ref<View>({ kind: 'checking' })

onMounted(async () => {
  const ret = readSuccessReturn(route.query)
  const verdict = judgeSuccessReturn(ret, readPendingPayment(), PREVIEW_ITEM.amount)
  if (verdict === 'foreign') {
    view.value = { kind: 'foreign' }
    return
  }
  if (verdict === 'amount') {
    view.value = { kind: 'amount' }
    clearPendingPayment()
    return
  }
  try {
    const payment = await $fetch<ConfirmedPayment>('/api/v1/checkout-preview/confirm', {
      method: 'POST',
      body: ret,
    })
    view.value = { kind: 'done', payment }
  } catch (error) {
    const data = (error as { data?: Record<string, unknown> }).data ?? {}
    const reason = readFailReason(data)
    view.value = {
      kind: 'error',
      code: reason.code,
      message: reason.code === 'NOT_CONFIGURED' ? NOT_CONFIGURED_MESSAGE : reason.message,
    }
  }
  clearPendingPayment()
})

const retry = () => navigateTo('/checkout-preview')
// 화면 제목(문서 title 은 «결제 결과» 그대로) — 디자인 리뷰 TOSSCK
const heading = computed(() =>
  view.value.kind === 'done'
    ? '결제가 승인됐어요'
    : view.value.kind === 'error'
      ? '결제하지 못했어요'
      : '결제 결과',
)
</script>

<template>
  <div class="pay-result">
    <h1 class="pay-result__title">{{ heading }}</h1>

    <p v-if="view.kind === 'checking'" class="pay-result__text" role="status">
      승인을 확인하고 있어요.
    </p>
    <p v-else-if="view.kind === 'foreign'" class="pay-result__text" role="status">
      이 창에서 시작한 결제가 아니에요. 다시 결제해 주세요.
    </p>
    <p v-else-if="view.kind === 'amount'" class="pay-result__text" role="status">
      결제 금액이 상품 금액과 달라 승인하지 않았어요.
    </p>
    <template v-else-if="view.kind === 'done'">
      <p class="pay-result__text pay-result__text--ok" role="status">
        테스트 결제라 실제로 청구되지 않아요.
      </p>
      <dl class="pay-result__rows">
        <div class="pay-result__row">
          <dt>상태</dt>
          <dd>{{ paymentStatusLabel(view.payment.status) }}</dd>
        </div>
        <div class="pay-result__row">
          <dt>주문번호</dt>
          <dd class="pay-result__id">{{ view.payment.orderId }}</dd>
        </div>
        <div class="pay-result__row">
          <dt>승인 시각</dt>
          <dd>{{ formatApprovedAt(view.payment.approvedAt) }}</dd>
        </div>
        <div class="pay-result__row">
          <dt>결제수단</dt>
          <dd>{{ view.payment.method }}</dd>
        </div>
        <div class="pay-result__row">
          <dt>금액</dt>
          <dd>{{ formatWon(view.payment.totalAmount) }}</dd>
        </div>
      </dl>
    </template>
    <p v-else class="pay-result__text" role="alert">
      {{ view.message }}
      <span class="pay-result__code">오류 코드 {{ view.code }}</span>
    </p>

    <NButton
      v-if="view.kind !== 'checking'"
      variant="secondary"
      size="xl"
      full-width
      @click="retry"
    >
      다시 결제하기
    </NButton>
  </div>
</template>

<style scoped>
.pay-result {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100vh;
  padding: 24px 20px 32px;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.pay-result__title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
}

.pay-result__text {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--n-color-neutral-50, #fafafa);
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-800, #262626);
}

.pay-result__text--ok {
  background: var(--n-color-success-50, #f0fdf4);
}

.pay-result__code {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--n-color-neutral-500, #737373);
  word-break: break-all;
}

.pay-result__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  font-size: 14px;
  line-height: 1.55;
}

.pay-result__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.pay-result__row dt {
  flex-shrink: 0;
  color: var(--n-color-neutral-500, #737373);
}

.pay-result__row dd {
  margin: 0;
  text-align: right;
  color: var(--n-color-neutral-900, #171717);
}

.pay-result__id {
  word-break: break-all;
}
</style>
