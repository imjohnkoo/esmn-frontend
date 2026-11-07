<script setup lang="ts">
// 테스트 체크아웃 (K9 · spec S-7 · D-59) — «구매하기» 가 고른 옵션으로 오거나(테스트 키일 때만 · D-60) URL 직접(심사 품목) · noindex.
// 결제창 = 토스페이먼츠 결제위젯 v2(주문서형). 주문 저장 · 발급 0 — 승인(confirm)은 복귀 화면 /checkout-preview/success 가 한 번 부른다.
// 상품 값은 미들웨어(middleware/checkout-preview.ts)가 서버 카탈로그에서 받아 넘긴다 — 모르는 코드 · test_ 아닌 키는 여기까지 오지 않는다.
// 키는 runtimeConfig.public.toss.clientKey(심사 기간 test_gck_*).
import { NButton, NCheckbox } from '@imjohnkoo/design-vue'
import type { TossPaymentsWidgets } from '@tosspayments/tosspayments-sdk'
import { CHECKOUT_ITEM_STATE, type PreviewItem } from '#shared/catalog/preview'
import {
  createPaymentId,
  formatWon,
  useCheckoutConsent,
  writePendingItem,
  writePendingPayment,
} from '~/utils/checkout-preview'

definePageMeta({ layout: 'flow', middleware: 'checkout-preview' })
useHead({ title: '결제하기' })

const PREVIEW_ITEM = useState<PreviewItem>(CHECKOUT_ITEM_STATE).value

const config = useRuntimeConfig()
const clientKey = config.public.toss.clientKey
const isConfigured = Boolean(clientKey)

// 05-B(client-shell spec F-22) — 필수 2(이용약관 · 만 14세)가 체크돼야 결제 · 선택 1(마케팅)은 결제와 무관 · 서버 저장 0(F-19).
// 항목 · 처음 값 · 필수 판정 · 결제 조건은 utils 의 useCheckoutConsent 하나 — 이 페이지는 체크 값을 읽거나 쓰지 않는다
const { items: consentItems, agreed, canPay } = useCheckoutConsent()
const isRequesting = ref(false)
const openError = ref<string | null>(null)
// 결제수단 · 약관 위젯이 둘 다 그려져야 결제 요청을 받는다 · 불러오기 실패(스크립트 차단 · 네트워크 · 잘못된 키)는 결제 수단 자리에 안내
const widgetsReady = ref(false)
const widgetLoadFailed = ref(false)
// 토스 약관 위젯의 필수 약관 동의(agreementStatusChange · agreedRequiredTerms) — 안 됐으면 버튼 비활성(디자인 리뷰 TOSSCK 1).
// 처음 값 = 동의: 위젯은 필수 약관을 체크된 채로 그리고 처음 상태를 이벤트로 알리지 않는다(2026-11-04 ⑦ walk 실측 · 상태 조회 API 없음).
// 바뀔 때만 이벤트가 온다. 콘솔 설정으로 기본 해제가 되면 요청이 SDK 오류로 거절돼 사유 줄이 뜬다
const tossTermsAgreed = ref(true)
let widgets: TossPaymentsWidgets | null = null

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

// SDK 는 클라이언트에서 페이지 진입 뒤에만 불러온다(SSR 번들 제외) — 위젯이 결제수단을 그려야 해서 클릭 전에 로드한다(D-59)
const loadWidgets = async () => {
  const { loadTossPayments, ANONYMOUS } = await import('@tosspayments/tosspayments-sdk')
  const toss = await loadTossPayments(clientKey)
  const created = toss.widgets({ customerKey: ANONYMOUS })
  await created.setAmount({ currency: 'KRW', value: PREVIEW_ITEM.amount })
  const [, agreement] = await Promise.all([
    created.renderPaymentMethods({ selector: '#payment-method', variantKey: 'DEFAULT' }),
    created.renderAgreement({ selector: '#agreement', variantKey: 'AGREEMENT' }),
  ])
  agreement.on('agreementStatusChange', (status) => {
    tossTermsAgreed.value = status.agreedRequiredTerms
  })
  widgets = created
  widgetsReady.value = true
}

// 결제창에서 뒤로 와 bfcache 로 복원되면 리디렉트 요청이 끝나지 않은 채라 로딩으로 굳는다 — 되돌린다 (spec D-21)
const onPageShow = (event: PageTransitionEvent) => {
  if (event.persisted) isRequesting.value = false
}
onMounted(() => {
  window.addEventListener('pageshow', onPageShow)
  if (isConfigured)
    loadWidgets().catch(() => {
      widgetLoadFailed.value = true
    })
})
onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow))

const onPay = async () => {
  if (
    !isConfigured ||
    !canPay.value ||
    !widgetsReady.value ||
    !tossTermsAgreed.value ||
    isRequesting.value
  )
    return
  isRequesting.value = true
  openError.value = null
  try {
    const orderId = createPaymentId(Date.now(), crypto.getRandomValues(new Uint8Array(12)))
    writePendingItem({ optionCode: PREVIEW_ITEM.optionCode, amount: PREVIEW_ITEM.amount })
    writePendingPayment(orderId)
    // 리디렉트 방식 — 결과는 success · fail 주소로 돌아온다. 고객 이름 · 이메일 · 전화는 보내지 않는다(PII 0).
    // 반환 = 페이지를 떠나는 중 — 로딩을 유지한다(다시 누르면 주문번호가 덮인다). bfcache 복귀는 pageshow 가 푼다
    await widgets!.requestPayment({
      orderId,
      orderName: PREVIEW_ITEM.orderName,
      successUrl: `${window.location.origin}/checkout-preview/success`,
      failUrl: `${window.location.origin}/checkout-preview/fail`,
    })
  } catch (error) {
    openError.value = errorText(error)
    isRequesting.value = false
  }
}

// 05-B 문구(생성물) — 스크립트 끝(위 줄 번호를 밀지 않게)
import { BEFORE_NOTICE, PRIVACY_NOTICE } from '~/utils/checkout-preview'
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

    <!-- 결제 수단 — 토스 결제위젯 renderPaymentMethods 가 제목까지 그린다(우리 제목을 달지 않는다 · 디자인 리뷰 TOSSCK 3) -->
    <section class="checkout__section" aria-label="결제 수단">
      <div id="payment-method" class="checkout__widget" />
      <p v-if="widgetLoadFailed" class="checkout__result" role="alert">
        결제창을 불러오지 못했어요. 새로고침해 주세요.
      </p>
    </section>

    <!-- 05-B 원문(client-shell spec F-22) — 필수 2 · 선택 1 · 개인정보 수집 · 이용 «안내»(체크 없음 — 계약 이행 근거) · 결제 전 안내.
         링크는 새 창(이 화면의 체크 상태를 잃지 않게) -->
    <section class="checkout__agree" aria-label="약관 동의 · 개인정보 안내">
      <div v-for="item in consentItems" :key="item.key" class="checkout__consent-item">
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

    <!-- 토스 결제위젯 renderAgreement 가 그린다(토스 약관 — 우리 05-B 동의는 위 블록) -->
    <div id="agreement" class="checkout__widget" />

    <div class="checkout__cta">
      <NButton
        variant="primary"
        size="xl"
        full-width
        :disabled="!isConfigured || !canPay || !widgetsReady || !tossTermsAgreed"
        :loading="isRequesting"
        @click="onPay"
      >
        {{ formatWon(PREVIEW_ITEM.amount) }} 결제하기
      </NButton>
      <p v-if="!isConfigured" class="checkout__note">결제 설정을 준비하고 있어요.</p>
    </div>

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

.checkout__text {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-800, #262626);
}

/* 위젯 iframe 자리 — 토스가 높이를 정한다. 프레임 폭(440px) 안에서 좌우 여백을 상쇄한다 */
.checkout__widget {
  margin: 0 -20px;
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
</style>
