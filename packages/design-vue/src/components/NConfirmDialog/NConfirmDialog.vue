<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <Transition name="n-confirm-backdrop">
        <DialogOverlay v-if="open" class="n-confirm__overlay" />
      </Transition>
      <Transition name="n-confirm-content">
        <DialogContent
          v-if="open"
          :class="['n-confirm__content', { 'n-confirm__content--wide': size === 'wide' }]"
        >
          <div class="n-confirm__body">
            <div :class="['n-confirm__icon', `n-confirm__icon--${variant}`]">
              <svg v-if="variant === 'danger'" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <DialogTitle class="n-confirm__title">{{ title }}</DialogTitle>
            <DialogDescription v-if="message" class="n-confirm__message">{{ message }}</DialogDescription>
            <slot />
          </div>
          <div class="n-confirm__actions">
            <button class="n-confirm__btn n-confirm__btn--cancel" @click="handleCancel">
              {{ cancelText }}
            </button>
            <button :class="['n-confirm__btn', `n-confirm__btn--${variant}`]" @click="handleConfirm">
              {{ confirmText }}
            </button>
          </div>
        </DialogContent>
      </Transition>
    </DialogPortal>
  </DialogRoot>
</template>

<script setup lang="ts">
import {
  DialogRoot,
  DialogPortal,
  DialogOverlay,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from 'reka-ui'

export interface NConfirmDialogProps {
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'danger'
  modelValue?: boolean
  /** 폭 — 토큰 `dialog.width` 변형(NAlertDialog 와 같다). default 280 · wide 340 */
  size?: 'default' | 'wide'
}

withDefaults(defineProps<NConfirmDialogProps>(), {
  title: '확인',
  message: undefined,
  confirmText: '확인',
  cancelText: '취소',
  variant: 'default',
  modelValue: undefined,
  size: 'default',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  confirm: []
  cancel: []
}>()

const open = defineModel<boolean>({ default: false })

function handleConfirm() {
  emit('confirm')
  open.value = false
}

function handleCancel() {
  emit('cancel')
  open.value = false
}
</script>

<style>
.n-confirm__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--n-z-index-modal-backdrop, 1040);
  background-color: rgb(0 0 0 / 0.5);
}

.n-confirm__content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: var(--n-z-index-modal, 1050);
  /* NAlertDialog 와 동일 사이즈·리듬 (john 피드백 2026-08-20) */
  width: min(var(--n-dialog-viewport-ratio, 90vw), var(--n-dialog-width-default, 17.5rem));
  border-radius: var(--n-radius-3xl, 1.5rem);
  background-color: var(--n-color-neutral-0, #ffffff);
  box-shadow: var(--n-shadow-xl, 0 20px 25px -5px rgba(0, 0, 0, 0.1));
  font-family: var(--n-font-family-sans, 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', 'Noto Sans KR', sans-serif);
  overflow: hidden;
}

.n-confirm__content--wide {
  width: min(var(--n-dialog-viewport-ratio, 90vw), var(--n-dialog-width-wide, 21.25rem));
}

.n-confirm__content:focus { outline: none; }

.n-confirm__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  /* 상단 36px — NAlertDialog 와 동일한 상하 대칭 리듬 */
  padding: 36px var(--n-spacing-6, 1.5rem) 8px;
}

.n-confirm__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--n-radius-full, 9999px);
  margin-bottom: var(--n-spacing-4, 1rem);
}

.n-confirm__icon--default {
  background-color: var(--n-color-primary-50, #f1edff);
  color: var(--n-color-primary-500, #6239FF);
}

.n-confirm__icon--danger {
  background-color: var(--n-color-error-50, #fef2f2);
  color: var(--n-color-error-500, #ef4444);
}

.n-confirm__title {
  margin: 0;
  font-size: var(--n-font-size-lg, 1.125rem);
  font-weight: var(--n-font-weight-semibold, 600);
  color: var(--n-color-neutral-900, #171717);
  line-height: 1.4;
  word-break: keep-all;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.n-confirm__message {
  margin-top: var(--n-spacing-2, 0.5rem);
  font-size: var(--n-font-size-sm, 0.875rem);
  color: var(--n-color-neutral-500, #737373);
  line-height: 1.5;
  word-break: keep-all;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.n-confirm__actions {
  display: flex;
  gap: var(--n-spacing-3, 0.75rem);
  padding: 14px var(--n-spacing-6, 1.5rem) 36px;
  justify-content: center;
}

.n-confirm__btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--n-spacing-2, 0.5rem) var(--n-spacing-4, 1rem);
  border-radius: var(--n-radius-md, 0.375rem);
  font-family: var(--n-font-family-sans, 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', 'Noto Sans KR', sans-serif);
  font-size: var(--n-font-size-sm, 0.875rem);
  font-weight: var(--n-font-weight-medium, 500);
  cursor: pointer;
  transition: all var(--n-transition-fast, 150ms ease);
  border: var(--n-border-width-1, 1px) solid transparent;
  outline: none;
}

.n-confirm__btn:focus-visible {
  box-shadow: 0 0 0 2px var(--n-color-primary-200, #c7b6ff);
}

.n-confirm__btn--cancel {
  background-color: var(--n-color-neutral-100, #f5f5f5);
  color: var(--n-color-neutral-700, #404040);
  border-color: var(--n-color-neutral-200, #e5e5e5);
}
.n-confirm__btn--cancel:hover {
  background-color: var(--n-color-neutral-200, #e5e5e5);
}

.n-confirm__btn--default {
  background-color: var(--n-color-primary-600, #5025e8);
  color: var(--n-color-neutral-0, #ffffff);
}
.n-confirm__btn--default:hover {
  background-color: var(--n-color-primary-700, #3f1cc0);
}

.n-confirm__btn--danger {
  background-color: var(--n-color-error-500, #ef4444);
  color: var(--n-color-neutral-0, #ffffff);
}
.n-confirm__btn--danger:hover {
  background-color: var(--n-color-error-700, #b91c1c);
}

/* Transitions */
.n-confirm-backdrop-enter-active,
.n-confirm-backdrop-leave-active { transition: opacity 200ms ease; }
.n-confirm-backdrop-enter-from,
.n-confirm-backdrop-leave-to { opacity: 0; }

.n-confirm-content-enter-active,
.n-confirm-content-leave-active { transition: opacity 200ms ease, transform 200ms ease; }
.n-confirm-content-enter-from { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
.n-confirm-content-leave-to { opacity: 0; transform: translate(-50%, -50%) scale(0.95); }
.n-confirm-content-enter-to,
.n-confirm-content-leave-from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
</style>
