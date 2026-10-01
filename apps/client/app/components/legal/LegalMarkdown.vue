<script setup lang="ts">
// 법정 문서 렌더(client-shell spec F-12 · F-20) — 게시용 마크다운(app/content/legal/*.ts)을 그대로 그린다.
// 그리는 규칙은 utils/legal-render.ts 의 renderDoc(테스트가 실문서를 서버 렌더로 확인). HTML 해석 없음 — v-html 금지.
// 조판: 어절 보존 · 제목 balance · 문단 pretty · 줄간격 1.6 이상 · 번호 항 · 글머리표는 보이게(전역 리셋이 끈다).
// 스타일은 scoped 가 아니다 — 요소를 전부 renderDoc 이 만들어 scoped 속성이 붙지 않는다(클래스 접두사 legal-md 로 한정).
import type { LegalMarkdownDoc } from '../../utils/legal-markdown'
import { renderDoc } from '../../utils/legal-render'

defineProps<{ doc: LegalMarkdownDoc }>()
</script>

<template>
  <component :is="renderDoc(doc)" />
</template>

<style>
.legal-md {
  padding: 24px 20px 48px;
  color: var(--n-color-neutral-800, #262626);
  font-size: 15px;
  line-height: 1.7;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.legal-md__title {
  margin: 0 0 20px;
  color: var(--n-color-neutral-900, #171717);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.4;
  text-wrap: balance;
}

.legal-md .legal-md__h2 {
  margin: 32px 0 12px;
  padding-top: 20px;
  border-top: 1px solid var(--n-color-neutral-200, #e5e5e5);
  color: var(--n-color-neutral-900, #171717);
  font-size: 18px;
  font-weight: 800;
  line-height: 1.45;
  text-wrap: balance;
}

.legal-md .legal-md__h3 {
  margin: 20px 0 6px;
  color: var(--n-color-neutral-900, #171717);
  font-size: 15px;
  font-weight: 700;
  text-wrap: balance;
}

.legal-md .legal-md__p {
  margin: 0 0 10px;
  text-wrap: pretty;
}

.legal-md .legal-md__ol,
.legal-md .legal-md__ul {
  margin: 0 0 12px;
  padding-left: 22px;
}

/* 전역 리셋(Tailwind preflight)이 ol · ul 의 list-style 을 none 으로 끈다 — 본문이 «제7조 제4항» 처럼 번호로 서로를 가리키므로 되살린다 */
.legal-md .legal-md__ol {
  list-style: decimal outside;
}

.legal-md .legal-md__ul {
  list-style: disc outside;
}

.legal-md li > .legal-md__ul {
  margin-top: 6px;
  list-style: circle outside;
}

.legal-md li {
  margin: 0 0 6px;
  text-wrap: pretty;
}

.legal-md .legal-md__table-wrap {
  margin: 0 0 16px;
  overflow-x: auto;
}

.legal-md .legal-md__table-wrap:focus-visible {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
  outline-offset: 2px;
}

.legal-md .legal-md__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 1.6;
}

.legal-md .legal-md__table th,
.legal-md .legal-md__table td {
  padding: 8px 10px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  text-align: left;
  vertical-align: top;
}

.legal-md .legal-md__table th {
  background: var(--n-color-neutral-50, #fafafa);
  font-weight: 700;
}

.legal-md .legal-md__link {
  color: var(--n-color-primary-600, #5025e8);
  text-decoration: underline;
}

.legal-md .legal-md__pending,
.legal-md .legal-md__nb {
  white-space: nowrap;
}

.legal-md .legal-md__pending {
  color: var(--n-color-neutral-500, #737373);
}

.legal-md__sr {
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
</style>
