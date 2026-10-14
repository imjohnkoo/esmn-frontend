<script setup lang="ts">
// 안드로이드 설치 확인 (client-guide-check spec S-2) — 문안 app/content/guide/check.ts · 갤럭시 기준
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideCheckArticle from '~/components/guide/GuideCheckArticle.vue'
import { CHECK_ANDROID } from '~/content/guide/check'

useCatalogSeo({ title: CHECK_ANDROID.title, description: STATIC_DESCRIPTIONS['/guide/check/android'] })
</script>

<template>
  <GuideCheckArticle :content="CHECK_ANDROID" />
</template>
