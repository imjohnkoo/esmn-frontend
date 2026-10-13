<script setup lang="ts">
// 나라별 현지 통신사 — 전용판(client-guide-check S-5) · canonical = /guide/carriers(client-guide D-18 규칙) · 같은 데이터 라우트 · 같은 key
import type { CarrierGroup } from '#shared/catalog/pages'
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideCarriers from '~/components/guide/GuideCarriers.vue'
import GuideCheckArticle from '~/components/guide/GuideCheckArticle.vue'
import { CARRIERS_GUIDE } from '~/content/guide/check'
import { GUIDE_CARRIERS } from '~/content/guide/common'

definePageMeta({ layout: 'flow' })
useCatalogSeo(
  { title: CARRIERS_GUIDE.title, description: STATIC_DESCRIPTIONS['/guide/carriers'] },
  undefined,
  GUIDE_CARRIERS.page,
)

const { data: groups, error } = await useFetch<CarrierGroup[]>('/api/catalog/carriers', {
  key: 'catalog-carriers',
})
if (error.value || !groups.value)
  throw createError({ statusCode: 500, statusMessage: 'Carriers unavailable', fatal: true })
</script>

<template>
  <GuideCheckArticle :content="CARRIERS_GUIDE" mode="bare">
    <GuideCarriers :groups="groups!" />
  </GuideCheckArticle>
</template>
