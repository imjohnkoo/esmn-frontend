<script setup lang="ts">
// 취소·환불 정책(client-shell spec F-12 · S-4) — 본문은 app/content/legal/refund.ts(legal-import 생성물 · 정본 03). 색인 허용.
import LegalMarkdown from '~/components/legal/LegalMarkdown.vue'
import { REFUND_DOC } from '~/content/legal/refund'

useHead({ title: REFUND_DOC.title })
</script>

<template>
  <LegalMarkdown :doc="REFUND_DOC" />
</template>
