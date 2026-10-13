<script setup lang="ts">
// 확인 목록(client-guide-check spec S-1 · S-2) — 화면 그림과 비교할 상태 한 줄씩. 체크 원 24px · 본문 16px(설치 가이드 단계 문장과 같은 크기).
import { CheckIcon } from '@heroicons/vue/24/outline'
import GuideText from './GuideText.vue'

defineProps<{ points: readonly string[] }>()
</script>

<template>
  <ul class="g-points" role="list">
    <li v-for="(p, i) in points" :key="i" class="g-point">
      <span class="g-point__mark" aria-hidden="true"><CheckIcon class="g-point__icon" /></span>
      <p class="g-point__p"><GuideText :src="p" /></p>
    </li>
  </ul>
</template>

<style scoped>
.g-points {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.g-point {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: 10px;
  align-items: start;
}

.g-point__mark {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--n-color-primary-50, #f1edff);
}

.g-point__icon {
  width: 16px;
  height: 16px;
  stroke-width: 2.6;
  color: var(--n-color-primary-600, #5025e8);
}

.g-point__p {
  margin: 0;
  text-wrap: pretty;
  font-size: 16px;
  line-height: 1.6;
  color: var(--n-color-neutral-800, #262626);
}
</style>
