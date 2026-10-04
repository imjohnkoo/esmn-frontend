<script setup lang="ts">
// 국가 검색 입력칸(catalog spec F-4 · S-2) — 입력할 때마다 값을 올린다.
// v-model 은 한글 조합이 끝나야 값을 넘긴다(«파리» 를 치는 중엔 «파») — 입력 이벤트의 값을 바로 쓴다.
// 컴포넌트 테스트(SearchField.test.ts)가 조합 중 입력을 잠근다 — vue 에서 명시적으로 import 한다.
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { onMounted, ref } from 'vue'

const query = defineModel<string>({ required: true })
const props = defineProps<{ autofocus?: boolean }>()
const input = ref<HTMLInputElement>()

onMounted(() => {
  if (props.autofocus) input.value?.focus()
})

function onInput(e: Event) {
  query.value = (e.target as HTMLInputElement).value
}

function clear() {
  query.value = ''
  input.value?.focus() // 지우기 버튼이 사라져도 초점이 입력창에 남게
}
</script>

<template>
  <div class="search-field">
    <MagnifyingGlassIcon class="search-field__icon" aria-hidden="true" />
    <input
      ref="input"
      :value="query"
      type="search"
      class="search-field__input"
      placeholder="나라나 도시 이름을 입력해 주세요"
      aria-label="나라나 도시 이름"
      autocomplete="off"
      enterkeyhint="search"
      @input="onInput"
    />
    <button
      v-if="query"
      type="button"
      class="search-field__clear"
      aria-label="입력 지우기"
      @click="clear"
    >
      <XMarkIcon aria-hidden="true" />
    </button>
  </div>
</template>

<style scoped>
.search-field {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  border: 1px solid var(--n-color-primary-500, #6239ff);
  border-radius: 14px;
  background: var(--n-color-neutral-0, #fff);
  box-shadow: 0 0 0 3px var(--n-color-primary-100, #e3dbff);
}

.search-field__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  color: var(--n-color-neutral-500, #737373);
}

.search-field__input {
  flex: 1;
  min-width: 0;
  height: 48px;
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  font-size: 16px;
  color: var(--n-color-neutral-900, #171717);
}

.search-field__input::-webkit-search-cancel-button {
  display: none;
}

.search-field__clear {
  display: inline-flex;
  padding: 4px;
  border: none;
  background: none;
  color: var(--n-color-neutral-500, #737373);
  cursor: pointer;
}

.search-field__clear svg {
  width: 18px;
  height: 18px;
}
</style>
