<script setup lang="ts">
// 게스트 발급 4-step · 테스트 체크아웃 · 가이드 전용판(/install-guide — client-guide D-14) 레이아웃 — 헤더 · 하단 탭 없음 (spec D-2).
// 각 페이지가 자체 NStepProgress 머리와 하단 CTA 를 그리므로 헤더 · 탭바와 겹치지 않게 뺀다.
// 사업자정보 푸터는 모든 라우트에 상시(K5) — 단 본인 확인 화면은 뺀다(client-guide D-20 — 페이지 meta `siteFooter: false`).
// 다른 4-step · 체크아웃 · 가이드 전용판은 그대로.
import { computed } from 'vue'
import SiteFooter from '~/components/shell/SiteFooter.vue'

const route = useRoute()
// 페이지 meta 로 정한다 — 서버 렌더부터 같은 값이라 깜빡이지 않고, 다음 화면으로 넘어갈 때 그 화면 값으로 바뀐다
const showFooter = computed(() => route.meta.siteFooter !== false)
</script>

<template>
  <div class="layout-flow">
    <main class="layout-flow__main">
      <slot />
    </main>
    <SiteFooter v-if="showFooter" compact />
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
