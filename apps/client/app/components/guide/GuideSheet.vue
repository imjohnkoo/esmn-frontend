<script setup lang="ts">
// 발급 화면 설치 가이드 시트(client-guide D-13 · S-4) — 새 탭 대신 같은 화면 위 하단 시트로 OS 가이드를 본다(QR 화면을 떠나지 않는다).
// 결제 화면 문서 시트(DocSheet · client-shell D-45)와 같은 틀: v-model = 열 OS(null 이면 닫힘) · 제목 = 카드 이름 · X · 바깥 누름 · Esc · 본문만 스크롤.
// 본문은 /guide/<os> 와 같은 GuideArticle(시트 판) — OS 전환은 시트 안 내용만 바꾸고, 바로가기는 시트 본문을 움직인다(주소 · 해시 그대로).
import { NBottomSheet } from '@imjohnkoo/design-vue'
import { ANDROID_GUIDE } from '~/content/guide/android'
import { GUIDE_PAGES } from '~/content/guide/common'
import { IOS_GUIDE } from '~/content/guide/ios'
import type { GuideOs } from '~/content/guide/types'
import GuideArticle from './GuideArticle.vue'

const selected = defineModel<GuideOs | null>({ default: null })

// 닫히는 동안(애니메이션)에도 제목 · 본문이 비지 않게 마지막 OS 를 붙잡아 둔다
const shown = ref<GuideOs>('ios')
watch(
  selected,
  (os) => {
    if (os) shown.value = os
  },
  { immediate: true },
)
const content = computed(() => (shown.value === 'ios' ? IOS_GUIDE : ANDROID_GUIDE))
const title = computed(() => GUIDE_PAGES[shown.value].label)

const isOpen = computed({
  get: () => selected.value !== null,
  set: (open: boolean) => {
    if (!open) selected.value = null
  },
})

const scroller = ref<HTMLElement | null>(null)

/** OS 전환 — 시트 안 내용만 바꾸고 본문 맨 위로 */
function switchOs(os: GuideOs) {
  selected.value = os
  nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = 0
  })
}

/** 구간 바로가기 — 시트 본문 스크롤 영역만 움직인다(scrollIntoView 는 뒤 페이지까지 움직일 수 있다 · 해시를 바꾸지 않는다) */
function jump(id: string) {
  const box = scroller.value
  const target = box?.querySelector<HTMLElement>(`#${id}`)
  if (!box || !target) return
  box.scrollTop += target.getBoundingClientRect().top - box.getBoundingClientRect().top
}
</script>

<template>
  <NBottomSheet v-model="isOpen" :title="title" closable>
    <!-- 본문 스크롤 영역 — 키보드로도 스크롤(포커스 가능 · 영역 이름 = 시트 제목) -->
    <div ref="scroller" class="guide-sheet" tabindex="0" role="region" :aria-label="title">
      <GuideArticle :content="content" mode="sheet" @os="switchOs" @jump="jump" />
    </div>
  </NBottomSheet>
</template>

<style scoped>
.guide-sheet {
  /* 본문만 스크롤 — 제목 · X 는 시트 위에 남는다. 시트 최대 높이(90%) 안에 머리(손잡이 · 제목 · X ≈ 100px)까지 */
  max-height: calc(90vh - 112px);
  max-height: calc(90dvh - 112px);
  margin: 0 -20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  text-align: left;
}

.guide-sheet:focus-visible {
  outline: 2px solid #6239ff;
  outline-offset: -2px;
}

/* 시트 제목과 같은 이름 — 본문 제목 줄은 두 번 보이지 않게 */
.guide-sheet :deep(.g-hero__title) {
  display: none;
}

.guide-sheet :deep(.g-hero) {
  padding-top: 8px;
}

/* 시트 판의 OS 전환 · 바로가기는 버튼(주소를 바꾸지 않는다) — 링크와 같은 모양으로. 크기 · 굵기 · 색 · 테두리는 본문 클래스 그대로,
   버튼 기본값(글꼴 · 줄간격 · 회색 바탕 · 테두리)만 지운다 */
.guide-sheet :deep(button.g-os__tab),
.guide-sheet :deep(button.g-jump__chip) {
  font-family: inherit;
  line-height: inherit;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.guide-sheet :deep(button.g-os__tab) {
  border: 0;
  background: transparent;
}

.guide-sheet :deep(button.g-os__tab.g-os__tab--on) {
  background: #fff;
}

.guide-sheet :deep(button:focus-visible) {
  outline: 2px solid #6239ff;
  outline-offset: 2px;
}
</style>
