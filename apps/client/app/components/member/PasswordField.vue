<script setup lang="ts">
// 비밀번호 한 칸 + «보기»(확인 칸 없음 — 패킷 판단 근거 3 · aria-pressed)
import { NInput } from '@imjohnkoo/design-vue'

const model = defineModel<string>({ default: '' })
defineProps<{
  label?: string
  autocomplete: 'current-password' | 'new-password'
  error?: string
  hint?: string
  inputId: string
  maxlength?: number
}>()
const shown = ref(false)
</script>

<template>
  <div class="password-field">
    <div class="password-field__row">
      <NInput
        :id="inputId"
        v-model="model"
        variant="underline"
        :label="label ?? '비밀번호'"
        :type="shown ? 'text' : 'password'"
        :autocomplete="autocomplete"
        :maxlength="maxlength"
        :error="!!error"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error || hint ? `${inputId}-desc` : undefined"
        class="password-field__input"
      />
      <button
        type="button"
        class="password-field__toggle"
        :aria-pressed="shown"
        @click="shown = !shown"
      >
        {{ shown ? '숨기기' : '보기' }}
      </button>
    </div>
    <p
      v-if="error || hint"
      :id="`${inputId}-desc`"
      :class="error ? 'password-field__err' : 'password-field__hint'"
    >
      {{ error || hint }}
    </p>
  </div>
</template>

<style scoped>
.password-field__row {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.password-field__input {
  flex: 1;
}

.password-field__toggle {
  flex-shrink: 0;
  padding: 8px 4px;
  border: 0;
  background: none;
  color: var(--n-color-primary-600, #5025e8);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.password-field__err,
.password-field__hint {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.password-field__err {
  color: var(--n-color-error-600, #dc2626);
}

.password-field__hint {
  color: var(--n-color-neutral-500, #737373);
}
</style>
