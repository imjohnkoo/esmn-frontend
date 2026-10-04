<script setup lang="ts">
// eSIM 지원 기기 목록 — 근거: nomacom-wiki wiki/frontend/reference/2026-10-04-esim-supported-devices-kr.md(웹 검증 · spec D-55)
import { NPageHeading } from '@imjohnkoo/design-vue'
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
// 환불 안내는 05-A 14행(client-shell spec D-32 — 약관 12조③ 과 같은 말)
import { ISSUE_NOTICE } from '~/content/legal/issue-notice'
import SupportedDevicesContent from '~/components/devices/SupportedDevicesContent.vue'

// canonical · 설명 — sitemap 에 든 정적 페이지(catalog F-9 · QA ⑥ R11)
useCatalogSeo({ title: '지원 기기', description: STATIC_DESCRIPTIONS['/supported-devices'] })
</script>

<template>
  <div class="devices-page">
    <div class="devices-page__heading">
      <NPageHeading
        eyebrow="eSIM 지원 기기"
        :title="`내 기기가 eSIM 을\n지원하는지 확인해 주세요`"
        :description="`한국 정식 발매 기기 기준이에요. 발급 전에 꼭 확인해 주세요.\n${ISSUE_NOTICE.refund}`"
      />
    </div>

    <SupportedDevicesContent />
  </div>
</template>

<style scoped>
.devices-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 24px 24px 48px;
  background: #ffffff;
}
</style>
