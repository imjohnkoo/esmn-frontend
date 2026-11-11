<script setup lang="ts">
import { PinInputRoot, PinInputInput } from 'reka-ui'

export interface NPinInputProps {
  modelValue?: string[]
  length?: number
  type?: 'text' | 'number'
  disabled?: boolean
  placeholder?: string
  /** 오류 상태 — 묶음(role=group)에 aria-invalid="true" */
  invalid?: boolean
  /** 칸 이름 — position 은 1부터. 기본 «코드 6자리 중 1번째» */
  fieldLabel?: (position: number, length: number) => string
}

withDefaults(defineProps<NPinInputProps>(), {
  modelValue: () => [],
  length: 4,
  type: 'text',
  disabled: false,
  placeholder: '○',
  invalid: false,
  fieldLabel: (position: number, length: number) => `코드 ${length}자리 중 ${position}번째`,
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
  'complete': [value: string[]]
}>()

function handleUpdate(value: string[]) {
  emit('update:modelValue', value)
}

function handleComplete(value: string[]) {
  emit('complete', value)
}
</script>

<template>
  <PinInputRoot
    :model-value="modelValue"
    :disabled="disabled"
    :type="type"
    :placeholder="placeholder"
    role="group"
    aria-label="코드 입력"
    :aria-invalid="invalid ? 'true' : undefined"
    :style="{ '--n-pin-input-length': length }"
    :class="[
      'n-pin-input',
      { 'n-pin-input--disabled': disabled },
    ]"
    @update:model-value="handleUpdate"
    @complete="handleComplete"
  >
    <PinInputInput
      v-for="(_, index) in length"
      :key="index"
      :index="index"
      :aria-label="fieldLabel(index + 1, length)"
      class="n-pin-input__field"
    />
  </PinInputRoot>
</template>

<style scoped>
.n-pin-input {
  /* 넓은 화면은 칸 48px, 좁은 화면(320px 폰)에서만 칸이 36px 까지 줄어든다 */
  display: flex;
  width: 100%;
  max-width: calc(
    var(--n-pin-input-length) * 48px + (var(--n-pin-input-length) - 1) * var(--n-spacing-2)
  );
  gap: var(--n-spacing-2);
}

.n-pin-input--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.n-pin-input__field {
  flex: 1 1 0;
  min-width: 36px;
  max-width: 48px;
  aspect-ratio: 1;
  box-sizing: border-box;
  padding: 0;
  text-align: center;
  font-family: var(--n-font-family-sans);
  font-size: var(--n-font-size-lg);
  font-weight: var(--n-font-weight-semibold);
  color: var(--n-color-neutral-800);
  background-color: var(--n-color-neutral-0);
  border: var(--n-border-width-1) solid var(--n-color-neutral-300);
  border-radius: var(--n-radius-md);
  transition: border-color var(--n-transition-fast), box-shadow var(--n-transition-fast);
  outline: none;
}

.n-pin-input__field::placeholder {
  color: var(--n-color-neutral-300);
}

.n-pin-input__field:focus {
  border-color: var(--n-color-primary-500);
  box-shadow: 0 0 0 2px var(--n-color-primary-50);
}

.n-pin-input__field[data-disabled] {
  background-color: var(--n-color-neutral-50);
  cursor: not-allowed;
}
</style>
