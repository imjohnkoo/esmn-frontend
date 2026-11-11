<template>
  <DialogRoot v-model:open="open">
    <DialogPortal>
      <Transition name="n-loader-dialog-backdrop">
        <DialogOverlay v-if="open" class="n-loader-dialog__overlay" />
      </Transition>
      <Transition name="n-loader-dialog-content">
        <DialogContent v-if="open" class="n-loader-dialog__content">
          <div class="n-loader-dialog__spinner" aria-hidden="true" />
          <div v-if="title || description" class="n-loader-dialog__text">
            <DialogTitle v-if="title" class="n-loader-dialog__title">{{ title }}</DialogTitle>
            <DialogDescription v-if="description" class="n-loader-dialog__desc">{{
              description
            }}</DialogDescription>
          </div>
          <slot />
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

export interface NLoaderDialogProps {
  title?: string
  description?: string
}

withDefaults(defineProps<NLoaderDialogProps>(), {
  title: undefined,
  description: '잠시만 기다려주세요…',
})

const open = defineModel<boolean>({ default: false })
</script>

<style>
.n-loader-dialog__overlay {
  position: fixed;
  inset: 0;
  z-index: var(--n-z-index-modal-backdrop, 1040);
  background-color: rgba(17, 17, 17, 0.32);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
}

.n-loader-dialog__content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: var(--n-z-index-modal, 1050);
  width: min(var(--n-dialog-viewport-ratio, 90vw), var(--n-dialog-width-default, 17.5rem));
  /* NAlertDialog 와 동일한 상하 대칭 리듬 (36px) */
  padding: 36px 24px 36px;
  border-radius: var(--n-radius-3xl, 1.5rem);
  background-color: var(--n-color-neutral-0, #ffffff);
  box-shadow: var(--n-shadow-modal, 0 30px 60px -20px rgba(17, 17, 17, 0.25));
  font-family: var(--n-font-family-sans, 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Segoe UI', 'Noto Sans KR', sans-serif);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
  text-align: center;
}

.n-loader-dialog__content:focus {
  outline: none;
}

.n-loader-dialog__spinner {
  width: 48px;
  height: 48px;
  border-radius: var(--n-radius-full, 9999px);
  border: 4px solid var(--n-color-primary-100, #e3dbff);
  border-top-color: var(--n-color-primary-500, #6239ff);
  animation: n-loader-spin 0.9s linear infinite;
}

@keyframes n-loader-spin {
  to {
    transform: rotate(360deg);
  }
}

.n-loader-dialog__text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.n-loader-dialog__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--n-color-neutral-900, #171717);
  word-break: keep-all;
  overflow-wrap: break-word;
  text-wrap: balance;
}

.n-loader-dialog__desc {
  margin: 0;
  font-size: 12px;
  color: var(--n-color-neutral-500, #737373);
  word-break: keep-all;
  overflow-wrap: break-word;
  text-wrap: pretty;
}

/* Transitions */
.n-loader-dialog-backdrop-enter-active,
.n-loader-dialog-backdrop-leave-active {
  transition: opacity 200ms ease;
}
.n-loader-dialog-backdrop-enter-from,
.n-loader-dialog-backdrop-leave-to {
  opacity: 0;
}

.n-loader-dialog-content-enter-active,
.n-loader-dialog-content-leave-active {
  transition:
    opacity 200ms ease,
    transform 220ms cubic-bezier(0.2, 0.7, 0.2, 1);
}
.n-loader-dialog-content-enter-from,
.n-loader-dialog-content-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) translateY(8px) scale(0.96);
}
</style>
