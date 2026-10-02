<script setup lang="ts">
// 발급기 사업자정보 · 법정 링크(client-shell spec F-20 · D-36 — 약관 3조① · 개인정보 보호법 시행령 31조).
// ⏳ 임시 — W1-2 홈 · 푸터(F-7)를 main 에 머지할 때 이 블록을 걷어 낸다. 줄 콘텐츠(app/content/legal/business.ts)는 푸터가 그대로 쓴다.
// 그리는 규칙은 utils/legal-render.ts 의 renderBusinessInfo(테스트가 실콘텐츠를 서버 렌더로 확인).
import { BUSINESS_INFO } from '../../content/legal/business'
import { renderBusinessInfo } from '../../utils/legal-render'
</script>

<template>
  <component :is="renderBusinessInfo(Object.values(BUSINESS_INFO))" />
</template>

<style>
.issuer-biz {
  width: 100%;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid var(--n-color-neutral-200, #e5e5e5);
  color: var(--n-color-neutral-500, #737373);
  font-size: 12px;
  line-height: 1.7;
  text-align: left;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.issuer-biz__line {
  margin: 0;
}

.issuer-biz .legal-md__link {
  color: var(--n-color-neutral-600, #525252);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.issuer-biz .legal-md__pending,
.issuer-biz .legal-md__nb {
  white-space: nowrap;
}

/* 새 창 안내(화면 낭독기 전용) — 이 화면에는 LegalMarkdown 스타일이 실리지 않으므로 여기에도 둔다 */
.issuer-biz .legal-md__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

.issuer-biz__links {
  margin: 10px 0 0;
}

.issuer-biz__link {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  color: var(--n-color-neutral-600, #525252);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.issuer-biz__link--privacy {
  color: var(--n-color-primary-600, #5025e8);
  font-weight: 700;
}
</style>
