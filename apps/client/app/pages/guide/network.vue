<script setup lang="ts">
// 현지 통신사 바꾸기 (client-guide-check spec S-3) — 아이폰 · 안드로이드 한 페이지(D-10) · 문안 app/content/guide/check.ts
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideCheckArticle from '~/components/guide/GuideCheckArticle.vue'
import { NETWORK_GUIDE } from '~/content/guide/check'

useCatalogSeo({ title: NETWORK_GUIDE.title, description: STATIC_DESCRIPTIONS['/guide/network'] })
</script>

<template>
  <GuideCheckArticle :content="NETWORK_GUIDE" />
</template>
