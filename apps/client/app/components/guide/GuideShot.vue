<script setup lang="ts">
// 설치 가이드 화면 창(client-guide spec F-3) — PNG 는 화면 잘라 낸 부분만, 검은 테두리 · 둥근 모서리는 여기서 그린다.
// width · height 를 주어 이미지가 늦게 떠도 글이 밀리지 않는다. 대체 글 = 매니페스트 alt.
import { computed } from 'vue'
import { GUIDE_FIGURES, figureSize, figureSrc, type FigureKey } from '~/content/guide/figures'

const props = defineProps<{ figure: FigureKey }>()
const src = computed(() => figureSrc(props.figure))
const alt = computed(() => GUIDE_FIGURES[props.figure].alt)
const size = computed(() => figureSize(props.figure))
</script>

<template>
  <figure class="g-shot">
    <img
      class="g-shot__img"
      :src="src"
      :alt="alt"
      :width="size.width"
      :height="size.height"
      loading="lazy"
      decoding="async"
    />
  </figure>
</template>

<style scoped>
.g-shot {
  box-sizing: border-box;
  width: 100%;
  max-width: calc(368px + 10px);
  margin: 12px auto 0;
  overflow: hidden;
  border: 5px solid #1d1d1f;
  border-radius: 26px;
  background: #f2f2f7;
  box-shadow: 0 14px 30px -18px rgba(17, 17, 17, 0.45);
}

.g-shot__img {
  display: block;
  width: 100%;
  height: auto;
}
</style>
