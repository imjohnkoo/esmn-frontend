<script setup lang="ts">
// 아이폰 설치 가이드 — 전용판(client-guide D-14 · S-5): 사이트 헤더 · 하단 탭 없이 가이드 본문만(flow 레이아웃 — 사업자정보 푸터 작은 판은 K5 상시).
// 사이트 밖에서 거는 가이드 링크용. 글은 /guide/ios 와 같다 — 검색 제외(shared/utils/robots.ts) · 설명 · canonical 은 사이트판
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideArticle from '~/components/guide/GuideArticle.vue'
import { GUIDE_PAGES } from '~/content/guide/common'
import { IOS_GUIDE } from '~/content/guide/ios'

definePageMeta({ layout: 'flow' })
useCatalogSeo(
  { title: IOS_GUIDE.title, description: STATIC_DESCRIPTIONS['/guide/ios'] },
  undefined,
  GUIDE_PAGES.ios.to,
)
</script>

<template>
  <GuideArticle :content="IOS_GUIDE" mode="bare" />
</template>
