<script setup lang="ts">
// 안드로이드(갤럭시 기준) 설치 가이드 (client-guide spec S-3) — 문안 app/content/guide/android.ts · 화면 public/guide-screens/
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideArticle from '~/components/guide/GuideArticle.vue'
import { ANDROID_GUIDE } from '~/content/guide/android'

useCatalogSeo({ title: ANDROID_GUIDE.title, description: STATIC_DESCRIPTIONS['/guide/android'] })
</script>

<template>
  <GuideArticle :content="ANDROID_GUIDE" />
</template>
