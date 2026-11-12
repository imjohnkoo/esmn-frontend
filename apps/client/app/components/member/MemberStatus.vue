<script setup lang="ts">
// 도착 화면 상태 줄(E-10 · E-11 · E-13 · E-17 · design-qa 5-7 · spec D-31) — role=status 그릇은 처음부터 DOM 에 두고 글만 넣는다.
// 글과 함께 그릇이 생기면 대부분의 스크린리더가 읽지 않는다. 처음 글은 마운트 뒤 한 틱 늦게 넣어 «바뀐 글» 로 읽히게 한다.
const props = defineProps<{ text: string | null }>()
const shown = ref<string | null>(null)
onMounted(() => {
  // ponytail: 60ms — 그릇이 접근성 트리에 들어간 뒤 글을 넣는다(즉시 넣으면 VoiceOver 가 놓친다)
  setTimeout(() => (shown.value = props.text), 60)
})
watch(
  () => props.text,
  (t) => (shown.value = t),
)
</script>

<template>
  <p role="status" class="member-status" :class="{ 'member-status--shown': shown }">{{ shown }}</p>
</template>

<style scoped>
.member-status {
  margin: 0;
}

/* 빈 그릇은 흐름 밖으로 — 높이 0 인 자식도 부모 flex gap 을 받아 평소 화면에 빈 간격이 생긴다(QA ⑥ major) */
.member-status:not(.member-status--shown) {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.member-status--shown {
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--n-color-primary-50, #f1edff);
  color: var(--n-color-neutral-800, #262626);
  font-size: 14px;
  line-height: 1.6;
}
</style>
