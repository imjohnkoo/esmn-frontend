<script setup lang="ts">
// 설치 가이드 인라인 표기 렌더(client-guide plan §2) — v-html 없이 토막을 span 으로 그린다.
// 누를 이름 = 형광 밑줄 · 메뉴 경로 = 굵게(`›` 에서만 줄바꿈) · 이름 · 경로 뒤 조사는 같은 줄(2609 typo.js 규칙).
import { computed } from 'vue'
import { parseGuideInline } from '~/content/guide/inline'

const props = defineProps<{ src: string }>()
const tokens = computed(() => parseGuideInline(props.src))
</script>

<template>
  <template v-for="(s, i) in tokens" :key="i">
    <template v-if="s.t === 'text'">{{ s.v }}</template>
    <span v-else-if="s.t === 'ui'" class="g-nw"
      ><span class="g-ui">{{ s.v }}</span
      >{{ s.particle }}</span
    >
    <span v-else-if="s.t === 'path'" class="g-path"
      ><template v-for="(p, j) in s.parts" :key="j"
        ><span v-if="j > 0" class="g-path__sep"> › </span
        ><span class="g-nw"
          >{{ p
          }}<span v-if="j === s.parts.length - 1 && s.particle" class="g-path__p">{{
            s.particle
          }}</span></span
        ></template
      ></span
    >
    <b v-else-if="s.t === 'b'" class="g-b">{{ s.v }}</b>
    <span v-else class="g-nw">{{ s.v }}</span>
  </template>
</template>

<style scoped>
.g-nw {
  white-space: nowrap;
}

/* 누를 버튼 · 메뉴 이름 — 배경 칩이면 뒤 조사가 떨어져 보여서 형광 밑줄로(2609 guide.css) */
.g-ui {
  font-weight: 700;
  color: var(--n-color-primary-700, #4a1fd6);
  background: linear-gradient(transparent 58%, var(--n-color-primary-100, #e3dbff) 58%);
  padding: 0 1px;
}

.g-path {
  font-weight: 700;
}

/* « › » 앞뒤 공백에서만 줄이 바뀐다 — 메뉴 이름 토막은 .g-nw */
.g-path__sep {
  font-weight: 400;
  color: var(--n-color-neutral-400, #a3a3a3);
}

.g-path__p {
  font-weight: 400;
}

.g-b {
  font-weight: 700;
  color: var(--n-color-neutral-900, #171717);
}
</style>
