<script setup lang="ts">
// 발급 확인 팝업 필수 동의 문구(client-shell spec D-44 · John 2026-10-03) — NCheckbox 문구 slot 에 넣는다.
// 정본 05-A 19행과 다른 글자다(생성물 ISSUE_NOTICE.consent 는 정본 그대로 — main F-20 판이 쓴다). 글자는 legal-links.test.ts 가 고정한다.
// 링크를 누르면 새 탭이 아니라 하단 시트로 본문을 연다(D-45 — 부모가 open 을 받아 시트를 띄운다). href 는 남긴다(새 탭 열기 · 주소 복사).
// label 안 링크라 눌러도 체크는 바뀌지 않는다(브라우저 규칙 — 활성화 대상이 링크).
const emit = defineEmits<{ open: [doc: 'terms' | 'refund'] }>()
</script>

<template>
  <span class="issue-consent"
    >(필수)
    <a class="issue-consent__link" href="/terms" aria-haspopup="dialog" @click.prevent="emit('open', 'terms')"
      >이용약관</a
    >과
    <a class="issue-consent__link" href="/refund" aria-haspopup="dialog" @click.prevent="emit('open', 'refund')"
      >취소·환불 정책</a
    >을 확인했으며 설치 전 환불 시 환불 비용이 발생하는 것에 동의합니다.</span
  >
</template>

<style scoped>
.issue-consent {
  word-break: keep-all;
  overflow-wrap: break-word;
}
.issue-consent__link {
  color: #6239ff;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 2px;
}
</style>
