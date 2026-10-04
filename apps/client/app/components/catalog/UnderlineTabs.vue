<script setup lang="ts" generic="K extends string">
// 밑줄 탭 — 유심사 배치(spec D-3 · D-5). role=tablist · 좌우 화살표로 이동 · 고른 탭만 Tab 초점을 받는다.
// 컴포넌트 테스트(UnderlineTabs.test.ts)가 Nuxt 없이 그린다 — vue 에서 명시 import 한다.
import { nextTick, ref } from 'vue'
const props = defineProps<{ tabs: { key: K; label: string }[]; label: string; idPrefix: string }>()
const model = defineModel<K>({ required: true })
const buttons = ref<HTMLButtonElement[]>([])

function move(delta: number) {
  const i = props.tabs.findIndex((t) => t.key === model.value)
  const next = props.tabs[(i + delta + props.tabs.length) % props.tabs.length]!
  model.value = next.key
  nextTick(() => buttons.value[props.tabs.indexOf(next)]?.focus())
}
</script>

<template>
  <div class="utabs" role="tablist" :aria-label="label">
    <button
      v-for="tab in tabs"
      :id="`${idPrefix}-tab-${tab.key}`"
      :key="tab.key"
      ref="buttons"
      type="button"
      role="tab"
      class="utabs__tab"
      :class="{ 'utabs__tab--on': tab.key === model }"
      :aria-selected="tab.key === model"
      :aria-controls="`${idPrefix}-panel`"
      :tabindex="tab.key === model ? 0 : -1"
      @click="model = tab.key"
      @keydown.right.prevent="move(1)"
      @keydown.left.prevent="move(-1)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<style scoped>
.utabs {
  display: flex;
  border-bottom: 1px solid var(--n-color-neutral-200, #e5e5e5);
}

.utabs__tab {
  flex: 1;
  height: 46px;
  border: none;
  background: none;
  font: inherit;
  font-size: 16px;
  font-weight: 600;
  color: var(--n-color-neutral-500, #737373);
  cursor: pointer;
}

.utabs__tab--on {
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
  box-shadow: inset 0 -2px 0 var(--n-color-neutral-900, #171717);
}

.utabs__tab:focus-visible {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
  outline-offset: -2px;
}
</style>
