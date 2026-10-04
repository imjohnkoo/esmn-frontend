<script setup lang="ts">
// 사용 기간 드롭다운(catalog spec D-3) — 네이티브 <select>(키보드 · 스크린리더 · 모바일 선택기). 종량제는 30일 잠금.
import { ChevronDownIcon } from '@heroicons/vue/24/outline'

defineProps<{ id: string; days: number[]; disabled?: boolean }>()
const model = defineModel<number>({ required: true })
</script>

<template>
  <div class="period-select" :class="{ 'period-select--off': disabled }">
    <select :id="id" v-model.number="model" class="period-select__input" :disabled="disabled">
      <option v-for="d in days" :key="d" :value="d">{{ d }}일</option>
    </select>
    <span v-if="disabled" class="period-select__fixed">고정</span>
    <ChevronDownIcon v-else class="period-select__icon" aria-hidden="true" />
  </div>
</template>

<style scoped>
.period-select {
  position: relative;
  display: flex;
  align-items: center;
}

.period-select__input {
  width: 100%;
  height: 52px;
  padding: 0 44px 0 14px;
  border: 1px solid var(--n-color-neutral-300, #d4d4d4);
  border-radius: 12px;
  background: var(--n-color-neutral-0, #fff);
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  color: var(--n-color-neutral-900, #171717);
  appearance: none;
  cursor: pointer;
}

.period-select__input:focus-visible {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
  outline-offset: 2px;
}

.period-select--off .period-select__input {
  background: var(--n-color-neutral-50, #fafafa);
  color: var(--n-color-neutral-600, #525252);
  cursor: default;
}

.period-select__icon {
  position: absolute;
  right: 14px;
  width: 20px;
  height: 20px;
  color: var(--n-color-neutral-600, #525252);
  pointer-events: none;
}

.period-select__fixed {
  position: absolute;
  right: 14px;
  font-size: 13px;
  color: var(--n-color-neutral-500, #737373);
  pointer-events: none;
}
</style>
