<script setup lang="ts">
// 설치 3단계 흐름(client-guide spec S-1 · S-2 · S-3) — 집에서 설치 → 회선 설정 → 현지에서 켜기.
import { GUIDE_FLOW } from '~/content/guide/common'
</script>

<template>
  <ol class="g-flow">
    <li v-for="item in GUIDE_FLOW" :key="item.step" class="g-flow__item">
      <span class="g-flow__step">{{ item.step }}</span>
      <span class="g-flow__title">{{ item.title }}</span>
      <span class="g-flow__meta">{{ item.meta }}</span>
    </li>
  </ol>
</template>

<style scoped>
.g-flow {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.g-flow__item {
  display: grid;
  gap: 4px;
  align-content: start;
  padding: 12px 10px;
  border: 1px solid var(--n-color-primary-100, #e3dbff);
  border-radius: var(--n-radius-xl, 12px);
  background: #fff;
  box-shadow: 0 6px 18px -12px rgba(98, 57, 255, 0.35);
}

.g-flow__step {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--n-color-primary-500, #6239ff);
}

.g-flow__title {
  font-size: 15px;
  font-weight: 800;
  line-height: 1.35;
  color: var(--n-color-neutral-900, #171717);
}

.g-flow__meta {
  font-size: 12px;
  color: var(--n-color-neutral-500, #737373);
}
</style>
