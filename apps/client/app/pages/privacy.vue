<script setup lang="ts">
// 법정 문서(client-shell spec F-12 · F-20) — 본문은 app/content/legal/privacy.ts(legal-import 생성물). 색인 허용.
import LegalMarkdown from '~/components/legal/LegalMarkdown.vue'
import { PRIVACY_DOC } from '~/content/legal/privacy'

// main 의 app.vue 에는 lang 이 없다(W1-2 가 app.vue 에서 넣는다) — 법정 페이지는 스스로 넣는다
useHead({ htmlAttrs: { lang: 'ko' }, title: PRIVACY_DOC.title })
</script>

<template>
  <LegalMarkdown :doc="PRIVACY_DOC" />
</template>
