<script setup lang="ts">
// 나라별 현지 통신사 (client-guide-check spec S-4) — 데이터는 페이지 전용 라우트(카탈로그 K1 operators · network — D-15)
import type { CarrierGroup } from '#shared/catalog/pages'
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideCarriers from '~/components/guide/GuideCarriers.vue'
import GuideCheckArticle from '~/components/guide/GuideCheckArticle.vue'
import { CARRIERS_GUIDE } from '~/content/guide/check'

useCatalogSeo({ title: CARRIERS_GUIDE.title, description: STATIC_DESCRIPTIONS['/guide/carriers'] })

const { data: groups, error } = await useFetch<CarrierGroup[]>('/api/catalog/carriers', {
  key: 'catalog-carriers',
})
// 목록이 없으면 빈 페이지 대신 500(프리렌더 실패 — /search 와 같은 fail-closed)
if (error.value || !groups.value?.length)
  throw createError({ statusCode: 500, statusMessage: 'Carriers unavailable', fatal: true })
</script>

<template>
  <GuideCheckArticle :content="CARRIERS_GUIDE">
    <GuideCarriers :groups="groups!" />
  </GuideCheckArticle>
</template>
