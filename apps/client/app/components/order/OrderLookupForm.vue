<script setup lang="ts">
// 주문번호 조회 폼 (홈 카드 · /my-esim 공용 · spec F-9).
// 유효한 번호는 발급 호스트(runtimeConfig.public.guestAppOrigin)의 /verify/{주문번호} 로 «전체 이동» 한다 — SPA 이동 아님(K3).
// 루프백 주소에서 열린 페이지면 자기 출처로 보낸다(resolveGuestOrigin — 프리렌더가 굳힌 실호스트로 새지 않게).
import { NButton, NInput } from '@imjohnkoo/design-vue'
// 컴포넌트 테스트(OrderLookupForm.test.ts)가 Nuxt 없이 그린다 — vue 는 명시 import · Nuxt 함수는 테스트가 끼운다
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  ORDER_LOOKUP_MESSAGES,
  buildGuestVerifyUrl,
  resolveGuestOrigin,
  validateOrderNumber,
} from '~/utils/order-lookup'

const props = withDefaults(defineProps<{ inputId: string; submitLabel?: string }>(), {
  submitLabel: '내 eSIM 찾기',
})

const config = useRuntimeConfig()
const value = ref('')
const error = ref<string | null>(null)
const isNavigating = ref(false)

const errorId = computed(() => `${props.inputId}-error`)

const onSubmit = async () => {
  const result = validateOrderNumber(value.value)
  if (!result.ok) {
    error.value = ORDER_LOOKUP_MESSAGES[result.error]
    return
  }
  error.value = null
  isNavigating.value = true
  // 프리렌더 페이지에는 빌드 때 설정값이 굳는다 — 루프백에서 열린 페이지면 자기 출처로(catalog D-17)
  const origin = resolveGuestOrigin(config.public.guestAppOrigin, window.location.origin)
  await navigateTo(buildGuestVerifyUrl(origin, result.orderId), { external: true })
}

// 입력이 바뀌면 오류 · 로딩을 푼다 — 이동이 취소되거나(중지 · 인앱 가로채기) 문서가 남은 경우에도 버튼이 굳지 않게 (D-21)
watch(value, () => {
  if (error.value) error.value = null
  isNavigating.value = false
})

// 외부 이동 뒤 뒤로가기로 bfcache 에서 복원되면 JS 상태가 그대로 살아난다 — 로딩(=비활성)으로 굳지 않게 되돌린다 (spec D-21)
const onPageShow = (event: PageTransitionEvent) => {
  if (event.persisted) isNavigating.value = false
}
onMounted(() => window.addEventListener('pageshow', onPageShow))
onBeforeUnmount(() => window.removeEventListener('pageshow', onPageShow))
</script>

<template>
  <form class="order-lookup" novalidate @submit.prevent="onSubmit">
    <label :for="inputId" class="order-lookup__label">주문번호</label>
    <NInput
      :id="inputId"
      v-model="value"
      variant="box"
      size="lg"
      placeholder="주문번호 숫자를 입력해 주세요"
      inputmode="numeric"
      autocomplete="off"
      :error="!!error"
      :aria-describedby="error ? errorId : undefined"
    />
    <p v-if="error" :id="errorId" class="order-lookup__error" role="alert">{{ error }}</p>
    <div class="order-lookup__cta">
      <NButton type="submit" variant="primary" size="lg" full-width :loading="isNavigating">
        {{ submitLabel }}
      </NButton>
    </div>
  </form>
</template>

<style scoped>
.order-lookup {
  display: flex;
  flex-direction: column;
}

.order-lookup__label {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--n-color-neutral-700, #404040);
}

.order-lookup__error {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--n-color-error-600, #dc2626);
}

.order-lookup__cta {
  margin-top: 12px;
}
</style>
