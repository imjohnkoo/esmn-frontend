<script setup lang="ts">
// 사업자정보 푸터(client-shell spec F-7 · D-11) — 모든 라우트에 펼친 채 상시(PG 심사 «상시 노출»). 접지 않는다.
// 블록 = legal-pages 04 1절 줄 그대로(생성물 content/legal/business.ts — 공정위 «사업자정보확인» 링크 포함) + 링크 줄 + ©.
// 링크 줄의 개인정보처리방침은 굵게 · 색으로 구분(처리방침 작성지침). compact = flow 레이아웃(4-step · 체크아웃) — 여백만 줄인다.
// support = 판매 화면(default 레이아웃)만 — 맨 위 고객센터 번호 · 운영 시간(spec D-57 · flow 레이아웃 = app.esimmany.com 발급 흐름에는 없다).
import { BUSINESS_INFO } from '~/content/legal/business'
import { SUPPORT_HOURS, SUPPORT_PHONE } from '~/content/support'
import { footerParts, renderBusinessLines } from '~/utils/legal-render'
import { LEGAL_LINKS } from '~/utils/shell-nav'

defineProps<{ compact?: boolean; support?: boolean }>()

// 링크 줄은 LEGAL_LINKS(라벨 · 차례 = 04 1절 링크 줄 — legal-content.test.ts 가 대조)로 그린다
const { lines, copyright } = footerParts(BUSINESS_INFO)
</script>

<template>
  <footer class="site-footer" :class="{ 'site-footer--compact': compact }">
    <div v-if="support" class="site-footer__cs">
      <p class="site-footer__cs-title">
        <span>고객센터</span>
        <a :href="`tel:${SUPPORT_PHONE}`" class="site-footer__cs-phone">{{ SUPPORT_PHONE }}</a>
      </p>
      <p class="site-footer__cs-hours">{{ SUPPORT_HOURS }}</p>
    </div>

    <nav class="site-footer__links" aria-label="약관 및 정책">
      <NuxtLink
        v-for="link in LEGAL_LINKS"
        :key="link.to"
        :to="link.to"
        class="site-footer__link"
        :class="{ 'site-footer__link--privacy': link.to === '/privacy' }"
      >
        {{ link.label }}
      </NuxtLink>
    </nav>

    <component :is="renderBusinessLines(lines)" />

    <p class="site-footer__copy">{{ copyright }}</p>
  </footer>
</template>

<style scoped>
.site-footer {
  padding: 28px 20px 24px;
  background: var(--n-color-neutral-50, #fafafa);
  border-top: 1px solid var(--n-color-neutral-100, #f5f5f5);
  color: var(--n-color-neutral-500, #737373);
  font-size: 12px;
  line-height: 1.7;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.site-footer--compact {
  padding: 20px 20px 18px;
}

.site-footer__cs {
  margin-bottom: 16px;
}

.site-footer__cs-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 8px;
  margin: 0;
  color: var(--n-color-neutral-800, #262626);
  font-size: 15px;
  font-weight: 800;
  line-height: 24px;
}

.site-footer__cs-phone {
  color: inherit;
  font-variant-numeric: tabular-nums;
  text-decoration: none;
}

.site-footer__cs-phone:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.site-footer__cs-hours {
  margin: 0;
}

.site-footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  margin-bottom: 12px;
}

.site-footer__link {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  color: var(--n-color-neutral-700, #404040);
  font-weight: 600;
  text-decoration: none;
}

.site-footer__link--privacy {
  color: var(--n-color-primary-600, #5025e8);
  font-weight: 800;
}

.site-footer__link:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.site-footer :deep(.site-footer__line) {
  margin: 0;
}

.site-footer :deep(.legal-md__link) {
  color: var(--n-color-neutral-700, #404040);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.site-footer :deep(.legal-md__pending),
.site-footer :deep(.legal-md__nb) {
  white-space: nowrap;
}

.site-footer__copy {
  margin: 12px 0 0;
  color: var(--n-color-neutral-500, #737373);
}
</style>
