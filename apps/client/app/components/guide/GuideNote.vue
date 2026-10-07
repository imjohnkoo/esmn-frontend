<script setup lang="ts">
// 설치 가이드 안내 박스(client-guide spec S-2 · S-3) — info(참고) · warn(주의) · tip(팁) · home(귀국 후).
// 2609 판 이모지(☝️ 🚨 💡 🏠)는 사이트 아이콘으로(spec D-7).
import {
  ExclamationTriangleIcon,
  HomeIcon,
  InformationCircleIcon,
  LightBulbIcon,
} from '@heroicons/vue/24/outline'
import type { GuideNote } from '~/content/guide/types'
import GuideText from './GuideText.vue'

defineProps<{ note: GuideNote }>()
const ICONS = {
  info: InformationCircleIcon,
  warn: ExclamationTriangleIcon,
  tip: LightBulbIcon,
  home: HomeIcon,
} as const
</script>

<template>
  <div class="g-note" :class="`g-note--${note.tone}`">
    <component :is="ICONS[note.tone]" class="g-note__icon" aria-hidden="true" />
    <div class="g-note__body">
      <p v-for="(line, i) in note.lines" :key="i"><GuideText :src="line" /></p>
    </div>
  </div>
</template>

<style scoped>
.g-note {
  display: grid;
  grid-template-columns: 22px 1fr;
  gap: 10px;
  align-items: start;
  margin-top: 16px;
  padding: 14px 16px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: var(--n-radius-xl, 12px);
  background: var(--n-color-neutral-50, #fafafa);
  font-size: 15px;
  line-height: 1.65;
  color: var(--n-color-neutral-700, #404040);
}

.g-note__icon {
  width: 22px;
  height: 22px;
  margin-top: 1px;
  color: var(--n-color-neutral-500, #737373);
}

.g-note__body p {
  margin: 0;
  text-wrap: pretty;
}

.g-note__body p + p {
  margin-top: 6px;
}

.g-note--warn {
  border-color: var(--n-color-error-200, #fecaca);
  background: var(--n-color-error-50, #fef2f2);
}

.g-note--warn .g-note__icon {
  color: var(--n-color-error-600, #dc2626);
}

.g-note--warn :deep(.g-b) {
  color: var(--n-color-error-700, #b91c1c);
}

.g-note--tip {
  border-color: var(--n-color-primary-100, #e3dbff);
  background: var(--n-color-primary-50, #f1edff);
}

.g-note--tip .g-note__icon,
.g-note--tip :deep(.g-b) {
  color: var(--n-color-primary-700, #4a1fd6);
}

.g-note--home .g-note__icon {
  color: var(--n-color-primary-500, #6239ff);
}
</style>
