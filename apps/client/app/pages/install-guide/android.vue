<script setup lang="ts">
// 안드로이드(갤럭시 기준) 설치 가이드 — 전용판(client-guide D-14 · S-5): 사이트 헤더 · 하단 탭 없이 가이드 본문만(flow 레이아웃 — 사업자정보 푸터 작은 판은 K5 상시).
// 사이트 밖에서 거는 가이드 링크용. 글은 /guide/android 와 같다 — canonical 은 사이트판 하나(noindex 없음 · sitemap 제외 — D-18) · 설명도 사이트판
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideArticle from '~/components/guide/GuideArticle.vue'
import { GUIDE_PAGES } from '~/content/guide/common'
import { ANDROID_GUIDE } from '~/content/guide/android'

definePageMeta({ layout: 'flow' })
useCatalogSeo(
  { title: ANDROID_GUIDE.title, description: STATIC_DESCRIPTIONS['/guide/android'] },
  undefined,
  GUIDE_PAGES.android.to,
)
</script>

<template>
  <GuideArticle :content="ANDROID_GUIDE" mode="bare" />
</template>
