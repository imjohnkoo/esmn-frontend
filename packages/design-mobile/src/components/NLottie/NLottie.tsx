import React, { useEffect, useState } from 'react'
import { AccessibilityInfo, View, type ViewStyle } from 'react-native'
import LottieView, { type LottieViewProps } from 'lottie-react-native'

/** OS «동작 줄이기» 설정 — 처음 값을 읽고 바뀌면 따라간다 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (alive) setReduced(v)
    })
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)
    return () => {
      alive = false
      sub.remove()
    }
  }, [])
  return reduced
}

/**
 * 일러스트 연출 전용(결제 · 발급 완료 · 축하 · 온보딩 · 로딩 일러스트).
 * UI 상태(버튼 · 토글 · 진행 막대)에는 쓰지 않는다. design-vue NLottie 와 같은 규칙.
 */
export interface NLottieProps {
  /** `require('…/x.json')` 또는 `{ uri }` */
  source: LottieViewProps['source']
  autoplay?: boolean
  loop?: boolean
  /** 한 변 px */
  size?: number
  /** «동작 줄이기» 켬일 때: 결과 연출은 last-frame(완료 그림) · 장식(색종이)은 hide */
  reducedMotion?: 'last-frame' | 'first-frame' | 'hide'
  /** 있으면 이미지로 읽히고, 없으면 장식(스크린리더에서 숨김) */
  label?: string
  /** 한 번 재생이 끝났을 때(loop=false). 줄이기 켬이면 정지 프레임을 보여 준 즉시 */
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

  // 줄이기 켬이면 재생이 없으니 «끝난 상태» 를 바로 알린다 — onComplete 를 기다리는 호출자가 멈추지 않게
  useEffect(() => {
    if (reduced && !loop) onComplete?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 설정이 켜질 때 한 번만
  }, [reduced, loop])

  if (reduced && reducedMotion === 'hide') return null

  const a11y = label
    ? { accessible: true, accessibilityRole: 'image' as const, accessibilityLabel: label }
    : {
        accessibilityElementsHidden: true,
        importantForAccessibility: 'no-hide-descendants' as const,
      }

  return (
    <View style={[{ width: size, height: size }, style]} {...a11y}>
      {reduced ? (
        // 정지 프레임 — progress 0 = 첫 프레임 · 1 = 마지막(완료) 프레임
        <LottieView
          key="still"
          source={source}
          autoPlay={false}
          loop={false}
          progress={reducedMotion === 'first-frame' ? 0 : 1}
          style={{ width: size, height: size }}
        />
      ) : (
        // key 로 다시 마운트 — 설정이 끔으로 돌아오면 처음부터 autoplay 대로 재생
        <LottieView
          key="play"
          source={source}
          autoPlay={autoplay}
          loop={loop}
          onAnimationFinish={(cancelled) => {
            if (!cancelled) onComplete?.()
          }}
          style={{ width: size, height: size }}
        />
      )}
    </View>
  )
}
