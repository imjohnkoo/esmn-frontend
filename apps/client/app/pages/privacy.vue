<script setup lang="ts">
// 법정 문서(client-shell spec F-12 · F-20) — 본문은 app/content/legal/privacy.ts(legal-import 생성물). 색인 허용.
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import LegalMarkdown from '~/components/legal/LegalMarkdown.vue'
import { PRIVACY_DOC } from '~/content/legal/privacy'

// lang 은 법정 페이지가 스스로도 넣는다(F-20 — app.vue 와 겹쳐도 무해)
useHead({ htmlAttrs: { lang: 'ko' } })
// canonical · 설명 — sitemap 에 든 정적 페이지(catalog F-9 · QA ⑥ R11)
useCatalogSeo({ title: PRIVACY_DOC.title, description: STATIC_DESCRIPTIONS['/privacy'] })
</script>

<template>
  <LegalMarkdown :doc="PRIVACY_DOC" />
</template>
