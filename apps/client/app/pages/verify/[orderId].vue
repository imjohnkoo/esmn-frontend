<script setup lang="ts">
import {
  NStepProgress,
  NPageHeading,
  NInfoChip,
  NInput,
  NTrustNote,
  NButton,
  NAlertDialog,
  NLoaderDialog,
} from '@imjohnkoo/design-vue'
import { useOrderStore } from '~/stores/order'
import { useApi } from '~/composables/useApi'
import { useFlowSession } from '~/composables/useFlowSession'
import { formatPhoneNumber, isValidPhoneNumber } from '~/utils/formatter'

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const api = useApi()
const flowSession = useFlowSession()

const orderId = computed(() => Number(route.params.orderId))

// order-flow 미들웨어가 복원에 실패해 돌려보낸 경우 (쿠키 없음 · 만료 · 다른 주문)
const isReverify = computed(() => route.query.reason === 'reverify')

const fullName = ref('')
const phoneNumber = ref('')
const errors = ref<{ fullName?: string; phoneNumber?: string }>({})

const isSubmitting = ref(false)
const isAlertVisible = ref(false)
const isCancelledOrderVisible = ref(false)
const isServerErrorVisible = ref(false)

watch(phoneNumber, (val) => {
  const formatted = formatPhoneNumber(val)
  if (formatted !== val) phoneNumber.value = formatted
})

const validate = () => {
  errors.value = {}
  if (!fullName.value.trim()) errors.value.fullName = '이름을 입력해주세요.'
  if (!phoneNumber.value) {
    errors.value.phoneNumber = '전화번호를 입력해주세요.'
  } else if (!isValidPhoneNumber(phoneNumber.value)) {
    errors.value.phoneNumber = '유효하지 않은 전화번호 형식입니다.'
  }
  return Object.keys(errors.value).length === 0
}

const onSubmit = async () => {
  if (!validate()) return
  isSubmitting.value = true
  await new Promise((resolve) => setTimeout(resolve, 1200))
  try {
    // 보낸 body 를 그대로 쿠키에 쓴다 — 요청 중 입력칸이 바뀌어도 검증받지 않은 값이 들어가지 않게 (spec F-15)
    const credentials = {
      fullName: fullName.value,
      phoneNumber: phoneNumber.value,
      orderId: orderId.value,
    }
    const response = await api.verifyOrder(credentials)
    const { verified, cancelled, details } = response
    if (verified && !cancelled) {
      orderStore.setOrders(details || [])
      // 새로고침 · 탭 복원 뒤 이어가기용 — 입력해 통과한 값만 1시간 (K8)
      flowSession.start(credentials)
      router.push(`/details/${orderId.value}`)
    } else if (verified && cancelled) {
      isCancelledOrderVisible.value = true
    } else {
      isAlertVisible.value = true
    }
  } catch (error) {
    console.error(error)
    isServerErrorVisible.value = true
  } finally {
    isSubmitting.value = false
  }
}
// 게스트 발급 4-step 은 헤더 · 하단 탭 없는 flow 레이아웃 (spec D-2) · 가드는 order-flow 미들웨어 (K8)
definePageMeta({ layout: 'flow', middleware: 'order-flow' })

// 개인정보처리방침 · 이용약관 하단 시트(spec D-46 · John 2026-10-03) — 새 탭 대신(입력한 이름 · 전화를 잃지 않는다)
import type { DocSheetKey } from '~/components/legal/DocSheet.vue'
// 시트(법정 문서 3종 + 지원 기기 본문)는 첫 화면 묶음에서 뺀다 — 화면이 빨리 준비돼 링크가 시트로 열린다
const DocSheet = defineAsyncComponent(() => import('~/components/legal/DocSheet.vue'))

const legalSheet = ref<DocSheetKey | null>(null)
</script>

<template>
  <div class="verify-page">
    <div class="verify-page__top">
      <NStepProgress :step="1" :total="4" label="본인 확인" />
    </div>

    <div class="verify-page__heading">
      <NPageHeading
        eyebrow="eSIM QR 코드 발급"
        :title="`주문하신 분이\n맞는지 확인할게요`"
        :description="`주문 시 입력하신 이름과 전화번호를\n그대로 입력해 주세요.`"
      />
    </div>

    <div class="verify-page__chip">
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

    <p v-if="isReverify" class="verify-page__reverify" role="status">
      이어서 보려면 본인 확인을 다시 해 주세요.
    </p>

    <form class="verify-page__form" @submit.prevent="onSubmit">
      <div class="verify-page__field">
        <NInput v-model="fullName" variant="underline" label="이름" :error="!!errors.fullName" />
        <p v-if="errors.fullName" class="verify-page__err">{{ errors.fullName }}</p>
      </div>

      <div class="verify-page__field">
        <NInput
          v-model="phoneNumber"
          variant="underline"
          label="전화번호"
          type="tel"
          :error="!!errors.phoneNumber"
        />
        <p v-if="errors.phoneNumber" class="verify-page__err">{{ errors.phoneNumber }}</p>
      </div>

      <div class="verify-page__note">
        <NTrustNote>
          본인 확인은 주문자와 동일한지 검증하기 위한 용도예요.<br />
          입력한 정보는 안전하게 처리되며, 발급 외 다른 목적으로 사용하지 않아요.
        </NTrustNote>
      </div>

      <!-- 법정 링크(client-shell spec F-20 · 개인정보 보호법 30조) — 방침은 굵게 · 색으로 구분. 입력을 잃지 않게 하단 시트로(D-46) — 화면 준비(하이드레이션) 전 · 보조키 클릭은 target 으로 새 탭 -->
      <p class="verify-page__policy">
        <a
          class="verify-page__policy-link verify-page__policy-link--privacy"
          href="/privacy"
          target="_blank"
          rel="noopener"
          aria-haspopup="dialog"
          @click.exact.prevent="legalSheet = 'privacy'"
          >개인정보처리방침</a
        >
        <span class="verify-page__policy-sep" aria-hidden="true">·</span>
        <a
          class="verify-page__policy-link"
          href="/terms"
          target="_blank"
          rel="noopener"
          aria-haspopup="dialog"
          @click.exact.prevent="legalSheet = 'terms'"
          >이용약관</a
        >
      </p>
      <DocSheet v-model="legalSheet" />

      <div class="verify-page__cta">
        <NButton type="submit" variant="primary" size="xl" full-width :disabled="isSubmitting">
          주문 확인하기
        </NButton>
      </div>
    </form>

    <NLoaderDialog
      v-model="isSubmitting"
      title="주문을 확인하고 있어요"
      description="잠시만 기다려주세요…"
    />

    <NAlertDialog
      v-model="isAlertVisible"
      title="주문번호와 일치하지 않아요"
      color="warning"
      :closable="false"
    >
      <p class="verify-page__dialog-desc">
        주문 시 입력하신 이름과 전화번호를<br />다시 한 번 확인해 주세요.
      </p>
      <template #actions>
        <NButton variant="primary" full-width @click="isAlertVisible = false">
          다시 입력하기
        </NButton>
      </template>
    </NAlertDialog>

    <NAlertDialog
      v-model="isCancelledOrderVisible"
      title="이미 취소된 주문이에요"
      color="warning"
      :closable="false"
    >
      <p class="verify-page__dialog-desc">
        취소된 주문은 발급할 수 없어요.<br />
        스마트스토어에서 새로 주문해 주세요.
      </p>
      <template #actions>
        <NButton variant="primary" full-width @click="isCancelledOrderVisible = false">
          확인
        </NButton>
      </template>
    </NAlertDialog>

    <NAlertDialog
      v-model="isServerErrorVisible"
      title="잠시 후 다시 시도해 주세요"
      color="error"
      :closable="false"
    >
      <p class="verify-page__dialog-desc">
        서버에 일시적인 문제가 발생했어요.<br />
        잠시 후 다시 시도해 주세요.
      </p>
      <template #actions>
        <NButton variant="primary" full-width @click="isServerErrorVisible = false"> 확인 </NButton>
      </template>
    </NAlertDialog>
  </div>
</template>

<style scoped>
.verify-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 20px 24px 32px;
  background: #ffffff;
}

.verify-page__top {
  padding-top: 4px;
}

.verify-page__heading {
  margin-top: 28px;
}

.verify-page__chip {
  margin-top: 18px;
}

.verify-page__reverify {
  margin: 18px 0 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--n-color-primary-50, #f1edff);
  font-size: 13px;
  line-height: 1.55;
  color: var(--n-color-primary-800, #2f1499);
  word-break: keep-all;
}

.verify-page__form {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.verify-page__field {
  margin-top: 12px;
}

.verify-page__field:first-of-type {
  margin-top: 0;
}

.verify-page__err {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--n-color-error-500, #ef4444);
}

.verify-page__note {
  margin-top: 28px;
}

.verify-page__policy {
  display: flex;
  /* 크게 확대해 두 링크가 한 줄에 안 들어가면 다음 줄로(넘쳐 «개인정보처리방침» 앞 글자가 가려지지 않게) */
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 14px 0 0;
  color: var(--n-color-neutral-500, #737373);
  font-size: 13px;
}

.verify-page__policy-link {
  /* 글자 확대에서도 «이용약/관» 처럼 갈리지 않게 */
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 2px;
  color: var(--n-color-neutral-600, #525252);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.verify-page__policy-link--privacy {
  color: var(--n-color-primary-600, #5025e8);
  font-weight: 700;
}

.verify-page__cta {
  margin-top: auto;
  padding-top: 32px;
}

.verify-page__dialog-desc {
  margin: -6px 0 0;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
  line-height: 1.55;
}
</style>
