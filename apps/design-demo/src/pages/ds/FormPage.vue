<script setup lang="ts">
import { ref } from 'vue'
import {
  NForm,
  NFormField,
  NFieldGroup,
  NInput,
  NTextarea,
  NCheckbox,
  NCheckboxGroup,
  NSwitch,
  NRadioGroup,
  NSlider,
  NSelect,
  NPinInput,
  NInputNumber,
  NInputTags,
  NInputMenu,
  NSelectMenu,
  NInputTime,
  NInputDate,
  NColorPicker,
  NFileUpload,
  NSeparator,
} from '@imjohnkoo/design-vue'

const inputVal = ref('')
const textareaVal = ref('')
const checkboxVal = ref(false)
const checkboxGroupVal = ref<string[]>(['vue'])
const switchVal = ref(true)
const radioVal = ref('option1')
const sliderVal = ref([40])
const selectVal = ref('')
const pinVal = ref<string[]>([])
const pinVal4 = ref<string[]>([])
const numberVal = ref(5)
const tagsVal = ref(['Vue', 'TypeScript'])
const inputMenuVal = ref('')
const selectMenuVal = ref('')
const timeVal = ref('')
const dateVal = ref('')
const colorVal = ref('#2563eb')

const selectItems = [
  { label: '옵션 1', value: 'option1' },
  { label: '옵션 2', value: 'option2' },
  { label: '옵션 3', value: 'option3' },
]

const inputMenuItems = [
  { label: '서울', value: 'seoul' },
  { label: '부산', value: 'busan' },
  { label: '대구', value: 'daegu' },
  { label: '인천', value: 'incheon' },
  { label: '광주', value: 'gwangju' },
]

const checkboxGroupItems = [
  { label: 'Vue', value: 'vue' },
  { label: 'React', value: 'react' },
  { label: 'Angular', value: 'angular' },
  { label: 'Svelte', value: 'svelte' },
]

function onSubmit() {
  alert('Form submitted!')
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-(--ui-text-highlighted)">Form</h1>
      <p class="text-sm text-(--ui-text-muted) mt-1">
        폼 컨트롤 컴포넌트 — Input, Select, Checkbox, Switch, Slider 등 19개 컴포넌트
      </p>
    </div>

    <!-- Basic Inputs -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NInput / NTextarea</h2>
      </template>
      <NForm @submit="onSubmit">
        <NFieldGroup gap="md">
          <NFormField label="이름" hint="필수" required>
            <NInput v-model="inputVal" placeholder="이름을 입력하세요" />
          </NFormField>
          <NFormField label="이메일">
            <NInput v-model="inputVal" type="email" placeholder="email@example.com" />
          </NFormField>
          <NFormField label="비활성">
            <NInput model-value="읽기 전용" disabled />
          </NFormField>
          <NFormField label="에러 상태" error="필수 항목입니다">
            <NInput model-value="" placeholder="입력하세요" error />
          </NFormField>
        </NFieldGroup>
        <NSeparator class="my-4" />
        <NFormField label="설명">
          <NTextarea v-model="textareaVal" placeholder="상세 내용을 입력하세요" :rows="3" />
        </NFormField>
      </NForm>
    </UCard>

    <!-- NInput sizes -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NInput Sizes</h2>
      </template>
      <div class="space-y-3">
        <NInput placeholder="Small" size="sm" />
        <NInput placeholder="Medium (default)" size="md" />
        <NInput placeholder="Large" size="lg" />
      </div>
    </UCard>

    <!-- NCheckbox / NCheckboxGroup / NSwitch -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NCheckbox / NCheckboxGroup / NSwitch</h2>
      </template>
      <div class="space-y-6">
        <div>
          <p class="text-xs text-(--ui-text-muted) mb-2">NCheckbox</p>
          <NCheckbox v-model="checkboxVal" label="약관에 동의합니다" />
          <p class="text-xs text-(--ui-text-muted) mt-1">값: {{ checkboxVal }}</p>
        </div>

        <NSeparator />

        <div>
          <p class="text-xs text-(--ui-text-muted) mb-2">NCheckboxGroup</p>
          <NCheckboxGroup v-model="checkboxGroupVal" :items="checkboxGroupItems" />
          <p class="text-xs text-(--ui-text-muted) mt-1">선택: {{ checkboxGroupVal.join(', ') }}</p>
        </div>

        <NSeparator />

        <div>
          <p class="text-xs text-(--ui-text-muted) mb-2">NSwitch</p>
          <div class="flex items-center gap-6">
            <NSwitch v-model="switchVal" label="알림 수신" size="sm" />
            <NSwitch v-model="switchVal" label="알림 수신" size="md" />
            <NSwitch v-model="switchVal" label="알림 수신" size="lg" />
          </div>
          <p class="text-xs text-(--ui-text-muted) mt-1">상태: {{ switchVal ? 'ON' : 'OFF' }}</p>
        </div>
      </div>
    </UCard>

    <!-- NRadioGroup -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NRadioGroup</h2>
      </template>
      <div class="grid grid-cols-2 gap-8">
        <div>
          <p class="text-xs text-(--ui-text-muted) mb-2">Vertical</p>
          <NRadioGroup
            v-model="radioVal"
            :items="[
              { label: '이메일 알림', value: 'option1' },
              { label: 'SMS 알림', value: 'option2' },
              { label: '푸시 알림', value: 'option3' },
            ]"
          />
        </div>
        <div>
          <p class="text-xs text-(--ui-text-muted) mb-2">Horizontal</p>
          <NRadioGroup
            v-model="radioVal"
            orientation="horizontal"
            :items="[
              { label: '옵션 1', value: 'option1' },
              { label: '옵션 2', value: 'option2' },
              { label: '옵션 3', value: 'option3' },
            ]"
          />
        </div>
      </div>
      <p class="text-xs text-(--ui-text-muted) mt-2">선택: {{ radioVal }}</p>
    </UCard>

    <!-- NSlider -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NSlider</h2>
      </template>
      <div class="space-y-4">
        <NSlider v-model="sliderVal" />
        <p class="text-xs text-(--ui-text-muted)">값: {{ sliderVal[0] }}</p>
      </div>
    </UCard>

    <!-- NSelect -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NSelect</h2>
      </template>
      <div class="max-w-xs">
        <NSelect v-model="selectVal" :items="selectItems" placeholder="옵션을 선택하세요" />
        <p class="text-xs text-(--ui-text-muted) mt-2">선택: {{ selectVal || '없음' }}</p>
      </div>
    </UCard>

    <!-- NPinInput -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NPinInput</h2>
      </template>
      <div class="space-y-4">
        <NPinInput v-model="pinVal" :length="6" placeholder="○" @complete="() => alert('완료!')" />
        <p class="text-xs text-(--ui-text-muted)">입력: {{ pinVal.join('') || '없음' }}</p>
        <!-- 오류 상태 — 묶음에 aria-invalid · 4칸 -->
        <NPinInput v-model="pinVal4" :length="4" type="number" placeholder="" invalid />
        <!-- 320px 폰 그릇(화면 − 좌우 24px = 272px) — 6칸이 36~48px 로 줄어 한 줄에 든다 -->
        <div style="width: 272px; outline: 1px dashed var(--ui-border)">
          <NPinInput v-model="pinVal" :length="6" placeholder="" />
        </div>
      </div>
    </UCard>

    <!-- NInputNumber -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NInputNumber</h2>
      </template>
      <div class="max-w-xs">
        <NInputNumber v-model="numberVal" :min="0" :max="100" :step="1" />
        <p class="text-xs text-(--ui-text-muted) mt-2">값: {{ numberVal }}</p>
      </div>
    </UCard>

    <!-- NInputTags -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NInputTags</h2>
      </template>
      <div class="max-w-md">
        <NInputTags v-model="tagsVal" placeholder="태그 입력 후 Enter" />
        <p class="text-xs text-(--ui-text-muted) mt-2">태그: {{ tagsVal.join(', ') }}</p>
      </div>
    </UCard>

    <!-- NInputMenu -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NInputMenu (Combobox)</h2>
      </template>
      <div class="max-w-xs">
        <NInputMenu v-model="inputMenuVal" :items="inputMenuItems" placeholder="도시 검색..." />
        <p class="text-xs text-(--ui-text-muted) mt-2">선택: {{ inputMenuVal || '없음' }}</p>
      </div>
    </UCard>

    <!-- NSelectMenu -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NSelectMenu (Listbox)</h2>
      </template>
      <div class="max-w-xs">
        <NSelectMenu
          v-model="selectMenuVal"
          :items="[
            { label: '개발자', value: 'developer' },
            { label: '디자이너', value: 'designer' },
            { label: '기획자', value: 'planner' },
            { label: '마케터', value: 'marketer' },
          ]"
        />
        <p class="text-xs text-(--ui-text-muted) mt-2">선택: {{ selectMenuVal || '없음' }}</p>
      </div>
    </UCard>

    <!-- NInputTime / NInputDate -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NInputTime / NInputDate</h2>
      </template>
      <div class="grid grid-cols-2 gap-6">
        <div>
          <p class="text-xs text-(--ui-text-muted) mb-2">NInputTime</p>
          <NInputTime v-model="timeVal" />
          <p class="text-xs text-(--ui-text-muted) mt-1">값: {{ timeVal || '없음' }}</p>
        </div>
        <div>
          <p class="text-xs text-(--ui-text-muted) mb-2">NInputDate</p>
          <NInputDate v-model="dateVal" placeholder="날짜 선택" />
          <p class="text-xs text-(--ui-text-muted) mt-1">값: {{ dateVal || '없음' }}</p>
        </div>
      </div>
    </UCard>

    <!-- NColorPicker -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NColorPicker</h2>
      </template>
      <div class="max-w-xs">
        <NColorPicker
          v-model="colorVal"
          :swatches="['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']"
        />
        <p class="text-xs text-(--ui-text-muted) mt-2">색상: {{ colorVal }}</p>
      </div>
    </UCard>

    <!-- NFileUpload -->
    <UCard>
      <template #header>
        <h2 class="font-semibold text-(--ui-text-highlighted)">NFileUpload</h2>
      </template>
      <NFileUpload accept="image/*" :multiple="true" @change="(files: FileList) => console.log(files)" />
    </UCard>
  </div>
</template>
