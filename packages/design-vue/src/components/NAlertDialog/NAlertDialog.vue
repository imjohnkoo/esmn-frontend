<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <Transition name="n-alert-dialog-backdrop">
        <DialogOverlay v-if="open" class="n-alert-dialog__overlay" />
      </Transition>
      <Transition name="n-alert-dialog-content">
        <DialogContent
          v-if="open"
          :class="['n-alert-dialog__content', { 'n-alert-dialog__content--wide': size === 'wide' }]"
        >
          <DialogClose v-if="closable" class="n-alert-dialog__close" aria-label="Close">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <line x1="4" y1="4" x2="12" y2="12" />
              <line x1="12" y1="4" x2="4" y2="12" />
            </svg>
          </DialogClose>
          <div class="n-alert-dialog__body">
            <div v-if="$slots.icon" class="n-alert-dialog__icon">
              <slot name="icon" />
            </div>
            <div
              :class="['n-alert-dialog__icon-default', `n-alert-dialog__icon-default--${color}`]"
              v-else-if="!$slots.icon"
            >
              <svg
                v-if="color === 'error' || color === 'warning'"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <svg
                v-else-if="color === 'success'"
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="9 12 11.5 14.5 16 10" />
              </svg>
              <svg
                v-else
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            <DialogTitle v-if="title" class="n-alert-dialog__title">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="n-alert-dialog__description">{{
              description
            }}</DialogDescription>
            <slot />
          </div>
          <div v-if="$slots.actions" class="n-alert-dialog__actions">
            <slot name="actions" />
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
  DialogClose,
} from 'reka-ui'
import type { NColor } from '../../types/common'

export interface NAlertDialogProps {
  title?: string
  description?: string
  color?: NColor
  closable?: boolean
  modelValue?: boolean
  /** 폭 — 토큰 `dialog.width` 변형. default 280 · wide 340(요약 표 · 필수 동의 체크처럼 내용이 많은 확인만) */
  size?: 'default' | 'wide'
}

withDefaults(defineProps<NAlertDialogProps>(), {
  title: undefined,
  description: undefined,
  color: 'info',
  closable: true,
  modelValue: undefined,
  size: 'default',
})

defineEmits<{
  'update:modelValue': [value: boolean]
}>()

const open = defineModel<boolean>({ default: false })
</script>

<style>
.n-alert-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--n-z-index-modal-backdrop, 1040);
  background-color: rgba(17, 17, 17, 0.32);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.n-alert-dialog__content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: var(--n-z-index-modal, 1050);
  width: min(var(--n-dialog-viewport-ratio, 90vw), var(--n-dialog-width-default, 17.5rem));
  border-radius: var(--n-radius-3xl, 1.5rem);
  background-color: var(--n-color-neutral-0, #ffffff);
  box-shadow: var(--n-shadow-modal, 0 30px 60px -20px rgba(17, 17, 17, 0.25));
  font-family: var(--n-font-family-sans, 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', 'Noto Sans KR', sans-serif);
  overflow: hidden;
}

.n-alert-dialog__content--wide {
  width: min(var(--n-dialog-viewport-ratio, 90vw), var(--n-dialog-width-wide, 21.25rem));
}

.n-alert-dialog__content:focus {
  outline: none;
}

.n-alert-dialog__close {
  position: absolute;
  top: var(--n-spacing-3, 0.75rem);
  right: var(--n-spacing-3, 0.75rem);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: var(--n-radius-sm, 0.25rem);
  background: transparent;
  color: var(--n-color-neutral-400, #a3a3a3);
  cursor: pointer;
  transition: background-color var(--n-transition-fast, 150ms ease);
}
.n-alert-dialog__close:hover {
  background-color: var(--n-color-neutral-100, #f5f5f5);
  color: var(--n-color-neutral-700, #404040);
}

.n-alert-dialog__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 14px;
  /* 상단 여백 = actions 하단 여백 (36px) — 상하 대칭 리듬 */
  padding: 36px 24px 8px;
}

/* actions 슬롯이 없으면 body 가 마지막 요소 — 하단도 36px 로 대칭 유지 */
.n-alert-dialog__body:last-child {
  padding-bottom: 36px;
}

.n-alert-dialog__icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.n-alert-dialog__icon-default {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: var(--n-radius-full, 9999px);
}

.n-alert-dialog__icon-default--error {
  background-color: var(--n-color-error-50, #fef2f2);
  color: var(--n-color-error-500, #ef4444);
}
.n-alert-dialog__icon-default--warning {
  background-color: var(--n-color-warning-50, #fffbeb);
  color: var(--n-color-warning-500, #f59e0b);
}
.n-alert-dialog__icon-default--success {
  background-color: var(--n-color-success-50, #f0fdf4);
  color: var(--n-color-success-500, #22c55e);
}
.n-alert-dialog__icon-default--info {
  background-color: var(--n-color-info-50, #f0f9ff);
  color: var(--n-color-info-500, #0ea5e9);
}
.n-alert-dialog__icon-default--primary {
  background-color: var(--n-color-primary-50, #f1edff);
  color: var(--n-color-primary-500, #6239ff);
}
.n-alert-dialog__icon-default--neutral {
  background-color: var(--n-color-neutral-100, #f5f5f5);
  color: var(--n-color-neutral-500, #737373);
}

.n-alert-dialog__title {
  margin: 0;
  font-size: 17px;
  font-weight: var(--n-font-weight-bold, 700);
  color: var(--n-color-neutral-900, #171717);
  line-height: 1.4;
  word-break: keep-all;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.n-alert-dialog__description {
  margin-top: -6px;
  font-size: 13px;
  color: var(--n-color-neutral-500, #737373);
  line-height: 1.55;
  word-break: keep-all;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.n-alert-dialog__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 24px 36px;
}

.n-alert-dialog__actions > * {
  width: 100%;
}

/* Transitions */
.n-alert-dialog-backdrop-enter-active,
.n-alert-dialog-backdrop-leave-active {
  transition: opacity 200ms ease;
}
.n-alert-dialog-backdrop-enter-from,
.n-alert-dialog-backdrop-leave-to {
  opacity: 0;
}

.n-alert-dialog-content-enter-active,
.n-alert-dialog-content-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}
.n-alert-dialog-content-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}
.n-alert-dialog-content-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}
.n-alert-dialog-content-enter-to,
.n-alert-dialog-content-leave-from {
  opacity: 1;
  transform: translate(-50%, -50%) scale(1);
}
</style>
