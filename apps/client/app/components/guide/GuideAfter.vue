<script setup lang="ts">
// «설치한 뒤에» 줄(client-guide-check spec S-6 · S-3 끝) — 줄마다 제목 · 설명 · 버튼 1~2(OS 두 칸 또는 한 칸).
// 허브의 OS 링크 카드(NLinkCard 2)와 섞이지 않게 다른 모양 — 회색 알약 버튼(OS 전환과 같은 둥글기).
import type { GuideAfterRow, GuideLink } from '~/content/guide/types'

const props = withDefaults(
  defineProps<{ rows: readonly GuideAfterRow[]; mode?: 'page' | 'bare' }>(),
  { mode: 'page' },
)
const to = (l: GuideLink) => (props.mode === 'bare' ? l.bare : l.page)
</script>

<template>
  <ul class="g-after" role="list">
    <li v-for="r in rows" :key="r.title" class="g-after__row">
      <h3 class="g-after__t">{{ r.title }}</h3>
      <p class="g-after__sub">{{ r.sub }}</p>
      <div class="g-after__btns" :class="{ 'g-after__btns--one': r.buttons.length === 1 }">
        <NuxtLink v-for="b in r.buttons" :key="b.page" :to="to(b)" class="g-after__btn">{{
          b.label
        }}</NuxtLink>
      </div>
    </li>
  </ul>
</template>

<style scoped>
.g-after {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  word-break: keep-all;
}

.g-after__row {
  display: grid;
  gap: 4px;
  padding: 14px 16px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: var(--n-radius-xl, 12px);
  background: #fff;
  text-align: left;
}

.g-after__t {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--n-color-neutral-900, #171717);
}

.g-after__sub {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-color-neutral-500, #737373);
}

.g-after__btns {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-top: 8px;
}

.g-after__btns--one {
  grid-template-columns: 1fr;
}

.g-after__btn {
  padding: 9px 0;
  border-radius: var(--n-radius-full, 9999px);
  background: var(--n-color-neutral-100, #f5f5f5);
  font-size: 15px;
  font-weight: 700;
  color: var(--n-color-neutral-700, #404040);
  text-align: center;
  text-decoration: none;
}
</style>
