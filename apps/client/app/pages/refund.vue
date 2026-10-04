<script setup lang="ts">
// 취소·환불 정책(client-shell spec F-12 · S-4) — 본문은 app/content/legal/refund.ts(legal-import 생성물 · 정본 03). 색인 허용.
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import LegalMarkdown from '~/components/legal/LegalMarkdown.vue'
import { REFUND_DOC } from '~/content/legal/refund'

// canonical · 설명 — sitemap 에 든 정적 페이지(catalog F-9 · QA ⑥ R11)
useCatalogSeo({ title: REFUND_DOC.title, description: STATIC_DESCRIPTIONS['/refund'] })
</script>

<template>
  <LegalMarkdown :doc="REFUND_DOC" />
</template>
