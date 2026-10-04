<script setup lang="ts">
// 상품 상세(catalog spec S-4 · F-6 · F-8) — 유심사 배치: 히어로 → 종류 밑줄 탭 → 사용 기간 드롭다운 → 데이터 용량 가격 카드
// → 하단 고정 «구매하기» → 구매 시트(K2 · 3초 뒤 같은 탭에서 스마트스토어). 선택 상태는 URL 에 싣지 않는다(프리렌더 1벌).
// 가격은 K1 최종가만(D-2). 안내 섹션(D-4)은 선택기 아래.
import { ChevronLeftIcon } from '@heroicons/vue/24/outline'
import { thumbUrl, type AssetManifest } from '#shared/catalog/assets'
import { zoneMeta } from '#shared/catalog/seo'
import {
  initialSelection,
  periodOptions,
  planCards,
  purchaseSheetProps,
  selectedOption,
  withCap,
  withDays,
  withKind,
  type Selection,
} from '#shared/catalog/picker'
import type { Kind, ZoneView } from '#shared/catalog/types'
import PeriodSelect from '~/components/catalog/PeriodSelect.vue'
import PlanCards from '~/components/catalog/PlanCards.vue'
import ProductSections from '~/components/catalog/ProductSections.vue'
import PurchaseSheet from '~/components/catalog/PurchaseSheet.vue'
import UnderlineTabs from '~/components/catalog/UnderlineTabs.vue'
import manifest from '~/content/catalog-assets.json'
import { HERO_BADGES, heroChecks, heroLead, periodHint } from '~/content/product-detail'
import { catalogPageError, isCatalogParam } from '~/utils/catalog-path'

definePageMeta({ middleware: 'catalog-path' })

const route = useRoute()
const param = String(route.params.zone ?? '')
if (!isCatalogParam('products', param))
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })

const { data, error } = await useFetch<ZoneView>(`/api/catalog/zones/${param}`, {
  key: `catalog-zone-${param}`,
})
// 모르는 zone 은 404, 데이터 라우트의 그 밖의 오류는 500 — 서버 오류를 404 로 덮지 않는다(F-10)
const failed = catalogPageError(error.value, !!data.value)
if (failed)
  throw createError({
    statusCode: failed,
    statusMessage: failed === 404 ? 'Not Found' : 'Catalog zone unavailable',
    fatal: true,
  })

const zone = data.value! // catalogPageError 가 없는 데이터를 이미 걸렀다
const multi = zone.countries.length > 1

const sel = ref<Selection>(initialSelection(zone))
const kindTabs = zone.products.map((p) => ({
  key: p.kind,
  label: p.kind === 'U' ? '무제한' : '종량제',
}))
const kind = computed<Kind>({
  get: () => sel.value.kind,
  set: (k) => (sel.value = withKind(zone, sel.value, k)),
})
const days = computed<number>({
  get: () => sel.value.days,
  set: (d) => (sel.value = withDays(zone, sel.value, d)),
})
const cap = computed<number>({
  get: () => sel.value.cap,
  set: (c) => (sel.value = withCap(zone, sel.value, c)),
})
const periods = computed(() => periodOptions(zone, sel.value.kind))
const cards = computed(() => planCards(zone, sel.value))
const option = computed(() => selectedOption(zone, sel.value))
const product = computed(() => zone.products.find((p) => p.kind === sel.value.kind)!)
// 대표썸네일 · 체크 줄은 고른 종류를 따른다(S-4 — 종량제 탭 = 종량제 썸네일). og 이미지는 첫 상품(무제한 우선) 고정
const heroSrc = computed(() => thumbUrl(manifest as AssetManifest, product.value.thumb))
const heroAlt = [`${zone.label} eSIM`, zone.subtitle].filter(Boolean).join(' — ')
const countBadge = multi && !zone.label.includes('개국') // 라벨이 이미 «34개국» 이면 배지로 되풀이하지 않는다
useCatalogSeo(zoneMeta(zone), thumbUrl(manifest as AssetManifest, zone.products[0]!.thumb))
// 하단 구매 바(73px)만큼 스크롤 여백을 더 둔다 — 키보드 포커스가 구매 바 밑에 가리지 않게(WCAG 2.4.11)
useHead({ htmlAttrs: { class: 'has-buybar' } })

// «← 나라» — 국가 페이지에서 들어왔으면 그 나라, 아니면 홈(SSR 은 홈 — 하이드레이션 뒤에 바꾼다)
const back = ref<{ to: string; label: string }>({ to: '/', label: '홈' })
onMounted(() => {
  const prev = String(window.history.state?.back ?? '')
  // 쿼리 · 해시가 붙어 들어와도(«?utm_source=naver») 그 나라로 돌아간다
  const m = prev.split(/[?#]/)[0]!.match(/^\/countries\/([a-z]{3})$/)
  const c = m && zone.countries.find((x) => x.iso3 === m[1]!.toUpperCase())
  if (c) back.value = { to: prev, label: c.nameKr }
})

const sheetOpen = ref(false)
// 구매 시트 값(요약 · K1 최종가 · 옵션명 · 링크)은 순수 함수 하나에서 — picker.test 가 K1 원본과 대조한다
const purchase = computed(() => purchaseSheetProps(zone, sel.value))
</script>

<template>
  <div class="product">
    <div class="product__top">
      <NuxtLink :to="back.to" class="product__back">
        <ChevronLeftIcon aria-hidden="true" />
        {{ back.label }}
      </NuxtLink>
      <img
        class="product__hero"
        :src="heroSrc"
        :alt="heroAlt"
        width="400"
        height="400"
        fetchpriority="high"
      />
      <div class="product__badges">
        <span v-if="countBadge" class="product__badge">{{ zone.countries.length }}개국</span>
        <span v-for="b in HERO_BADGES" :key="b" class="product__badge">{{ b }}</span>
      </div>
      <h1 class="product__title">{{ zone.label }} eSIM</h1>
      <p class="product__lead">{{ heroLead(zone, kind) }}</p>
      <ul class="product__checks">
        <li v-for="line in heroChecks(zone, kind)" :key="line">{{ line }}</li>
      </ul>

      <section class="product__picker" aria-label="상품 고르기">
        <UnderlineTabs
          v-if="kindTabs.length > 1"
          v-model="kind"
          :tabs="kindTabs"
          label="요금 종류"
          id-prefix="kind"
        />
        <div
          id="kind-panel"
          :role="kindTabs.length > 1 ? 'tabpanel' : undefined"
          :aria-labelledby="kindTabs.length > 1 ? `kind-tab-${kind}` : undefined"
        >
          <label for="period" class="product__label">사용 기간</label>
          <PeriodSelect id="period" v-model="days" :days="periods" :disabled="kind === 'L'" />
          <p class="product__hint">{{ periodHint(kind, periods) }}</p>
          <h2 id="cap-label" class="product__label">데이터 용량</h2>
          <PlanCards v-model="cap" name="cap" :kind="kind" :cards="cards" labelledby="cap-label" />
        </div>
      </section>
    </div>

    <ProductSections :zone="zone" :kind="kind" />

    <div class="product__buybar">
      <button type="button" class="product__buy" :disabled="!option" @click="sheetOpen = true">
        구매하기
      </button>
    </div>

    <PurchaseSheet v-if="purchase" v-model="sheetOpen" v-bind="purchase" />
  </div>
</template>

<style>
html.has-shell-chrome.has-buybar {
  scroll-padding-bottom: calc(
    var(--shell-tabbar-height, 56px) + env(safe-area-inset-bottom) + 73px + 8px
  );
}
</style>

<style scoped>
.product {
  display: flex;
  flex-direction: column;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.product__top {
  display: flex;
  flex-direction: column;
  padding: 16px 20px 24px;
}

.product__back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 2px;
  margin-left: -4px;
  color: var(--n-color-neutral-600, #525252);
  font-size: 14.5px;
  text-decoration: none;
}

.product__back svg {
  width: 20px;
  height: 20px;
}

.product__hero {
  width: 100%;
  height: auto;
  margin-top: 10px;
  border-radius: 18px;
  aspect-ratio: 1;
  object-fit: cover;
  background: var(--n-color-neutral-100, #f5f5f5);
}

.product__badges {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 16px;
}

.product__badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--n-color-primary-50, #f1edff);
  color: var(--n-color-primary-600, #5025e8);
  font-size: 12px;
  font-weight: 700;
}

.product__title {
  margin: 10px 0 2px;
  font-size: 23px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
}

.product__lead {
  margin: 0 0 10px;
  font-size: 14.5px;
  color: var(--n-color-neutral-600, #525252);
}

.product__checks {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.product__checks li {
  position: relative;
  padding-left: 24px;
  font-size: 14.5px;
  color: var(--n-color-neutral-800, #262626);
}

.product__checks li::before {
  content: '';
  position: absolute;
  top: 5px;
  left: 3px;
  width: 11px;
  height: 6px;
  border-bottom: 2.4px solid var(--n-color-primary-500, #6239ff);
  border-left: 2.4px solid var(--n-color-primary-500, #6239ff);
  transform: rotate(-45deg);
}

.product__picker {
  margin-top: 24px;
}

.product__label {
  display: block;
  margin: 20px 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--n-color-neutral-600, #525252);
}

.product__hint {
  margin: 8px 0 0;
  font-size: 12.5px;
  color: var(--n-color-neutral-500, #737373);
  text-wrap: pretty;
}

/* 탭바(fixed · 1030) 바로 위에 붙는다 — 헤더(1020)보다 위, DS 오버레이(1040/1050)보다 아래 */
.product__buybar {
  position: sticky;
  bottom: calc(var(--shell-tabbar-height, 56px) + env(safe-area-inset-bottom));
  z-index: 1025;
  padding: 10px 20px;
  border-top: 1px solid var(--n-color-neutral-200, #e5e5e5);
  background: var(--n-color-neutral-0, #fff);
}

.product__buy {
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 14px;
  background: var(--n-color-primary-500, #6239ff);
  color: #fff;
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.product__buy:disabled {
  background: var(--n-color-neutral-300, #d4d4d4);
  cursor: default;
}

.product__buy:focus-visible {
  outline: 2px solid var(--n-color-primary-700, #3f1cc0);
  outline-offset: 2px;
}
</style>
