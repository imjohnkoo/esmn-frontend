<script setup lang="ts">
// 테스트 체크아웃 (K9 · spec S-7) — PG 심사 캡처 전용. 사이트 어디에서도 링크하지 않는다 · noindex.
// 주문 저장 · 발급 · 서버 호출 0. 키는 runtimeConfig.public.portone(테스트 채널키만 — 이름에 TEST).
import { NButton, NCheckbox } from '@imjohnkoo/design-vue'
import {
  PENDING_PAYMENT_KEY,
  PREVIEW_ITEM,
  PREVIEW_ORDER_NAME,
  createPaymentId,
  formatWon,
  buildReturnQuery,
  canPayWith,
  initialConsent,
  readPaymentResult,
} from '~/utils/checkout-preview'

definePageMeta({ layout: 'flow' })
useHead({ title: '결제하기' })

const config = useRuntimeConfig()
const route = useRoute()

const storeId = config.public.portone.storeId
const channelKey = config.public.portone.testChannelKey
const isConfigured = Boolean(storeId && channelKey)

// 05-B(client-shell spec F-22) — 필수 2(이용약관 · 만 14세)가 체크돼야 결제 · 선택 1(마케팅)은 결제와 무관 · 서버 저장 0(F-19).
// 처음 값 · 필수 판정은 utils(CONSENT_ITEMS — 정본 문구의 «(필수)» 머리)에서만 — 여기서 체크 값을 쓰지 않는다
const agreed = reactive(initialConsent())
const canPay = computed(() => canPayWith(agreed))
const isRequesting = ref(false)
const openError = ref<string | null>(null)
// 이 탭이 만든 결제 ID(sessionStorage) — 복귀 쿼리가 이것과 같을 때만 결과 줄을 그린다(링크로 만든 임의 문구 차단)
const expectedPaymentId = ref<string | null>(null)
const result = computed(() => readPaymentResult(route.query, expectedPaymentId.value))

const readPendingPayment = () => {
  try {
    return sessionStorage.getItem(PENDING_PAYMENT_KEY)
  } catch {
    return null
  }
}
const writePendingPayment = (paymentId: string) => {
  try {
    sessionStorage.setItem(PENDING_PAYMENT_KEY, paymentId)
  } catch {
    /* 저장이 막힌 브라우저 — 결과 줄만 안 보인다 */
  }
}

// 결제창에서 뒤로 와 bfcache 로 복원되면 promise 가 끝나지 않은 채라 로딩으로 굳는다 — 되돌린다 (spec D-21)
const onPageShow = (event: PageTransitionEvent) => {
  if (event.persisted) isRequesting.value = false
}
onMounted(() => {
  expectedPaymentId.value = readPendingPayment()
  window.addEventListener('pageshow', onPageShow)
})
onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow))

const onPay = async () => {
  if (!isConfigured || !canPay.value || isRequesting.value) return
  isRequesting.value = true
  openError.value = null
  try {
    // SDK 는 클릭 때만 불러온다(SSR 번들 제외) — 첫 호출에 PortOne CDN 스크립트를 넣는다
    const PortOne = await import('@portone/browser-sdk/v2')
    const paymentId = createPaymentId(Date.now(), crypto.getRandomValues(new Uint8Array(12)))
    writePendingPayment(paymentId)
    expectedPaymentId.value = paymentId
    const response = await PortOne.requestPayment({
      storeId,
      channelKey,
      paymentId,
      orderName: PREVIEW_ORDER_NAME,
      totalAmount: PREVIEW_ITEM.amount,
      currency: 'KRW',
      payMethod: 'CARD',
      redirectUrl: `${window.location.origin}/checkout-preview`,
      // PC(iframe) · 모바일(리다이렉트) 모두 결과를 복귀 쿼리로 받는다 — 결과 처리는 readPaymentResult 하나
      forceRedirect: true,
    })
    // 응답 없음 = 리디렉트로 페이지를 떠나는 중 — 로딩을 유지한다(다시 누르면 결제 ID 가 덮인다). bfcache 복귀는 pageshow 가 푼다
    if (!response) return
    // 창 없이 끝난 응답(창을 열기 전 오류 등)도 같은 복귀 쿼리로 — 결과 처리는 readPaymentResult 하나 (spec F-19)
    await navigateTo(
      { path: '/checkout-preview', query: buildReturnQuery(response, paymentId) },
      { replace: true },
    )
    isRequesting.value = false
  } catch (error) {
    openError.value = error instanceof Error ? error.message : String(error)
    isRequesting.value = false
  }
}

// 05-B 문구(생성물) — 스크립트 끝(위 줄 번호를 밀지 않게)
import { BEFORE_NOTICE, CONSENT_ITEMS, PRIVACY_NOTICE } from '~/utils/checkout-preview'
import { renderNoticeList } from '~/utils/legal-render'
</script>

<template>
  <div class="checkout">
    <h1 class="checkout__title">결제하기</h1>

    <section class="checkout__card" aria-labelledby="checkout-item-title">
      <h2 id="checkout-item-title" class="checkout__label">주문 상품</h2>
      <p class="checkout__product">{{ PREVIEW_ITEM.productName }}</p>
      <p class="checkout__option">{{ PREVIEW_ITEM.optionName }}</p>
      <dl class="checkout__rows">
        <div class="checkout__row">
          <dt>수량</dt>
          <dd>{{ PREVIEW_ITEM.quantity }}개</dd>
        </div>
        <div class="checkout__row">
          <dt>사용 기간</dt>
          <dd>{{ PREVIEW_ITEM.usage }}</dd>
        </div>
        <div class="checkout__row checkout__row--total">
          <dt>결제 금액</dt>
          <dd>{{ formatWon(PREVIEW_ITEM.amount) }}</dd>
        </div>
      </dl>
    </section>

    <section class="checkout__section" aria-labelledby="checkout-check-title">
      <h2 id="checkout-check-title" class="checkout__label">구매 전 확인</h2>
      <p class="checkout__text">
        eSIM 지원 기기인지 먼저 확인해 주세요.
        <a href="/supported-devices" target="_blank" rel="noopener" class="checkout__link"
          >지원 기기 확인<span class="sr-only"> (새 창)</span></a
        >
      </p>
    </section>

    <section class="checkout__section" aria-labelledby="checkout-method-title">
      <h2 id="checkout-method-title" class="checkout__label">결제 수단</h2>
      <p class="checkout__method">
        <span class="checkout__radio" aria-hidden="true" />
        신용 · 체크카드
      </p>
    </section>

    <!-- 05-B 원문(client-shell spec F-22) — 필수 2 · 선택 1 · 개인정보 수집 · 이용 «안내»(체크 없음 — 계약 이행 근거) · 결제 전 안내.
         링크는 새 창(이 화면의 체크 상태를 잃지 않게) -->
    <section class="checkout__agree" aria-label="약관 동의 · 개인정보 안내">
      <div v-for="item in CONSENT_ITEMS" :key="item.key" class="checkout__consent-item">
        <div class="checkout__consent">
          <NCheckbox v-model="agreed[item.key]" :label="item.label" />
          <a
            v-for="link in item.links"
            :key="link.href"
            :href="link.href"
            target="_blank"
            rel="noopener"
            class="checkout__link"
            >{{ link.text }}<span class="sr-only"> (새 창)</span></a
          >
        </div>
        <p v-if="item.info" class="checkout__consent-info">{{ item.info }}</p>
      </div>

      <div class="checkout__notice">
        <p class="checkout__notice-title">
          {{ PRIVACY_NOTICE.label }}
          <a
            v-for="link in PRIVACY_NOTICE.links"
            :key="link.href"
            :href="link.href"
            target="_blank"
            rel="noopener"
            class="checkout__link"
            >{{ link.text }}<span class="sr-only"> (새 창)</span></a
          >
        </p>
        <p class="checkout__consent-info">{{ PRIVACY_NOTICE.info }}</p>
      </div>

      <div class="checkout__notice">
        <p class="checkout__notice-title">{{ BEFORE_NOTICE.title }}</p>
        <component :is="renderNoticeList(BEFORE_NOTICE.lines)" />
      </div>
    </section>

    <div class="checkout__cta">
      <NButton
        variant="primary"
        size="xl"
        full-width
        :disabled="!isConfigured || !canPay"
        :loading="isRequesting"
        @click="onPay"
      >
        {{ formatWon(PREVIEW_ITEM.amount) }} 결제하기
      </NButton>
      <p v-if="!isConfigured" class="checkout__note">결제 설정을 준비하고 있어요.</p>
    </div>

    <p
      v-if="!openError && result.status === 'success'"
      class="checkout__result checkout__result--ok"
      role="status"
    >
      결제창 호출과 승인을 확인했어요. 테스트 결제라 실제로 청구되지 않아요.
      <span class="checkout__result-id">결제 ID {{ result.paymentId }}</span>
    </p>
    <p v-else-if="!openError && result.status === 'failed'" class="checkout__result" role="status">
      결제가 완료되지 않았어요. ({{ result.message }})
    </p>
    <p v-if="openError" class="checkout__result" role="alert">
      결제창을 열지 못했어요. ({{ openError }})
    </p>
  </div>
</template>

<style scoped>
.checkout {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-height: 100vh;
  padding: 24px 20px 32px;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.checkout__title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
}

.checkout__card {
  padding: 18px;
  border: 1px solid var(--n-color-neutral-100, #f5f5f5);
  border-radius: 16px;
  background: var(--n-color-neutral-0, #ffffff);
  box-shadow: 0 8px 24px -16px rgba(15, 23, 42, 0.12);
}

.checkout__label {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--n-color-neutral-500, #737373);
}

.checkout__product {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--n-color-neutral-900, #171717);
}

.checkout__option {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--n-color-neutral-600, #525252);
}

.checkout__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 14px 0 0;
  padding-top: 14px;
  border-top: 1px solid var(--n-color-neutral-100, #f5f5f5);
  font-size: 14px;
  line-height: 1.55;
}

.checkout__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.checkout__row dt {
  flex-shrink: 0;
  color: var(--n-color-neutral-500, #737373);
}

.checkout__row dd {
  margin: 0;
  text-align: right;
  color: var(--n-color-neutral-900, #171717);
}

.checkout__row--total dd {
  font-size: 17px;
  font-weight: 800;
}

.checkout__text,
.checkout__method {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-800, #262626);
}

.checkout__method {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkout__radio {
  width: 16px;
  height: 16px;
  border: 5px solid var(--n-color-primary-500, #6239ff);
  border-radius: 50%;
}

.checkout__link {
  font-weight: 600;
  color: var(--n-color-primary-600, #5025e8);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.checkout__agree {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  word-break: keep-all;
  overflow-wrap: break-word;
}

/* 항목 하나 = 체크 줄 + 알릴 사항 — 바깥 목록과 같은 간격(알릴 사항은 아래 음수 여백으로 체크 줄에 붙는다) */
.checkout__consent-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkout__consent {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}

.checkout__consent .checkout__link {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  font-size: 13px;
}

.checkout__consent-info {
  margin: -4px 0 0 28px;
  color: var(--n-color-neutral-500, #737373);
  font-size: 12px;
  line-height: 1.6;
}

.checkout__notice {
  margin-top: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--n-color-neutral-50, #fafafa);
}

.checkout__notice .checkout__consent-info {
  margin: 4px 0 0;
}

.checkout__notice-title {
  margin: 0;
  color: var(--n-color-neutral-800, #262626);
  font-size: 13px;
  font-weight: 700;
}

.checkout__notice :deep(.issue-notice__list) {
  margin: 4px 0 0;
  padding-left: 16px;
  list-style: disc outside;
  color: var(--n-color-neutral-600, #525252);
  font-size: 12px;
  line-height: 1.6;
}

.checkout__notice :deep(.legal-md__link) {
  color: var(--n-color-primary-600, #5025e8);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.checkout__cta {
  margin-top: auto;
  padding-top: 8px;
}

.checkout__note {
  margin: 8px 0 0;
  font-size: 13px;
  text-align: center;
  color: var(--n-color-neutral-500, #737373);
}

.checkout__result {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--n-color-neutral-50, #fafafa);
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-color-neutral-800, #262626);
}

.checkout__result--ok {
  background: var(--n-color-success-50, #f0fdf4);
}

.checkout__result-id {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: var(--n-color-neutral-500, #737373);
  word-break: break-all;
}
</style>
