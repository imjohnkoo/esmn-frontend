<script setup lang="ts">
// 지원 기기 — 전용판(client-guide D-24): 사이트 헤더 · 하단 탭 없이 본문만(flow 레이아웃 — 사업자정보 푸터 작은 판은 K5 상시).
// 가이드 전용판 · 발급 화면 시트의 «지원 기기 확인하기» 가 연다(메뉴 없는 화면에서 연 링크). 템플릿 · 스타일은 /supported-devices 와
// 한 글자도 다르지 않게(테스트가 두 파일의 template · style 과 그린 DOM 을 대조한다 — 사이트판을 고치면 여기도) —
// canonical 은 사이트판 하나(noindex 없음 · sitemap 제외 — D-18 과 같은 이유) · 설명도 사이트판
import { NPageHeading } from '@imjohnkoo/design-vue'
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
// 환불 안내는 05-A 14행(client-shell spec D-32 — 약관 12조③ 과 같은 말)
import { ISSUE_NOTICE } from '~/content/legal/issue-notice'
import SupportedDevicesContent from '~/components/devices/SupportedDevicesContent.vue'
import { DEVICES_PAGE } from '~/content/guide/common'

definePageMeta({ layout: 'flow' })
useCatalogSeo(
  { title: '지원 기기', description: STATIC_DESCRIPTIONS[DEVICES_PAGE] },
  undefined,
  DEVICES_PAGE,
)
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
