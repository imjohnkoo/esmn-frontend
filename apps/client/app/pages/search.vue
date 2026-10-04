<script setup lang="ts">
// 국가 검색 (catalog spec S-2 · F-4) — 입력할 때마다 결과(색인은 프리렌더 payload). noindex(D-12).
// 매칭 규칙은 shared/catalog/search.ts(D-9), 상품 없는 나라는 «준비 중» 행 · 링크 없음(D-10).
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import { searchCountries, type SearchEntry, type SearchHit } from '#shared/catalog/search'
import { josa } from '#shared/utils/josa'
import FlagIcon from '~/components/catalog/FlagIcon.vue'
import SearchField from '~/components/catalog/SearchField.vue'
import { pickChips } from '~/utils/error-view'

useHead({ title: '국가 검색' })

const { data: index, error } = await useFetch<SearchEntry[]>('/api/catalog/search-index', {
  key: 'catalog-search-index',
})
// 색인이 없으면 모든 입력에 «찾지 못했어요» 가 뜬다 — 빈 화면 대신 500(프리렌더 실패)
if (error.value || !index.value)
  throw createError({ statusCode: 500, statusMessage: 'Search index unavailable', fatal: true })
const query = ref('')

const entries = computed(() => index.value!)
const hits = computed<SearchHit[]>(() => searchCountries(entries.value, query.value))
const trimmed = computed(() => query.value.trim())
// 인기 칩 8 — 오류 화면(S-7)과 같은 함수 · 같은 목록
const popular = computed(() => pickChips(entries.value).popular)
const allCountries = computed(() => entries.value.filter((e) => !e.upcoming))
const hasUpcoming = computed(() => hits.value.some((h) => h.entry.upcoming))

function note(hit: SearchHit): string {
  if (hit.entry.upcoming) return '아직 판매하지 않는 나라예요'
  if (hit.via === 'city' && hit.city)
    return `도시 «${hit.city}» ${josa(hit.city, '이/가')} 있는 나라`
  return ''
}
function countryPath(e: { iso3: string }) {
  return `/countries/${e.iso3.toLowerCase()}`
}
</script>

<template>
  <div class="search-page">
    <h1 class="sr-only">국가 검색</h1>
    <SearchField v-model="query" autofocus />

    <p class="sr-only" aria-live="polite">
      {{ trimmed ? (hits.length ? `결과 ${hits.length}개` : '결과가 없어요') : '' }}
    </p>

    <template v-if="trimmed">
      <template v-if="hits.length">
        <h2 class="search-page__label">검색 결과</h2>
        <ul class="search-page__list">
          <li v-for="hit in hits" :key="hit.entry.iso3">
            <div v-if="hit.entry.upcoming" class="search-page__row search-page__row--off">
              <FlagIcon :iso2="hit.entry.iso2" :size="28" />
              <span class="search-page__text">
                <span class="search-page__name">{{ hit.entry.ko }}</span>
                <span class="search-page__note">{{ note(hit) }}</span>
              </span>
              <span class="search-page__badge">준비 중</span>
            </div>
            <NuxtLink v-else :to="countryPath(hit.entry)" class="search-page__row">
              <FlagIcon :iso2="hit.entry.iso2" :size="28" />
              <span class="search-page__text">
                <span class="search-page__name">{{ hit.entry.ko }}</span>
                <span v-if="note(hit)" class="search-page__note">{{ note(hit) }}</span>
              </span>
              <span class="search-page__count">상품 {{ hit.entry.zoneCount }}개</span>
              <ChevronRightIcon class="search-page__chev" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
        <p v-if="hasUpcoming" class="search-page__hint">
          궁금한 점은 <NuxtLink to="/my#cs" class="search-page__link">고객센터</NuxtLink>로 물어봐
          주세요.
        </p>
      </template>
      <div v-else class="search-page__empty">
        <p class="search-page__empty-title">
          «{{ trimmed }}» {{ josa(trimmed, '은/는') }} 찾지 못했어요
        </p>
        <p class="search-page__empty-sub">나라 이름을 다시 확인해 주세요.</p>
      </div>
    </template>

    <template v-else>
      <h2 class="search-page__label">인기 국가</h2>
      <ul class="search-page__chips">
        <li v-for="e in popular" :key="e.iso3">
          <NuxtLink :to="countryPath(e)" class="search-page__chip">
            <FlagIcon :iso2="e.iso2" :size="18" />
            {{ e.ko }}
          </NuxtLink>
        </li>
      </ul>
      <h2 class="search-page__label">전체 국가</h2>
      <ul class="search-page__list">
        <li v-for="e in allCountries" :key="e.iso3">
          <NuxtLink :to="countryPath(e)" class="search-page__row search-page__row--compact">
            <FlagIcon :iso2="e.iso2" :size="24" />
            <span class="search-page__name">{{ e.ko }}</span>
            <ChevronRightIcon class="search-page__chev" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  padding: 20px 20px 32px;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.search-page__label {
  margin: 24px 0 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--n-color-neutral-600, #525252);
}

.search-page__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.search-page__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 2px;
  border-bottom: 1px solid var(--n-color-neutral-100, #f5f5f5);
  color: inherit;
  text-decoration: none;
}

.search-page__row--compact {
  padding: 10px 2px;
}

.search-page__row--off .search-page__name {
  color: var(--n-color-neutral-500, #737373);
}

.search-page__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.search-page__name {
  flex: 1;
  font-size: 15.5px;
  font-weight: 700;
  color: var(--n-color-neutral-900, #171717);
}

.search-page__note {
  font-size: 12.5px;
  color: var(--n-color-neutral-600, #525252);
}

.search-page__count {
  font-size: 13px;
  color: var(--n-color-neutral-500, #737373);
}

.search-page__badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--n-color-neutral-100, #f5f5f5);
  color: var(--n-color-neutral-600, #525252);
  font-size: 11.5px;
  font-weight: 700;
}

.search-page__chev {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: var(--n-color-neutral-300, #d4d4d4);
}

.search-page__hint {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--n-color-neutral-600, #525252);
}

.search-page__link {
  color: var(--n-color-primary-600, #5025e8);
  font-weight: 600;
}

.search-page__empty {
  padding: 32px 12px 8px;
  text-align: center;
}

.search-page__empty-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--n-color-neutral-800, #262626);
}

.search-page__empty-sub {
  margin: 4px 0 0;
  font-size: 14px;
  color: var(--n-color-neutral-600, #525252);
}

.search-page__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.search-page__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 38px;
  padding: 0 14px;
  border: 1px solid var(--n-color-neutral-300, #d4d4d4);
  border-radius: 999px;
  color: var(--n-color-neutral-800, #262626);
  font-size: 14px;
  text-decoration: none;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}
</style>
