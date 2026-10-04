<script setup lang="ts">
// 상단 헤더 (D4) — 로고 · 국가 검색 진입(/search — 검색 자체는 W1-3) · 전체 메뉴.
// DS NHeader 가 sticky · z --n-z-index-sticky(1020). 프레임 조상에 overflow 가 없어야 sticky 가 붙는다(app.vue).
// 하단 경계선 없음(spec F-4 — John 2026-10-02) — DS 기본값(bordered: true)을 여기서만 끈다.
import { NHeader, NLogo } from '@imjohnkoo/design-vue'
import { Bars3Icon, MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import ShellMenu from '~/components/shell/ShellMenu.vue'
import { useShellRoute } from '~/composables/useShellRoute'

const isMenuOpen = ref(false)

// 경로가 바뀌면 닫는다 — 항목 누름 말고도 뒤로가기(안드로이드 back 제스처 포함)로 이동할 때 시트 · 스크롤 잠금이 남지 않게
// 오류 화면에서는 그 오류가 난 주소(error.vue 가 내려 준다) — useShellRoute
const route = useShellRoute()
watch(
  () => route.fullPath,
  () => {
    isMenuOpen.value = false
  },
)
</script>

<template>
  <NHeader class="shell-header" :bordered="false">
    <NuxtLink to="/" class="shell-header__logo">
      <NLogo variant="kor" :height="28" aria-label="이심마니 홈" />
    </NuxtLink>
    <div class="shell-header__actions">
      <NuxtLink to="/search" class="shell-header__icon-btn" aria-label="국가 검색">
        <MagnifyingGlassIcon class="shell-header__icon" aria-hidden="true" />
      </NuxtLink>
      <button
        type="button"
        class="shell-header__icon-btn"
        aria-label="전체 메뉴"
        aria-haspopup="dialog"
        :aria-expanded="isMenuOpen"
        @click="isMenuOpen = true"
      >
        <Bars3Icon class="shell-header__icon" aria-hidden="true" />
      </button>
    </div>
    <ShellMenu v-model="isMenuOpen" />
  </NHeader>
</template>

<style scoped>
/* DS .n-header 보다 우선 — prod 는 컴포넌트 CSS 가 entry.css 보다 먼저 와서 같은 우선순위면 DS 가 이긴다 */
.n-header.shell-header {
  justify-content: space-between;
  height: var(--shell-header-height, 56px);
  padding-top: 0;
  padding-bottom: 0;
}

.shell-header__logo {
  display: inline-flex;
  align-items: center;
  border-radius: 8px;
}

.shell-header__logo:focus-visible,
.shell-header__icon-btn:focus-visible {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
  outline-offset: 2px;
}

.shell-header__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: -8px;
}

.shell-header__icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: var(--n-color-neutral-800, #262626);
  cursor: pointer;
}

.shell-header__icon-btn:hover {
  background: var(--n-color-neutral-50, #fafafa);
}

.shell-header__icon {
  width: 24px;
  height: 24px;
}
</style>
