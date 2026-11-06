<script setup lang="ts">
// 테스트 체크아웃 결제 실패 · 취소 복귀(spec F-19 · S-7 · D-59) — 링크 0 · noindex(/checkout-preview/**). 서버 호출 0.
// 쿼리 code · message(80자). 토스 취소(PAY_PROCESS_CANCELED)는 orderId 를 싣지 않아 주문번호로 대조할 수 없다 —
// 이 탭이 결제를 시작했을 때(sessionStorage 에 주문번호가 있을 때)만 사유를 그린다(링크로 만든 임의 문구 차단). 그린 뒤 지운다.
import { NButton } from '@imjohnkoo/design-vue'
import {
  FAIL_FALLBACK_MESSAGE,
  clearPendingPayment,
  readFailReason,
  readPendingPayment,
} from '~/utils/checkout-preview'

definePageMeta({ layout: 'flow' })
useHead({ title: '결제 결과' })

const route = useRoute()

type View =
  | { kind: 'checking' }
  | { kind: 'foreign' }
  | { kind: 'failed'; code: string; message: string }
const view = ref<View>({ kind: 'checking' })

onMounted(() => {
  if (!readPendingPayment()) {
    view.value = { kind: 'foreign' }
    return
  }
  view.value = { kind: 'failed', ...readFailReason(route.query, FAIL_FALLBACK_MESSAGE) }
  clearPendingPayment()
})

const retry = () => navigateTo('/checkout-preview')
// 화면 제목(문서 title 은 «결제 결과» 그대로) — 디자인 리뷰 TOSSCK
const heading = computed(() => (view.value.kind === 'failed' ? '결제하지 못했어요' : '결제 결과'))
</script>

<template>
  <div class="pay-result">
    <h1 class="pay-result__title">{{ heading }}</h1>

    <p v-if="view.kind === 'foreign'" class="pay-result__text" role="status">
      이 창에서 시작한 결제가 아니에요. 다시 결제해 주세요.
    </p>
    <p v-else-if="view.kind === 'failed'" class="pay-result__text" role="status">
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

.pay-result__code {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--n-color-neutral-500, #737373);
  word-break: break-all;
}
</style>
