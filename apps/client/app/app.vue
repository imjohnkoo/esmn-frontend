<script setup lang="ts">
// 모바일 고정 프레임 (D3 · spec D-1) — 뷰포트 < 560px 전폭, ≥ 560px 가운데 440px.
// DS NMobileLayout 과 같은 수치지만 컴포넌트는 쓰지 않는다: content 래퍼의 overflow-y:auto 가 sticky 헤더를 깨뜨린다.
// ⚠️ .app-bg · .app-frame 에 overflow · transform · contain 을 주지 말 것 — sticky 헤더 · fixed 탭바가 깨진다.
import { isNoindexPath } from '#shared/utils/robots'
import { pageTitle } from '~/utils/page-title'

const route = useRoute()

useHead(() => ({
  htmlAttrs: { lang: 'ko' },
  titleTemplate: (title?: string) => pageTitle(title),
  // noindex 목록은 shared/utils/robots.ts 하나 — 레이아웃 · 페이지가 따로 넣지 않는다
  meta: isNoindexPath(route.path) ? [{ name: 'robots', content: 'noindex, nofollow' }] : [],
}))
</script>

<template>
  <div class="app-bg">
    <div class="app-frame">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>
    <NuxtRouteAnnouncer />
  </div>
</template>

<style>
:root {
  --shell-frame-max: 100%;
  --shell-header-height: 56px;
  --shell-tabbar-height: 56px;
}

@media (min-width: 560px) {
  :root {
    --shell-frame-max: 440px;
  }
}

.app-bg {
  display: flex;
  justify-content: center;
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--n-color-neutral-0, #ffffff);
}

.app-frame {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: var(--shell-frame-max);
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--n-color-neutral-0, #ffffff);
}

@media (min-width: 560px) {
  .app-bg {
    background: var(--n-color-neutral-100, #f5f5f5);
  }

  .app-frame {
    box-shadow:
      0 0 0 1px var(--n-color-neutral-200, #e5e5e5),
      var(--n-shadow-lg, 0 10px 15px -3px rgb(0 0 0 / 0.1));
  }
}
</style>
