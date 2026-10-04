<script setup lang="ts">
// 전체 메뉴 — DS NBottomSheet (D-3: NDrawer 는 데스크톱에서 프레임 밖 창 끝에 붙는다 · 시트는 가운데 max 420px).
import { NBottomSheet } from '@imjohnkoo/design-vue'
import { SHELL_MENU } from '~/utils/shell-nav'

const open = defineModel<boolean>({ default: false })
</script>

<template>
  <NBottomSheet v-model="open" title="전체 메뉴">
    <nav class="shell-menu" aria-label="전체 메뉴">
      <section v-for="group in SHELL_MENU" :key="group.title" class="shell-menu__group">
        <h3 class="shell-menu__title">{{ group.title }}</h3>
        <ul class="shell-menu__list">
          <li v-for="link in group.links" :key="link.to">
            <NuxtLink :to="link.to" class="shell-menu__link" @click="open = false">
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>
      </section>
    </nav>
  </NBottomSheet>
</template>

<style scoped>
.shell-menu {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 4px 4px 12px;
}

.shell-menu__title {
  margin: 0 0 6px;
  padding: 0 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--n-color-neutral-500, #737373);
}

.shell-menu__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.shell-menu__link {
  display: block;
  padding: 12px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  color: var(--n-color-neutral-900, #171717);
  text-decoration: none;
  transition: background 120ms ease;
}

.shell-menu__link:hover,
.shell-menu__link:focus-visible {
  background: var(--n-color-neutral-50, #fafafa);
}
</style>
