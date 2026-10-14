<script setup lang="ts">
// 나라별 현지 통신사 목록(client-guide-check spec S-4 · D-5 · D-15) — 판매 중인 나라 전부 · 가나다 · 초성 머리.
// 줄 = 국기 · 나라 이름 · 통신사 칩(K1 순서) · 망 칩(흐린 글자). 칩 모양은 상품 상세 «현지 통신사»(ProductSections .sec__op)와 같은 값.
// «(추천)» 은 없다(국가별 우선 통신사 자료 없음 — D-5).
import type { CarrierGroup } from '#shared/catalog/pages'
import FlagIcon from '~/components/catalog/FlagIcon.vue'
import { OPERATOR_FALLBACK } from '~/content/product-detail'

defineProps<{ groups: readonly CarrierGroup[] }>()
</script>

<template>
  <div class="g-carriers">
    <template v-for="g in groups" :key="g.head">
      <p class="g-carriers__h" aria-hidden="true">{{ g.head }}</p>
      <ul class="g-carriers__list" role="list">
        <li v-for="r in g.rows" :key="r.iso3" class="g-carriers__row">
          <span class="g-carriers__name"><FlagIcon :iso2="r.iso2" :size="20" />{{ r.nameKr }}</span>
          <span class="g-carriers__ops">
            <span v-for="op in r.operators ?? [OPERATOR_FALLBACK]" :key="op" class="g-carriers__op">{{
              op
            }}</span>
            <span v-if="r.network" class="g-carriers__op g-carriers__op--muted">{{ r.network }}</span>
          </span>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.g-carriers {
  margin-top: 8px;
  word-break: keep-all;
}

.g-carriers__h {
  margin: 20px 0 2px;
  font-size: 13px;
  font-weight: 800;
  line-height: 1.6;
  color: var(--n-color-primary-600, #5025e8);
}

.g-carriers__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.g-carriers__row {
  display: grid;
  gap: 6px;
  padding: 12px 0;
  border-bottom: 1px solid var(--n-color-neutral-100, #f5f5f5);
}

.g-carriers__name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--n-color-neutral-900, #171717);
}

.g-carriers__ops {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* 상품 상세 «현지 통신사» 칩(ProductSections .sec__op)과 같은 값 — guide-frame-css.test.ts 가 대조 */
.g-carriers__op {
  padding: 3px 9px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: 8px;
  font-size: 13px;
  color: var(--n-color-neutral-700, #404040);
}

.g-carriers__op--muted {
  color: var(--n-color-neutral-500, #737373);
}
</style>
