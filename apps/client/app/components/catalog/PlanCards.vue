<script setup lang="ts">
// 데이터 용량 가격 카드(catalog spec D-3 · D-2) — 유심사 배치. 라디오 그룹이라 화살표 키로 옮겨 다닌다.
// 가격 = K1 최종가(판매가 · 할인율 없음) + 보조 단가(무제한 «하루 약» · 종량제 «1GB당 약»).
import { formatWon } from '#shared/catalog/format'
import type { PlanCardData } from '#shared/catalog/picker'
import type { Kind } from '#shared/catalog/types'
import { planSub, planTitle } from '~/content/product-detail'

defineProps<{ name: string; kind: Kind; cards: PlanCardData[]; labelledby: string }>()
const model = defineModel<number>({ required: true })
</script>

<template>
  <div class="plan-cards" role="radiogroup" :aria-labelledby="labelledby">
    <label
      v-for="c in cards"
      :key="c.cap"
      class="plan-card"
      :class="{ 'plan-card--on': c.cap === model }"
    >
      <input
        v-model.number="model"
        class="plan-card__radio"
        type="radio"
        :name="name"
        :value="c.cap"
      />
      <span class="plan-card__top">
        <span class="plan-card__title">{{ planTitle(kind, c.cap) }}</span>
        <span class="plan-card__price">{{ formatWon(c.option.finalWon) }}</span>
      </span>
      <span class="plan-card__sub">{{ planSub(kind, formatWon(c.unitWon)) }}</span>
    </label>
  </div>
</template>

<style scoped>
.plan-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: 16px;
  background: var(--n-color-neutral-0, #fff);
  cursor: pointer;
}

.plan-card--on {
  padding: 13px 15px;
  border: 2px solid var(--n-color-primary-500, #6239ff);
  box-shadow: 0 0 0 3px var(--n-color-primary-50, #f1edff);
}

.plan-card:has(.plan-card__radio:focus-visible) {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
  outline-offset: 3px;
}

.plan-card__radio {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.plan-card__top {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.plan-card__title {
  font-size: 16px;
  font-weight: 700;
  color: var(--n-color-neutral-900, #171717);
}

.plan-card__price {
  font-size: 17px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
}

.plan-card--on .plan-card__price {
  color: var(--n-color-primary-600, #5025e8);
}

.plan-card__sub {
  font-size: 12.5px;
  color: var(--n-color-neutral-500, #737373);
}
</style>
