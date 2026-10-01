<script setup lang="ts">
// 사업자정보(client-shell spec F-12 · S-4) — 정본 04 2절 표(legal-import 생성물) + 공정위 사업자정보 조회.
// 조회 주소는 푸터와 같은 생성물(04 1절 «사업자정보확인» 링크)에서 읽는다 — 주소의 출처를 하나로.
import LegalMarkdown from '~/components/legal/LegalMarkdown.vue'
import { BUSINESS_INFO } from '~/content/legal/business'
import { BUSINESS_DOC } from '~/content/legal/business-page'
import { ftcCheckUrl } from '~/utils/legal-render'

useHead({ title: BUSINESS_DOC.title })

const ftcUrl = ftcCheckUrl(BUSINESS_INFO.registration)
</script>

<template>
  <div class="business-page">
    <LegalMarkdown :doc="BUSINESS_DOC" />
    <p v-if="ftcUrl" class="business-page__ftc">
      <a :href="ftcUrl" target="_blank" rel="noopener"
        >사업자정보확인<span class="sr-only"> (새 창)</span></a
      >
    </p>
  </div>
</template>

<style scoped>
.business-page__ftc {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: -32px 20px 48px;
  font-size: 14px;
}

.business-page__ftc a {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  color: var(--n-color-primary-600, #5025e8);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
