<script setup lang="ts">
// 아이폰 설치 확인 — 전용판(client-guide-check S-5): 사이트 헤더 · 하단 탭 없이 본문만(flow 레이아웃 — 사업자정보 푸터 작은 판은 K5 상시).
// 글은 /guide/check/ios 와 같다 — canonical 은 사이트판 하나(noindex 없음 · sitemap 제외 — client-guide D-18) · 설명도 사이트판
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideCheckArticle from '~/components/guide/GuideCheckArticle.vue'
import { CHECK_IOS } from '~/content/guide/check'
import { GUIDE_CHECK } from '~/content/guide/common'

definePageMeta({ layout: 'flow' })
useCatalogSeo(
  { title: CHECK_IOS.title, description: STATIC_DESCRIPTIONS['/guide/check/ios'] },
  undefined,
  GUIDE_CHECK.ios.page,
)
</script>

<template>
  <GuideCheckArticle :content="CHECK_IOS" mode="bare" />
</template>
