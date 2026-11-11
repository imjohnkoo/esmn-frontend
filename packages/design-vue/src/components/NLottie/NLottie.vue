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
      :autoplay="autoplay && !still"
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
 * 로딩 일러스트로 쓸 때 줄이기 켬 처리(정지 아이콘 + 문구 + aria-busy)는 감싸는 화면 몫이다.
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

/**
 * 한 번 재생이 끝났을 때(loop=false · autoplay) — 마운트당 한 번만.
 * 줄이기 켬(정지 프레임 · hide) · 플레이어 로드 실패에도 «끝난 상태» 로 바로 낸다 — 기다리는 호출자가 멈추지 않게.
 */
const emit = defineEmits<{ complete: [] }>()
let finished = false
function finish() {
  if (finished || props.loop || !props.autoplay) return
  finished = true
  emit('complete')
}

const reduced = useReducedMotion()
// 줄이기로 한 번 정지 · 숨김이 된 연출은 설정을 다시 꺼도 그 모양 그대로(처음부터 다시 돌지 않는다).
// loop 연출(로딩 등)은 끝이 없으니 설정을 끄면 다시 돈다.
const settled = ref(false)
const still = computed(() => reduced.value || settled.value)
const hidden = computed(() => still.value && props.reducedMotion === 'hide')

// 플레이어(WASM 포함)는 마운트 뒤에만 불러온다 — 서버 번들 · 첫 화면 번들에 들어가지 않는다.
const player = shallowRef<Component | null>(null)
const playerRef = ref<DotLottieVueInstance | null>(null)
onMounted(async () => {
  try {
    player.value = (await import('@lottiefiles/dotlottie-vue')).DotLottieVue
  } catch {
    finish() // 청크 로드 실패 — 빈 자리로 두고 기다리는 쪽만 풀어 준다
  }
})

/**
 * 플레이어를 설정에 맞춘다. 줄이기 켬 = 재생하지 않고 정해진 프레임에 멈춘 뒤 끝난 것으로 친다.
 * 끔 = 아직 안 끝난 연출이면 autoplay 대로 재생(플레이어는 만들 때의 autoplay 만 읽는다).
 * 한 번 정지한 뒤에는 설정을 다시 꺼도 정지 그대로다(still).
 */
function sync(dl: DotLottie) {
  if (!dl.isLoaded) return
  if (still.value) {
    if (!props.loop) settled.value = true
    dl.pause()
    dl.setFrame(props.reducedMotion === 'first-frame' ? 0 : Math.max(dl.totalFrames - 1, 0))
    finish()
  } else if (props.autoplay && !finished && !dl.isPlaying) {
    dl.play()
  }
}

// 템플릿 ref 는 자식 onMounted(인스턴스 생성) 뒤에 잡히도록 post flush
watch(
  playerRef,
  (p, _, onCleanup) => {
    const dl = p?.getDotLottieInstance()
    if (!dl) return
    const onLoad = () => sync(dl)
    // loadError — WASM(CDN) · JSON 을 못 받으면 load · complete 가 오지 않는다
    dl.addEventListener('load', onLoad)
    dl.addEventListener('complete', finish)
    dl.addEventListener('loadError', finish)
    onCleanup(() => {
      dl.removeEventListener('load', onLoad)
      dl.removeEventListener('complete', finish)
      dl.removeEventListener('loadError', finish)
    })
    sync(dl)
  },
  { flush: 'post' },
)

watch(hidden, (h) => {
  if (!h) return
  if (!props.loop) settled.value = true
  finish()
})

// 보는 중에 설정이 바뀌면 따라간다
watch(still, () => {
  const dl = playerRef.value?.getDotLottieInstance()
  if (dl) sync(dl)
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
