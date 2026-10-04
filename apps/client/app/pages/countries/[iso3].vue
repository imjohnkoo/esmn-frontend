<script setup lang="ts">
// 국가 페이지(catalog spec S-3 · F-5) — 그 나라가 들어간 zone 카드. 단일국 먼저 → 여러 나라(국가 수 오름차순).
// URL 은 소문자(D-13 · catalog-path 미들웨어가 대문자를 301), 판매하지 않는 나라 · 모르는 코드는 404.
import { ChevronLeftIcon } from '@heroicons/vue/24/outline'
import { thumbUrl, type AssetManifest } from '#shared/catalog/assets'
import type { CountryPageData } from '#shared/catalog/pages'
import FlagIcon from '~/components/catalog/FlagIcon.vue'
import ZoneCard from '~/components/catalog/ZoneCard.vue'
import manifest from '~/content/catalog-assets.json'
import { catalogPageError, isCatalogParam } from '~/utils/catalog-path'

definePageMeta({ middleware: 'catalog-path' })

const route = useRoute()
const param = String(route.params.iso3 ?? '')
if (!isCatalogParam('countries', param))
  throw createError({ statusCode: 404, statusMessage: 'Not Found', fatal: true })

const { data, error } = await useFetch<CountryPageData>(`/api/catalog/countries/${param}`, {
  key: `catalog-country-${param}`,
})
// 판매하지 않는 나라는 404, 데이터 라우트의 그 밖의 오류는 500 — 서버 오류를 404 로 덮지 않는다(F-10)
const failed = catalogPageError(error.value, !!data.value)
if (failed)
  throw createError({
    statusCode: failed,
    statusMessage: failed === 404 ? 'Not Found' : 'Catalog country unavailable',
    fatal: true,
  })

const page = data.value! // catalogPageError 가 없는 데이터를 이미 걸렀다
const count = page.single.length + page.multi.length
useCatalogSeo(
  page.meta,
  thumbUrl(manifest as AssetManifest, (page.single[0] ?? page.multi[0])!.thumb),
)
</script>

<template>
  <div class="country-page">
    <NuxtLink to="/" class="country-page__back">
      <ChevronLeftIcon aria-hidden="true" />
      홈
    </NuxtLink>
    <h1 class="country-page__title">
      <FlagIcon :iso2="page.country.iso2" :size="28" />
      {{ page.country.nameKr }} eSIM
    </h1>
    <p class="country-page__lead">{{ page.country.nameKr }}에서 쓸 수 있는 상품 {{ count }}개</p>

    <section v-if="page.single.length" aria-labelledby="country-single">
      <h2 id="country-single" class="country-page__group">{{ page.country.nameKr }}만 가요</h2>
      <ul class="country-page__list">
        <li v-for="c in page.single" :key="c.zone"><ZoneCard :card="c" /></li>
      </ul>
    </section>

    <section v-if="page.multi.length" aria-labelledby="country-multi">
      <h2 id="country-multi" class="country-page__group">여러 나라를 함께 가요</h2>
      <ul class="country-page__list">
        <li v-for="c in page.multi" :key="c.zone"><ZoneCard :card="c" /></li>
      </ul>
    </section>

    <p class="country-page__hint">가격은 가장 짧은 기간 · 가장 작은 용량 기준이에요.</p>
  </div>
</template>

<style scoped>
.country-page {
  display: flex;
  flex-direction: column;
  padding: 16px 20px 32px;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.country-page__back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 2px;
  margin-left: -4px;
  color: var(--n-color-neutral-600, #525252);
  font-size: 14.5px;
  text-decoration: none;
}

.country-page__back svg {
  width: 20px;
  height: 20px;
}

.country-page__title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 12px 0 0;
  font-size: 23px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
}

.country-page__lead {
  margin: 4px 0 0;
  font-size: 14.5px;
  color: var(--n-color-neutral-600, #525252);
}

.country-page__group {
  margin: 24px 0 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--n-color-neutral-600, #525252);
}

.country-page__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.country-page__hint {
  margin: 16px 0 0;
  font-size: 12.5px;
  color: var(--n-color-neutral-500, #737373);
}
</style>
