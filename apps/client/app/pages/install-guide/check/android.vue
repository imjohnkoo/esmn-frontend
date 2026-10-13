<script setup lang="ts">
// 안드로이드 설치 확인 — 전용판(client-guide-check S-5) · canonical = /guide/check/android(client-guide D-18 규칙)
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideCheckArticle from '~/components/guide/GuideCheckArticle.vue'
import { CHECK_ANDROID } from '~/content/guide/check'
import { GUIDE_CHECK } from '~/content/guide/common'

definePageMeta({ layout: 'flow' })
useCatalogSeo(
  { title: CHECK_ANDROID.title, description: STATIC_DESCRIPTIONS['/guide/check/android'] },
  undefined,
  GUIDE_CHECK.android.page,
)
</script>

<template>
  <GuideCheckArticle :content="CHECK_ANDROID" mode="bare" />
</template>
