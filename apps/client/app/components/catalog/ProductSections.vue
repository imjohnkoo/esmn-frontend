<script setup lang="ts">
// 상세 안내 6섹션(catalog spec D-4 · F-7) — 사용일수 · 커버리지 · 이용 방법 · 지원 기기 · 환불(발급 전 전액만) · FAQ.
// 문안은 app/content/product-detail.ts(금지어 테스트). 리뷰 · 비교표는 보류(D-4).
// 컴포넌트 테스트(ProductSections.test.ts)가 Nuxt 없이 그린다 — vue 에서 명시 import 한다.
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import type { Kind, ZoneView } from '#shared/catalog/types'
import FlagIcon from '~/components/catalog/FlagIcon.vue'
import ZoneMap from '~/components/catalog/ZoneMap.vue'
import {
  DEVICES,
  HOW_TO,
  OPERATOR_FALLBACK,
  OPERATOR_NOTE,
  REFUND,
  USAGE,
  coverageLead,
  coverageTitle,
  faqItems,
  usageNote,
  usageTimeline,
} from '~/content/product-detail'

const props = defineProps<{ zone: ZoneView; kind: Kind }>()
const compact = computed(() => props.zone.countries.length >= 7)
const countries = computed(() =>
  [...props.zone.countries].sort((a, b) => a.nameKr.localeCompare(b.nameKr, 'ko')),
)
const faqs = computed(() => faqItems(props.zone, props.kind))
const timeline = computed(() => usageTimeline(props.kind))
const note = computed(() => usageNote(props.kind))
</script>

<template>
  <div class="sections">
    <section class="sec" aria-labelledby="sec-usage">
      <h2 id="sec-usage" class="sec__title">{{ USAGE.title }}</h2>
      <p class="sec__text">{{ USAGE.lead }}</p>
      <ol class="sec__timeline">
        <li v-for="t in timeline" :key="t.date">
          <span class="sec__dot" aria-hidden="true" />
          <!-- 두 칸 사이 공백 — 화면낭독기가 «3월 1일오후 3시» 로 붙여 읽지 않게 -->
          <span>{{ t.date }}</span
          >{{ ' ' }}<span>{{ t.text }}</span>
        </li>
      </ol>
      <p class="sec__hint">{{ note }}</p>
    </section>

    <section class="sec" aria-labelledby="sec-coverage">
      <h2 id="sec-coverage" class="sec__title">{{ coverageTitle(zone) }}</h2>
      <p class="sec__text">{{ coverageLead(zone) }}</p>
      <ZoneMap :src="zone.map.src" :pins="zone.map.pins" :alt="`${zone.label} 지도`" />
      <h3 class="sec__sub">
        {{
          zone.countries.length > 1 ? `쓸 수 있는 나라 ${zone.countries.length}개` : '현지 통신사'
        }}
      </h3>
      <ul v-if="compact" class="sec__grid">
        <li v-for="c in countries" :key="c.iso3">
          <FlagIcon :iso2="c.iso2" :size="18" /> {{ c.nameKr }}
        </li>
      </ul>
      <ul v-else class="sec__countries">
        <li v-for="c in countries" :key="c.iso3" class="sec__country">
          <span v-if="zone.countries.length > 1" class="sec__country-name">
            <FlagIcon :iso2="c.iso2" :size="20" /> {{ c.nameKr }}
            <!-- 대표 도시 하나 — K1 도시 목록은 검색용이라 같은 도시의 다른 표기(비엔나 · 빈)가 섞여 있다 -->
            <span v-if="c.cities.length" class="sec__cities">{{ c.cities[0] }}</span>
          </span>
          <span class="sec__ops">
            <span v-for="op in c.operators ?? [OPERATOR_FALLBACK]" :key="op" class="sec__op">{{
              op
            }}</span>
            <span v-if="c.network" class="sec__op sec__op--muted">{{ c.network }}</span>
          </span>
        </li>
      </ul>
      <p v-if="!compact" class="sec__hint">{{ OPERATOR_NOTE }}</p>
    </section>

    <section class="sec" aria-labelledby="sec-how">
      <h2 id="sec-how" class="sec__title">{{ HOW_TO.title }}</h2>
      <ol class="sec__steps">
        <li v-for="s in HOW_TO.steps" :key="s">{{ s }}</li>
      </ol>
      <ul class="sec__warnings">
        <li v-for="w in HOW_TO.warnings" :key="w">{{ w }}</li>
      </ul>
      <p class="sec__hint">{{ HOW_TO.note }}</p>
      <NuxtLink :to="HOW_TO.link.to" class="sec__link">
        {{ HOW_TO.link.label }} <ChevronRightIcon aria-hidden="true" />
      </NuxtLink>
    </section>

    <section class="sec" aria-labelledby="sec-devices">
      <h2 id="sec-devices" class="sec__title">{{ DEVICES.title }}</h2>
      <p class="sec__text">{{ DEVICES.text }}</p>
      <NuxtLink :to="DEVICES.link.to" class="sec__link">
        {{ DEVICES.link.label }} <ChevronRightIcon aria-hidden="true" />
      </NuxtLink>
    </section>

    <section class="sec" aria-labelledby="sec-refund">
      <h2 id="sec-refund" class="sec__title">{{ REFUND.title }}</h2>
      <p class="sec__text">{{ REFUND.text }}</p>
      <NuxtLink :to="REFUND.link.to" class="sec__link">
        {{ REFUND.link.label }} <ChevronRightIcon aria-hidden="true" />
      </NuxtLink>
    </section>

    <section class="sec" aria-labelledby="sec-faq">
      <h2 id="sec-faq" class="sec__title">자주 묻는 질문</h2>
      <details v-for="f in faqs" :key="f.q" class="sec__faq">
        <summary>{{ f.q }}</summary>
        <p>{{ f.a }}</p>
      </details>
    </section>
  </div>
</template>

<style scoped>
.sec {
  padding: 24px 20px;
  border-top: 8px solid var(--n-color-neutral-100, #f5f5f5);
  word-break: keep-all;
  overflow-wrap: break-word;
}

.sec__title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
  text-wrap: balance;
}

.sec__sub {
  margin: 18px 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--n-color-neutral-600, #525252);
}

.sec__text {
  margin: 0 0 10px;
  font-size: 14.5px;
  line-height: 1.6;
  color: var(--n-color-neutral-700, #404040);
  text-wrap: pretty;
}

.sec__warnings {
  margin: 10px 0 0;
  padding: 10px 12px 10px 28px;
  border-radius: 10px;
  background: var(--n-color-warning-50, #fffbeb);
  font-size: 13.5px;
  line-height: 1.6;
  color: var(--n-color-neutral-800, #262626);
}

.sec__hint {
  margin: 8px 0 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--n-color-neutral-500, #737373);
  text-wrap: pretty;
}

.sec__timeline {
  position: relative;
  display: flex;
  justify-content: space-between;
  margin: 16px 0 8px;
  padding: 0;
  list-style: none;
}

.sec__timeline::before {
  content: '';
  position: absolute;
  top: 6px;
  right: 12%;
  left: 12%;
  height: 2px;
  background: var(--n-color-primary-200, #c7b6ff);
}

.sec__timeline li {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 25%;
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--n-color-neutral-600, #525252);
  text-align: center;
}

.sec__dot {
  width: 14px;
  height: 14px;
  margin-bottom: 6px;
  border: 3px solid #fff;
  border-radius: 50%;
  background: var(--n-color-primary-500, #6239ff);
  box-shadow: 0 0 0 2px var(--n-color-primary-500, #6239ff);
}

.sec__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
  margin: 0;
  padding: 0;
  font-size: 13.5px;
  list-style: none;
}

.sec__grid li,
.sec__country-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.sec__countries {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.sec__country-name {
  margin-bottom: 6px;
  font-size: 14.5px;
  font-weight: 700;
}

.sec__cities {
  font-size: 12.5px;
  font-weight: 400;
  color: var(--n-color-neutral-500, #737373);
}

.sec__ops {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sec__op {
  padding: 3px 9px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: 8px;
  font-size: 13px;
  color: var(--n-color-neutral-700, #404040);
}

.sec__op--muted {
  color: var(--n-color-neutral-500, #737373);
}

.sec__steps {
  counter-reset: step;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.sec__steps li {
  display: flex;
  gap: 10px;
  margin: 0 0 12px;
  font-size: 14.5px;
  color: var(--n-color-neutral-800, #262626);
  counter-increment: step;
}

.sec__steps li::before {
  content: counter(step);
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--n-color-primary-50, #f1edff);
  color: var(--n-color-primary-700, #3f1cc0);
  font-size: 13px;
  font-weight: 800;
}

.sec__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: 12px;
  color: var(--n-color-neutral-800, #262626);
  font-size: 14.5px;
  text-decoration: none;
}

.sec__link svg {
  width: 18px;
  height: 18px;
  color: var(--n-color-neutral-300, #d4d4d4);
}

.sec__faq {
  border-bottom: 1px solid var(--n-color-neutral-200, #e5e5e5);
}

.sec__faq summary {
  padding: 14px 0;
  font-size: 14.5px;
  font-weight: 600;
  color: var(--n-color-neutral-900, #171717);
  cursor: pointer;
}

.sec__faq p {
  margin: 0 0 14px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-600, #525252);
}
</style>
