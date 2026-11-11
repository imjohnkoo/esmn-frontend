<script setup lang="ts">
// 회원 화면 공용 틀(member-client-auth ⑤ · 디자인 리뷰 R1 — flow 레이아웃 안: 뒤로 버튼 · 머리 · 본문 · 아래 붙은 버튼)
import { NPageHeading, NStepProgress } from '@imjohnkoo/design-vue'

defineProps<{
  eyebrow?: string
  title: string
  description?: string
  step?: number
  total?: number
  stepLabel?: string
}>()
const emit = defineEmits<{ back: [] }>()
</script>

<template>
  <div class="member-shell">
    <div class="member-shell__top">
      <button type="button" class="member-shell__back" aria-label="뒤로" @click="emit('back')">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <NStepProgress
        v-if="step"
        :step="step"
        :total="total ?? 3"
        :label="stepLabel"
        class="member-shell__progress"
      />
    </div>
    <div class="member-shell__heading">
      <NPageHeading :eyebrow="eyebrow" :title="title" :description="description" />
    </div>
    <div class="member-shell__body">
      <slot />
    </div>
    <div v-if="$slots.cta" class="member-shell__cta">
      <slot name="cta" />
    </div>
  </div>
</template>

<style scoped>
.member-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 12px 24px 16px;
  background: #ffffff;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.member-shell__top {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}

.member-shell__back {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  margin-left: -10px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--n-color-neutral-800, #262626);
  cursor: pointer;
}

.member-shell__back:focus-visible {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
}

.member-shell__progress {
  flex: 1;
}

.member-shell__heading {
  margin-top: 16px;
}

.member-shell__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20px;
  margin-top: 28px;
}

.member-shell__cta {
  position: sticky;
  bottom: 0;
  padding: 16px 0 8px;
  background: #ffffff;
}
</style>

<style>
/* 회원 화면 공용 글자 — 이 틀을 쓰는 화면(login · signup · password · withdraw)이 같이 쓴다(전역 · member- 접두 · 틀과 함께 실린다) */
.member-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.member-err {
  margin: 6px 0 0;
  color: var(--n-color-error-600, #dc2626);
  font-size: 13px;
  line-height: 1.5;
}

.member-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 16px;
  font-size: 14px;
}

.member-links a {
  color: var(--n-color-neutral-600, #525252);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.member-notice {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--n-color-primary-50, #f1edff);
  color: var(--n-color-neutral-800, #262626);
  font-size: 14px;
  line-height: 1.6;
}
</style>
