<script setup lang="ts">
import { computed } from 'vue'
import { CheckboxRoot, CheckboxIndicator } from 'reka-ui'

export interface NCheckboxProps {
  modelValue?: boolean
  label?: string
  disabled?: boolean
  indeterminate?: boolean
}

const props = withDefaults(defineProps<NCheckboxProps>(), {
  modelValue: false,
  disabled: false,
  indeterminate: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const checkedState = computed(() => {
  if (props.indeterminate) return 'indeterminate'
  return props.modelValue
})

function handleUpdate(value: boolean | 'indeterminate') {
  if (value === 'indeterminate') {
    emit('update:modelValue', true)
  } else {
    emit('update:modelValue', value)
  }
}
</script>

<template>
  <label
    :class="[
      'n-checkbox',
      { 'n-checkbox--disabled': disabled },
    ]"
  >
    <!-- reka-ui v2: CheckboxRoot 는 checked 가 아닌 modelValue API 사용 -->
    <CheckboxRoot
      :model-value="checkedState"
      :disabled="disabled"
      class="n-checkbox__control"
      @update:model-value="handleUpdate"
    >
      <CheckboxIndicator class="n-checkbox__indicator">
        <svg
          v-if="!indeterminate"
          class="n-checkbox__check-icon"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2.5 6L5 8.5L9.5 3.5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <svg
          v-else
          class="n-checkbox__check-icon"
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2.5 6H9.5"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </CheckboxIndicator>
    </CheckboxRoot>
    <!-- 문구 — 기본 slot(링크 등 꾸민 문구) · 없으면 label 글자. slot 안 링크를 눌러도 체크는 바뀌지 않는다(label 안 대화형 요소) -->
    <span v-if="$slots.default || label" class="n-checkbox__label"><slot>{{ label }}</slot></span>
  </label>
</template>

<style scoped>
.n-checkbox {
  display: inline-flex;
  align-items: center;
  gap: var(--n-spacing-2);
  cursor: pointer;
  user-select: none;
}

.n-checkbox--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.n-checkbox__control {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: var(--n-border-width-2) solid var(--n-color-neutral-300);
  border-radius: var(--n-radius-sm);
  background-color: var(--n-color-neutral-0);
  transition: all var(--n-transition-fast);
  flex-shrink: 0;
  cursor: inherit;
}

.n-checkbox__control:hover:not([data-disabled]) {
  border-color: var(--n-color-primary-500);
}

.n-checkbox__control:focus-visible {
  outline: 2px solid var(--n-color-primary-500);
  outline-offset: 2px;
}

.n-checkbox__control[data-state='checked'],
.n-checkbox__control[data-state='indeterminate'] {
  background-color: var(--n-color-primary-500);
  border-color: var(--n-color-primary-500);
}

.n-checkbox__indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--n-color-neutral-0);
}

.n-checkbox__check-icon {
  display: block;
}

.n-checkbox__label {
  font-family: var(--n-font-family-sans);
  font-size: var(--n-font-size-sm);
  font-weight: var(--n-font-weight-normal);
  color: var(--n-color-neutral-800);
  line-height: 1.4;
}
</style>
