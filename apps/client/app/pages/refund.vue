<script setup lang="ts">
// 법정 문서(client-shell spec F-12 · D-50) — 본문은 app/content/legal/refund.ts(legal-import 생성물). 색인 허용.
// 발급 확인 팝업의 동의 문구 링크(href)가 가리킨다 — 화면에서는 하단 시트로 열리고(D-45) 새 탭 · 주소 복사로 오면 이 페이지
import LegalMarkdown from '~/components/legal/LegalMarkdown.vue'
import { REFUND_DOC } from '~/content/legal/refund'

// main 의 app.vue 에는 lang 이 없다(W1-2 가 app.vue 에서 넣는다) — 법정 페이지는 스스로 넣는다
useHead({ htmlAttrs: { lang: 'ko' }, title: REFUND_DOC.title })
</script>

<template>
  <LegalMarkdown :doc="REFUND_DOC" />
</template>
