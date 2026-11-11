<script setup lang="ts">
// 회원 화면의 «화면 전체의 문제» 대화상자 — 문안은 content/member.ts MEMBER_DIALOG 에서(states.md 오류 2층 중 위층)
import { NAlertDialog, NButton } from '@imjohnkoo/design-vue'

const open = defineModel<boolean>({ default: false })
defineProps<{ title: string; body: string; secondary?: string; confirmLabel?: string }>()
const emit = defineEmits<{ confirm: []; secondary: [] }>()

function close(kind: 'confirm' | 'secondary') {
  open.value = false
  if (kind === 'confirm') emit('confirm')
  else emit('secondary')
}
</script>

<template>
  <NAlertDialog v-model="open" :title="title" color="warning" :closable="false">
    <p class="member-dialog__body">{{ body }}</p>
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
