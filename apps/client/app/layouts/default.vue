<script setup lang="ts">
// 판매 사이트 레이아웃 — 헤더(sticky) + 본문 + 사업자정보 푸터 + 하단 탭(fixed).
// 탭바가 fixed 라 푸터 아래에 탭바 높이만큼 자리를 비워 둔다(푸터 마지막 줄이 탭바에 가리지 않게).
import ShellHeader from '~/components/shell/ShellHeader.vue'
import SiteFooter from '~/components/shell/SiteFooter.vue'
import BottomTabBar from '~/components/shell/BottomTabBar.vue'

// sticky 헤더 · fixed 탭바에 앵커 목적지(/my#cs)와 키보드 포커스가 가리지 않게 (spec D-20 · WCAG 2.4.11)
// html 에 거는 여백이라 이 레이아웃일 때만 클래스를 붙인다 — flow 레이아웃에는 헤더 · 탭바가 없다.
useHead({ htmlAttrs: { class: 'has-shell-chrome' } })
</script>

<template>
  <div class="layout-default">
    <ShellHeader />
    <main class="layout-default__main">
      <slot />
    </main>
    <SiteFooter />
    <div class="layout-default__tab-space" aria-hidden="true" />
    <BottomTabBar />
  </div>
</template>

<style>
html.has-shell-chrome {
  scroll-padding-top: calc(var(--shell-header-height, 56px) + 8px);
  scroll-padding-bottom: calc(var(--shell-tabbar-height, 56px) + env(safe-area-inset-bottom) + 8px);
}
</style>

<style scoped>
.layout-default {
  display: flex;
  flex: 1;
  flex-direction: column;
}

.layout-default__main {
  flex: 1;
}

.layout-default__tab-space {
  flex-shrink: 0;
  height: calc(var(--shell-tabbar-height, 56px) + env(safe-area-inset-bottom));
}
</style>
