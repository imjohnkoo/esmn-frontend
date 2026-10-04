<script setup lang="ts">
// 하단 탭 4 (D4) — client 로컬 부품 (A2 · DS 승격은 후속).
// fixed · 프레임 폭 · z --n-z-index-fixed(1030) — DS 오버레이(1040/1050)가 항상 위에 온다.
import type { Component } from 'vue'
import { BookOpenIcon, HomeIcon, QrCodeIcon, UserIcon } from '@heroicons/vue/24/outline'
import {
  BookOpenIcon as BookOpenSolidIcon,
  HomeIcon as HomeSolidIcon,
  QrCodeIcon as QrCodeSolidIcon,
  UserIcon as UserSolidIcon,
} from '@heroicons/vue/24/solid'
import { SHELL_TABS, activeTabOf, tabAriaCurrent, type TabKey } from '~/utils/shell-nav'
import { useShellRoute } from '~/composables/useShellRoute'

// 오류 화면에서는 그 오류가 난 주소(error.vue 가 내려 준다) — useShellRoute
const route = useShellRoute()
const active = computed(() => activeTabOf(route.path))

const ICONS: Record<TabKey, { outline: Component; solid: Component }> = {
  home: { outline: HomeIcon, solid: HomeSolidIcon },
  'my-esim': { outline: QrCodeIcon, solid: QrCodeSolidIcon },
  guide: { outline: BookOpenIcon, solid: BookOpenSolidIcon },
  my: { outline: UserIcon, solid: UserSolidIcon },
}
</script>

<template>
  <nav class="bottom-tab-bar" aria-label="주요 메뉴">
    <ul class="bottom-tab-bar__list">
      <li v-for="tab in SHELL_TABS" :key="tab.key" class="bottom-tab-bar__cell">
        <NuxtLink v-slot="{ href, navigate }" :to="tab.to" custom>
          <a
            :href="href"
            class="bottom-tab-bar__item"
            :class="{ 'bottom-tab-bar__item--active': active === tab.key }"
            :aria-current="tabAriaCurrent(route.path, tab)"
            @click="navigate"
          >
            <component
              :is="active === tab.key ? ICONS[tab.key].solid : ICONS[tab.key].outline"
              class="bottom-tab-bar__icon"
              aria-hidden="true"
            />
            <span class="bottom-tab-bar__label">{{ tab.label }}</span>
          </a>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.bottom-tab-bar {
  position: fixed;
  bottom: 0;
  left: 50%;
  z-index: var(--n-z-index-fixed, 1030);
  width: 100%;
  max-width: var(--shell-frame-max, 440px);
  padding-bottom: env(safe-area-inset-bottom);
  background: var(--n-color-neutral-0, #ffffff);
  border-top: 1px solid var(--n-color-neutral-200, #e5e5e5);
  transform: translateX(-50%);
}

.bottom-tab-bar__list {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  height: var(--shell-tabbar-height, 56px);
  margin: 0;
  padding: 0;
  list-style: none;
}

.bottom-tab-bar__cell {
  display: flex;
}

.bottom-tab-bar__item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  color: var(--n-color-neutral-500, #737373);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}

.bottom-tab-bar__item--active {
  color: var(--n-color-primary-600, #5025e8);
}

.bottom-tab-bar__item:focus-visible {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
  outline-offset: -4px;
  border-radius: 10px;
}

.bottom-tab-bar__icon {
  width: 24px;
  height: 24px;
}
</style>
