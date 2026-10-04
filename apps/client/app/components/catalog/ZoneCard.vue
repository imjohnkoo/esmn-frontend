<script setup lang="ts">
// 국가 페이지의 zone 카드(catalog spec S-3 · D-11) — 무제한 · 종량제를 한 카드에 칩으로, 가격은 «최저가부터».
// 컴포넌트 테스트(ZoneCard.test.ts)가 Nuxt 없이 그린다 — vue 에서 명시 import 한다.
import { computed } from 'vue'
import { thumbUrl, type AssetManifest } from '#shared/catalog/assets'
import { formatWon } from '#shared/catalog/format'
import type { ZoneCardData } from '#shared/catalog/pages'
import manifest from '~/content/catalog-assets.json'

const props = defineProps<{ card: ZoneCardData }>()
const src = computed(() => thumbUrl(manifest as AssetManifest, props.card.thumb))
// 라벨에 이미 «N개국» 이 있으면(«유럽 34개국») 배지를 겹쳐 달지 않는다
const countBadge = computed(() =>
  props.card.countryCount > 1 && !props.card.label.includes('개국')
    ? `${props.card.countryCount}개국`
    : '',
)
const kindLabel = { U: '무제한', L: '종량제' } as const
</script>

<template>
  <NuxtLink :to="card.to" class="zone-card">
    <img
      class="zone-card__thumb"
      :src="src"
      alt=""
      width="64"
      height="64"
      loading="lazy"
      decoding="async"
    />
    <span class="zone-card__body">
      <span class="zone-card__title">
        {{ card.label }}
        <span v-if="countBadge" class="zone-card__count">{{ countBadge }}</span>
      </span>
      <span v-if="card.sub" class="zone-card__sub">{{ card.sub }}</span>
      <span class="zone-card__kinds">
        <span v-for="k in card.kinds" :key="k" class="zone-card__kind">{{ kindLabel[k] }}</span>
      </span>
    </span>
    <span class="zone-card__price">
      <strong>{{ formatWon(card.lowestWon) }}</strong>
      <span>부터</span>
    </span>
  </NuxtLink>
</template>

<style scoped>
.zone-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: 16px;
  color: inherit;
  text-decoration: none;
}

.zone-card:focus-visible {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
  outline-offset: 2px;
}

.zone-card__thumb {
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 12px;
  object-fit: cover;
  background: var(--n-color-neutral-100, #f5f5f5);
}

.zone-card__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.zone-card__title {
  font-size: 15.5px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
}

.zone-card__count {
  margin-left: 4px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--n-color-primary-50, #f1edff);
  color: var(--n-color-primary-600, #5025e8);
  font-size: 11.5px;
  font-weight: 700;
  vertical-align: 1px;
}

.zone-card__sub {
  overflow: hidden;
  font-size: 12.5px;
  color: var(--n-color-neutral-600, #525252);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.zone-card__kinds {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.zone-card__kind {
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--n-color-neutral-100, #f5f5f5);
  color: var(--n-color-neutral-600, #525252);
  font-size: 11.5px;
  font-weight: 700;
}

.zone-card__price {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: flex-end;
  font-size: 12px;
  color: var(--n-color-neutral-500, #737373);
}

.zone-card__price strong {
  font-size: 16px;
  color: var(--n-color-neutral-900, #171717);
}
</style>
