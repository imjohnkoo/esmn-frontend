<script setup lang="ts">
// 게스트 발급 4-step · 테스트 체크아웃 레이아웃 — 헤더 · 하단 탭 없음 (spec D-2).
// 각 페이지가 자체 NStepProgress 머리와 하단 CTA 를 그리므로 헤더 · 탭바와 겹치지 않게 뺀다.
// 사업자정보 푸터는 모든 라우트에 상시(K5) — 4-step · 체크아웃도 예외 없음.
import SiteFooter from '~/components/shell/SiteFooter.vue'
</script>

<template>
  <div class="layout-flow">
    <main class="layout-flow__main">
      <slot />
    </main>
    <SiteFooter compact />
  </div>
</template>

<style scoped>
.layout-flow {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.layout-flow__main {
  flex: 1;
}
</style>
