<script setup lang="ts">
// 설치 가이드 단계 목록(client-guide spec S-2 · S-3) — 번호 + 문장 + 보조 문장 + 화면 이미지(또는 상태 표시줄 그림).
// 한 줄에 한 단계(2609 판의 2열 격자 → 휴대폰 폭 1열). 번호는 ol 순서 그대로.
import type { GuideStep } from '~/content/guide/types'
import GuideShot from './GuideShot.vue'
import GuideStatusBar from './GuideStatusBar.vue'
import GuideText from './GuideText.vue'

defineProps<{ steps: readonly GuideStep[] }>()
</script>

<template>
  <ol class="g-steps">
    <li v-for="(step, i) in steps" :key="i" class="g-step">
      <div class="g-step__text">
        <span class="g-step__num" aria-hidden="true">{{ i + 1 }}</span>
        <p class="g-step__p">
          <GuideText :src="step.text" />
          <span v-if="step.sub" class="g-step__sub"><GuideText :src="step.sub" /></span>
        </p>
      </div>
      <GuideShot v-if="step.figure" :figure="step.figure" />
      <GuideStatusBar v-else-if="step.status" :os="step.status" />
    </li>
  </ol>
</template>

<style scoped>
.g-steps {
  display: grid;
  gap: 28px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.g-step__text {
  display: grid;
  grid-template-columns: 26px 1fr;
  gap: 10px;
  align-items: start;
}

.g-step__num {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  margin-top: 1px;
  border-radius: 50%;
  background: var(--n-color-primary-500, #6239ff);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
}

.g-step__p {
  margin: 0;
  text-wrap: pretty;
  font-size: 16px;
  line-height: 1.6;
  color: var(--n-color-neutral-800, #262626);
}

.g-step__sub {
  display: block;
  margin-top: 4px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-500, #737373);
}
</style>
