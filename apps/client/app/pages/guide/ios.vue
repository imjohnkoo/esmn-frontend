<script setup lang="ts">
// 아이폰 설치 가이드 (client-guide spec S-2) — 문안 app/content/guide/ios.ts · 화면 public/guide-screens/
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideArticle from '~/components/guide/GuideArticle.vue'
import { IOS_GUIDE } from '~/content/guide/ios'

useCatalogSeo({ title: IOS_GUIDE.title, description: STATIC_DESCRIPTIONS['/guide/ios'] })
</script>

<template>
  <GuideArticle :content="IOS_GUIDE" />
</template>
