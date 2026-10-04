<script setup lang="ts">
// 오류 화면 본문(catalog spec S-7 — 목업 E-1 ~ E-4). 틀(프레임 · 레이아웃) · 제목 · noindex 는 app/error.vue.
// 컴포넌트 테스트(ErrorPanel.test.ts)가 Nuxt 없이 그린다 — vue 에서 명시 import 한다.
import { MagnifyingGlassIcon } from '@heroicons/vue/24/outline'
import FlagIcon from '~/components/catalog/FlagIcon.vue'
import { ASIA_CHIPS_LABEL, POPULAR_CHIPS_LABEL, UPCOMING_BADGE } from '~/content/error-page'
import type { ErrorChip, ErrorView } from '~/utils/error-view'

defineProps<{ view: ErrorView; chips: readonly ErrorChip[] }>()
const emit = defineEmits<{ retry: [] }>()

const countryPath = (chip: ErrorChip) => `/countries/${chip.iso3.toLowerCase()}`
</script>

<template>
  <section class="error-panel" :data-kind="view.kind">
    <div class="error-panel__head">
      <div v-if="view.country" class="error-panel__flag">
        <FlagIcon :iso2="view.country.iso2" :size="72" />
        <span class="error-panel__badge">{{ UPCOMING_BADGE }}</span>
      </div>
      <svg v-else class="error-panel__ill" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="56" class="error-panel__ill-bg" />
        <path
          d="M40 26h30l14 14v52a4 4 0 0 1-4 4H40a4 4 0 0 1-4-4V30a4 4 0 0 1 4-4z"
          class="error-panel__ill-card"
        />
        <rect x="46" y="48" width="28" height="22" rx="4" class="error-panel__ill-chip" />
        <path d="M55 48v22M65 48v22M46 59h28" class="error-panel__ill-line" />
        <circle cx="80" cy="80" r="15" class="error-panel__ill-dot" />
        <template v-if="view.kind === 'error'">
          <path d="M80 72v10" class="error-panel__ill-mark" />
          <circle cx="80" cy="88" r="2" class="error-panel__ill-mark-dot" />
        </template>
        <path
          v-else
          d="M75.5 76a4.5 4.5 0 1 1 6.3 4.1c-1.1.5-1.8 1.4-1.8 2.6v.8"
          class="error-panel__ill-mark"
        />
        <circle
          v-if="view.kind !== 'error'"
          cx="80"
          cy="88"
          r="2"
          class="error-panel__ill-mark-dot"
        />
      </svg>

      <h1 class="error-panel__title">{{ view.copy.title }}</h1>
      <p class="error-panel__desc">
        {{ view.copy.lines[0] }}<br />
        {{ view.copy.lines[1] }}
      </p>

      <div class="error-panel__actions">
        <NuxtLink
          v-if="view.copy.primary.to"
          :to="view.copy.primary.to"
          class="error-panel__btn error-panel__btn--primary"
        >
          <MagnifyingGlassIcon
            v-if="view.copy.primary.to === '/search'"
            class="error-panel__btn-icon"
            aria-hidden="true"
          />
          {{ view.copy.primary.label }}
        </NuxtLink>
        <button
          v-else
          type="button"
          class="error-panel__btn error-panel__btn--primary"
          @click="emit('retry')"
        >
          {{ view.copy.primary.label }}
        </button>
        <NuxtLink
          :to="view.copy.secondary.to!"
          class="error-panel__btn error-panel__btn--secondary"
        >
          {{ view.copy.secondary.label }}
        </NuxtLink>
      </div>
    </div>

    <div
      v-if="view.chips && chips.length"
      class="error-panel__chips-wrap"
      :class="{ 'error-panel__chips-wrap--box': view.chips === 'asia' }"
    >
      <h2 class="error-panel__label">
        {{ view.chips === 'asia' ? ASIA_CHIPS_LABEL : POPULAR_CHIPS_LABEL }}
      </h2>
      <ul class="error-panel__chips">
        <li v-for="chip in chips" :key="chip.iso3">
          <NuxtLink :to="countryPath(chip)" class="error-panel__chip">
            <FlagIcon :iso2="chip.iso2" :size="18" />
            {{ chip.ko }}
          </NuxtLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.error-panel {
  padding: 8px 20px 32px;
}

.error-panel__head {
  padding: 36px 0 8px;
  text-align: center;
}

.error-panel__ill {
  display: block;
  width: 112px;
  height: 112px;
  margin: 0 auto 20px;
}

.error-panel__ill-bg {
  fill: var(--n-color-primary-50, #f1edff);
}

.error-panel__ill-card {
  fill: var(--n-color-neutral-0, #ffffff);
  stroke: var(--n-color-primary-200, #c7b6ff);
  stroke-width: 2.5;
}

.error-panel__ill-chip {
  fill: var(--n-color-primary-100, #e3dbff);
}

.error-panel__ill-line {
  fill: none;
  stroke: var(--n-color-primary-200, #c7b6ff);
  stroke-width: 2;
}

.error-panel__ill-dot {
  fill: var(--n-color-primary-500, #6239ff);
}

.error-panel__ill-mark {
  fill: none;
  stroke: var(--n-color-neutral-0, #ffffff);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.error-panel__ill-mark-dot {
  fill: var(--n-color-neutral-0, #ffffff);
}

.error-panel__flag {
  position: relative;
  display: inline-block;
  margin: 0 auto 26px;
}

.error-panel__flag :deep(.flag-icon) {
  display: block;
}

.error-panel__badge {
  position: absolute;
  bottom: -10px;
  left: 50%;
  padding: 1px 9px;
  transform: translateX(-50%);
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: 999px;
  background: var(--n-color-neutral-100, #f5f5f5);
  color: var(--n-color-neutral-700, #404040);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.error-panel__title {
  margin: 0 0 8px;
  color: var(--n-color-neutral-900, #171717);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.4;
  text-wrap: balance;
  word-break: keep-all;
}

.error-panel__desc {
  margin: 0;
  color: var(--n-color-neutral-600, #525252);
  font-size: 15px;
  line-height: 1.6;
  word-break: keep-all;
}

.error-panel__actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 26px;
}

.error-panel__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 52px;
  padding: 0 16px;
  border: none;
  border-radius: var(--n-radius-2xl, 1rem);
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.error-panel__btn:focus-visible,
.error-panel__chip:focus-visible {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
  outline-offset: 2px;
}

.error-panel__btn--primary {
  background: var(--n-color-primary-500, #6239ff);
  box-shadow: var(--n-shadow-cta-brand, 0 10px 24px -10px rgba(98, 57, 255, 0.5));
  color: var(--n-color-neutral-0, #ffffff);
}

.error-panel__btn--primary:hover {
  background: var(--n-color-primary-600, #5025e8);
}

.error-panel__btn--secondary {
  background: var(--n-color-neutral-100, #f5f5f5);
  color: var(--n-color-neutral-800, #262626);
}

.error-panel__btn--secondary:hover {
  background: var(--n-color-neutral-200, #e5e5e5);
}

.error-panel__btn-icon {
  width: 20px;
  height: 20px;
}

.error-panel__chips-wrap {
  margin-top: 30px;
}

.error-panel__chips-wrap--box {
  padding: 16px;
  border: 1px dashed var(--n-color-neutral-300, #d4d4d4);
  border-radius: 16px;
  background: var(--n-color-neutral-50, #fafafa);
}

.error-panel__label {
  margin: 0 0 10px;
  color: var(--n-color-neutral-700, #404040);
  font-size: 14px;
  font-weight: 700;
}

.error-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.error-panel__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--n-color-neutral-300, #d4d4d4);
  border-radius: 999px;
  background: var(--n-color-neutral-0, #ffffff);
  color: var(--n-color-neutral-800, #262626);
  font-size: 14px;
  text-decoration: none;
}
</style>
