<template>
  <div
    v-if="!hidden"
    class="n-lottie"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :role="label ? 'img' : undefined"
    :aria-label="label || undefined"
    :aria-hidden="label ? undefined : 'true'"
  >
    <component
      :is="player"
      v-if="player"
      ref="playerRef"
      class="n-lottie__player"
      :src="src"
      :autoplay="autoplay && !reduced"
      :loop="loop"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch, type Component } from 'vue'
import type { DotLottie, DotLottieVueInstance } from '@lottiefiles/dotlottie-vue'
import { useReducedMotion } from '../../composables/useReducedMotion'

/**
 * 일러스트 연출 전용(결제 · 발급 완료 · 축하 · 온보딩 · 로딩 일러스트).
 * UI 상태(버튼 · 토글 · 진행 막대)에는 쓰지 않는다.
 */
export interface NLottieProps {
  /** Lottie `.json` URL */
  src: string
  autoplay?: boolean
  loop?: boolean
  /** 한 변 px */
  size?: number
  /** «동작 줄이기» 켬일 때: 결과 연출은 last-frame(완료 그림) · 장식(색종이)은 hide */
  reducedMotion?: 'last-frame' | 'first-frame' | 'hide'
  /** 있으면 role="img" + 이름, 없으면 장식(aria-hidden) */
  label?: string
}

const props = withDefaults(defineProps<NLottieProps>(), {
  autoplay: true,
  loop: false,
  size: 120,
  reducedMotion: 'last-frame',
  label: undefined,
})

/** 한 번 재생이 끝났을 때(loop=false). 줄이기 켬이면 정지 프레임을 보여 준 즉시 */
const emit = defineEmits<{ complete: [] }>()

const reduced = useReducedMotion()
const hidden = computed(() => reduced.value && props.reducedMotion === 'hide')

// 플레이어(WASM 포함)는 마운트 뒤에만 불러온다 — 서버 번들 · 첫 화면 번들에 들어가지 않는다.
const player = shallowRef<Component | null>(null)
const playerRef = ref<DotLottieVueInstance | null>(null)
onMounted(async () => {
  player.value = (await import('@lottiefiles/dotlottie-vue')).DotLottieVue
})

/** 줄이기 켬이면 재생하지 않고 정해진 프레임에 멈춘다 */
function freeze(dl: DotLottie) {
  if (!reduced.value || !dl.isLoaded) return
  dl.pause()
  dl.setFrame(props.reducedMotion === 'first-frame' ? 0 : Math.max(dl.totalFrames - 1, 0))
}

// 템플릿 ref 는 자식 onMounted(인스턴스 생성) 뒤에 잡히도록 post flush
watch(
  playerRef,
  (p, _, onCleanup) => {
    const dl = p?.getDotLottieInstance()
    if (!dl) return
    const onLoad = () => {
      freeze(dl)
      // 줄이기 켬이면 재생이 없으니 «끝난 상태» 를 바로 알린다 — complete 를 기다리는 호출자가 멈추지 않게
      if (reduced.value && !props.loop) emit('complete')
    }
    const onComplete = () => emit('complete')
    dl.addEventListener('load', onLoad)
    dl.addEventListener('complete', onComplete)
    onCleanup(() => {
      dl.removeEventListener('load', onLoad)
      dl.removeEventListener('complete', onComplete)
    })
    freeze(dl)
  },
  { flush: 'post' },
)

watch(hidden, (h) => {
  if (h && !props.loop) emit('complete')
})

// 재생 중에 설정이 바뀌면 따라간다 — 끔으로 돌아오면 autoplay 대로 다시 재생
watch(reduced, (r) => {
  const dl = playerRef.value?.getDotLottieInstance()
  if (!dl) return
  if (r) freeze(dl)
  else if (props.autoplay && dl.isLoaded) dl.play()
})
</script>

<style scoped>
.n-lottie {
  display: inline-block;
  flex-shrink: 0;
}

.n-lottie__player {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
