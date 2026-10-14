<script setup lang="ts">
// 현지 통신사 바꾸기 — 전용판(client-guide-check S-5) · canonical = /guide/network(client-guide D-18 규칙)
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideCheckArticle from '~/components/guide/GuideCheckArticle.vue'
import { NETWORK_GUIDE } from '~/content/guide/check'
import { GUIDE_NETWORK } from '~/content/guide/common'

definePageMeta({ layout: 'flow' })
useCatalogSeo(
  { title: NETWORK_GUIDE.title, description: STATIC_DESCRIPTIONS['/guide/network'] },
  undefined,
  GUIDE_NETWORK.page,
)
</script>

<template>
  <GuideCheckArticle :content="NETWORK_GUIDE" mode="bare" />
</template>
