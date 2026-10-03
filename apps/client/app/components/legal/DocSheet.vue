<script setup lang="ts">
// 문서 하단 시트(client-shell spec D-45 · D-46 · D-48) — 새 탭 대신 화면 안에서 이용약관 · 개인정보처리방침 · 취소·환불 정책 · eSIM 지원 기기를 본다.
// v-model = 열 문서 키(null 이면 닫힘). 제목 = 문서 제목(본문 h1 은 숨김) · 본문만 스크롤 · X · 바깥 누름 · Esc 로 닫힌다.
// 본문은 각 페이지와 같은 것 — 법정 3종은 생성물 · 같은 렌더러(LegalMarkdown), 지원 기기는 /supported-devices 와 같은 컴포넌트.
// 다른 대화상자(발급 확인 팝업) 위에 띄울 때는 그 대화상자 안에 둔다(중첩 레이어 — 바깥 누름이 시트만 닫는다).
import { NBottomSheet } from '@imjohnkoo/design-vue'
import SupportedDevicesContent from '~/components/devices/SupportedDevicesContent.vue'
import LegalMarkdown from '~/components/legal/LegalMarkdown.vue'
import { PRIVACY_DOC } from '~/content/legal/privacy'
import { REFUND_DOC } from '~/content/legal/refund'
import { TERMS_DOC } from '~/content/legal/terms'

export type DocSheetKey = 'terms' | 'privacy' | 'refund' | 'devices'

const DOCS = { terms: TERMS_DOC, privacy: PRIVACY_DOC, refund: REFUND_DOC } as const
const DEVICES_TITLE = 'eSIM 지원 기기'

const selected = defineModel<DocSheetKey | null>({ default: null })

// 닫히는 동안(애니메이션)에도 제목 · 본문이 비지 않게 마지막 문서를 붙잡아 둔다
const shown = ref<DocSheetKey>('terms')
watch(selected, (key) => {
  if (key) shown.value = key
}, { immediate: true })
const doc = computed(() => (shown.value === 'devices' ? null : DOCS[shown.value]))
const title = computed(() => doc.value?.title ?? DEVICES_TITLE)

const isOpen = computed({
  get: () => selected.value !== null,
  set: (open: boolean) => {
    if (!open) selected.value = null
  },
})
</script>

<template>
  <NBottomSheet v-model="isOpen" :title="title" closable>
    <div class="legal-sheet">
      <LegalMarkdown v-if="doc" :doc="doc" />
      <SupportedDevicesContent v-else />
    </div>
  </NBottomSheet>
</template>

<style scoped>
.legal-sheet {
  /* 본문만 스크롤 — 제목 · X 는 시트 위에 남는다 */
  max-height: 68vh;
  max-height: 68dvh;
  overflow-y: auto;
  overscroll-behavior: contain;
  text-align: left;
}
.legal-sheet :deep(.legal-md) {
  padding-top: 0;
}
.legal-sheet :deep(.legal-md__title) {
  /* 시트 제목과 같은 글자 — 두 번 보이지 않게 */
  display: none;
}
.legal-sheet :deep(.legal-md__title + *) {
  /* 숨긴 제목 바로 뒤 첫 장 — 위 여백 · 구분선 없이 시트 제목 아래에서 바로 */
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}
</style>
