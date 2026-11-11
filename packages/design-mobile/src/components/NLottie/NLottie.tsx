import React, { useEffect, useRef, useSyncExternalStore } from 'react'
import { AccessibilityInfo, View, type ViewStyle } from 'react-native'
import LottieView, { type LottieViewProps } from 'lottie-react-native'

// OS «동작 줄이기» — 앱 전체가 구독 하나를 같이 쓴다. null = 아직 모름(첫 응답 전).
// 하나로 묶는 이유: react-native-web 의 AccessibilityInfo 는 리스너를 함수 문자열로 저장해,
// 여러 개를 달면 한쪽 remove 가 다른 쪽을 지운다.
let current: boolean | null = null
const listeners = new Set<() => void>()
let sub: { remove: () => void } | null = null

function set(v: boolean) {
  if (v === current) return
  current = v
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!sub) {
    sub = AccessibilityInfo.addEventListener('reduceMotionChanged', set)
    AccessibilityInfo.isReduceMotionEnabled().then(set, () => set(false))
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && sub) {
      sub.remove()
      sub = null
      current = null // 다시 구독할 때 새로 읽는다(그 사이 바뀐 설정을 놓치지 않게)
    }
  }
}

/** OS «동작 줄이기» — `null` 은 아직 모름(첫 응답 전) · 이후 바뀌면 따라간다 */
export function useReducedMotion(): boolean | null {
  return useSyncExternalStore(subscribe, () => current)
}

/**
 * 일러스트 연출 전용(결제 · 발급 완료 · 축하 · 온보딩 · 로딩 일러스트).
 * UI 상태(버튼 · 토글 · 진행 막대)에는 쓰지 않는다. design-vue NLottie 와 같은 규칙.
 * 로딩 일러스트로 쓸 때 줄이기 켬 처리(정지 아이콘 + 문구)는 감싸는 화면 몫이다.
 */
export interface NLottieProps {
  /** `import x from '…/x.json'` 또는 `{ uri }` */
  source: LottieViewProps['source']
  autoplay?: boolean
  loop?: boolean
  /** 한 변 px */
  size?: number
  /** «동작 줄이기» 켬일 때: 결과 연출은 last-frame(완료 그림) · 장식(색종이)은 hide */
  reducedMotion?: 'last-frame' | 'first-frame' | 'hide'
  /** 있으면 이미지로 읽히고, 없으면 장식(스크린리더에서 숨김) */
  label?: string
  /**
   * 한 번 재생이 끝났을 때(loop=false · autoplay) — 마운트당 한 번만.
   * 줄이기 켬(정지 프레임 · hide)이면 바로 낸다 — 기다리는 호출자가 멈추지 않게.
   */
  onComplete?: () => void
  style?: ViewStyle
}

// ponytail: 화면 밖 일시정지 없음 — RN 에 가시성 API 가 없다. loop 연출을 스크롤 목록에 넣을 때 onViewableItemsChanged 로 추가
export function NLottie({
  source,
  autoplay = true,
  loop = false,
  size = 120,
  reducedMotion = 'last-frame',
  label,
  onComplete,
  style,
}: NLottieProps) {
  const reduced = useReducedMotion()
  const finished = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const finish = () => {
    if (finished.current || loop || !autoplay) return
    finished.current = true
    onCompleteRef.current?.()
  }

  useEffect(() => {
    if (reduced === true) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 설정이 켜질 때만
  }, [reduced])

  if (reduced === true && reducedMotion === 'hide') return null

  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      }

  return (
    <View style={[{ width: size, height: size }, style]} {...a11y}>
      {reduced === null ? null : reduced || finished.current ? (
        // 정지 프레임 — progress 0 = 첫 프레임 · 1 = 마지막(완료) 프레임.
        // 끝난 연출은 설정을 다시 꺼도 처음부터 다시 돌지 않는다.
        <LottieView
          key="still"
          source={source}
          autoPlay={false}
          loop={false}
          progress={reduced && reducedMotion === 'first-frame' ? 0 : 1}
          style={{ width: size, height: size }}
        />
      ) : (
        <LottieView
          key="play"
          source={source}
          autoPlay={autoplay}
          loop={loop}
          onAnimationFinish={(cancelled) => {
            if (!cancelled) finish()
          }}
          style={{ width: size, height: size }}
        />
      )}
    </View>
  )
}
