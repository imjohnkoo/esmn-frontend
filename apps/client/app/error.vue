<script setup lang="ts">
// 오류 화면(catalog spec S-7 · F-13 · D-22) — 404 · 500 을 사이트 틀 안에 한국어로. 상태 코드는 Nuxt 가 그대로 낸다.
// app.vue 대신 그려지므로 프레임(.app-bg · .app-frame — app.vue 의 전역 스타일) · lang · 제목 · noindex 를 여기서 넣는다.
// 서버를 부르지 않는다 — 칩 목록은 빌드 때 앱 설정(errorChips · modules/catalog.ts)으로 들어온다.
// 이 화면의 링크 · 헤더 · 탭을 누르면 Nuxt 클라이언트 이동이 오류를 지운다.
import { provide } from 'vue'
import type { NuxtError } from '#app'
import ErrorPanel from '~/components/shell/ErrorPanel.vue'
import { ERROR_ROUTE_KEY } from '~/composables/useShellRoute'
import {
  errorChips,
  errorHead,
  errorRouteOf,
  errorStatus,
  errorView,
  type ErrorChipSets,
} from '~/utils/error-view'

const props = defineProps<{ error: NuxtError }>()
// 그 오류가 난 주소 — 본문 갈래와 틀(탭 활성 · 메뉴 닫기)이 같은 주소를 보게 아래로도 내려 준다
const router = useRouter()
const errorRoute = errorRouteOf(
  () => props.error,
  () => router.currentRoute.value,
)
provide(ERROR_ROUTE_KEY, errorRoute)
const view = computed(() => errorView(errorStatus(props.error), errorRoute.path))

useHead(() => errorHead(view.value))

const chipSets: ErrorChipSets = (useAppConfig() as { errorChips?: ErrorChipSets }).errorChips ?? {
  popular: [],
  asia: [],
}
const chips = computed(() => errorChips(view.value, chipSets))

function retry() {
  window.location.reload()
}
</script>

<template>
  <div class="app-bg">
    <div class="app-frame">
      <NuxtLayout name="default">
        <ErrorPanel :view="view" :chips="chips" @retry="retry" />
      </NuxtLayout>
    </div>
  </div>
</template>
