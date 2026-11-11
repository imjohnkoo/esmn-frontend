<script setup lang="ts">
// 회원 화면의 «화면 전체의 문제» 대화상자 — 문안은 content/member.ts MEMBER_DIALOG 에서(states.md 오류 2층 중 위층)
import { NAlertDialog, NButton } from '@imjohnkoo/design-vue'

const open = defineModel<boolean>({ default: false })
defineProps<{ title: string; body: string; secondary?: string; confirmLabel?: string }>()
const emit = defineEmits<{ confirm: []; secondary: [] }>()

function close(kind: 'confirm' | 'secondary') {
  if (!open.value) return
  open.value = false
  if (kind === 'confirm') emit('confirm')
  else emit('secondary')
}

// Escape · 바깥 누름으로 닫혀도 [확인] 과 같은 동작(spec D-28) — closable=false 는 닫기 버튼만 숨긴다
function onModel(v: unknown) {
  if (!v) close('confirm')
}
</script>

<template>
  <!-- 본문은 description(DialogDescription · aria-describedby) — 스크린리더가 안내를 읽게(D-28) -->
  <NAlertDialog
    :model-value="open"
    :title="title"
    :description="body"
    color="warning"
    :closable="false"
    @update:model-value="onModel($event)"
  >
    <template #actions>
      <NButton v-if="secondary" variant="outline" full-width @click="close('secondary')">{{
        secondary
      }}</NButton>
      <NButton variant="primary" full-width @click="close('confirm')">{{
        confirmLabel ?? '확인'
      }}</NButton>
    </template>
  </NAlertDialog>
</template>

<style scoped>
.member-dialog__body {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-600, #525252);
  word-break: keep-all;
}
</style>
