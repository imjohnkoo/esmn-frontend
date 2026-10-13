<script setup lang="ts">
// 아이폰 설치 확인 (client-guide-check spec S-1) — 문안 app/content/guide/check.ts · 현지 도착 뒤 설정을 화면과 비교
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideCheckArticle from '~/components/guide/GuideCheckArticle.vue'
import { CHECK_IOS } from '~/content/guide/check'

useCatalogSeo({ title: CHECK_IOS.title, description: STATIC_DESCRIPTIONS['/guide/check/ios'] })
</script>

<template>
  <GuideCheckArticle :content="CHECK_IOS" />
</template>
