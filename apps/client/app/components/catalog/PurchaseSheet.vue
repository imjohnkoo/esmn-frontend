<script setup lang="ts">
// 구매 시트(catalog spec S-5 · F-8 · Proposal K2) — 유심사 수량 시트 자리. 선택 요약 + K2 원문 + 3초 카운트다운 →
// **같은 탭** location.assign(naverUrl)(새 창은 팝업 차단). 취소 · ESC · 바깥 → 닫힘 + 중지. bfcache 복귀 시 닫힌다.
// «지금 이동» · 카운트다운 끝 → «이동하고 있어요» 로 멈추고 이동은 한 번만. 결선은 PurchaseSheet.test.ts(vue 명시 import).
import { NBottomSheet, NButton } from '@imjohnkoo/design-vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  COUNTDOWN_SECONDS,
  PURCHASE_TITLE,
  countdownText,
  purchaseBody,
} from '~/content/product-detail'
import { startCountdown, type Countdown } from '~/utils/countdown'

const props = defineProps<{
  summary: string
  price: string
  optionName: string
  naverUrl: string
}>()
const open = defineModel<boolean>({ default: false })
const remaining = ref(COUNTDOWN_SECONDS)
let timer: Countdown | undefined
let going = false

function go() {
  if (going) return // 느린 네트워크에서 «지금 이동» 을 다시 눌러도 한 번만
  going = true
  timer?.stop()
  remaining.value = 0 // «이동하고 있어요»
  window.location.assign(props.naverUrl)
}

// immediate — 열린 채로 마운트돼도 센다
watch(
  open,
  (isOpen) => {
    timer?.stop()
    timer = undefined
    going = false
    if (isOpen) timer = startCountdown(COUNTDOWN_SECONDS, (n) => (remaining.value = n), go)
  },
  { immediate: true },
)

function onPageShow(e: PageTransitionEvent) {
  if (e.persisted) open.value = false
}
// «지금 이동» 뒤 이동이 앱 전환 · 인앱 가로채기로 흡수되면 이 문서가 남는다 — 다시 보이게 되면 닫는다(S-5)
function onVisibility() {
  if (going && document.visibilityState === 'visible') open.value = false
}
onMounted(() => {
  window.addEventListener('pageshow', onPageShow)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  timer?.stop()
  window.removeEventListener('pageshow', onPageShow)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<template>
  <NBottomSheet v-model="open" :title="PURCHASE_TITLE">
    <div class="purchase">
      <div class="purchase__summary">
        <span class="purchase__label">{{ summary }}</span>
        <span class="purchase__price">{{ price }}</span>
      </div>
      <p class="purchase__body">{{ purchaseBody(optionName) }}</p>
      <p class="purchase__count" aria-live="polite">{{ countdownText(remaining) }}</p>
    </div>
    <template #footer>
      <div class="purchase__actions">
        <NButton full-width size="lg" @click="go">지금 이동</NButton>
        <NButton full-width size="lg" variant="outline" @click="open = false">취소</NButton>
      </div>
    </template>
  </NBottomSheet>
</template>

<style scoped>
.purchase {
  display: flex;
  flex-direction: column;
  gap: 12px;
  word-break: keep-all;
}

.purchase__summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--n-color-neutral-50, #fafafa);
}

.purchase__label {
  font-size: 14px;
  font-weight: 700;
  color: var(--n-color-neutral-800, #262626);
}

.purchase__price {
  font-size: 18px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
}

.purchase__body {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-700, #404040);
  text-wrap: pretty;
}

.purchase__count {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--n-color-primary-600, #5025e8);
}

.purchase__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
</style>
