import React from 'react'
import { View } from 'react-native'
import LottieView from 'lottie-react-native'
import { a11yProps, useLottieState, type NLottieProps } from './shared'

export { useReducedMotion, type NLottieProps } from './shared'

// ponytail: 화면 밖 일시정지 없음 — RN 에 가시성 API 가 없다. loop 연출을 스크롤 목록에 넣을 때 onViewableItemsChanged 로 추가
export function NLottie(props: NLottieProps) {
  const {
    source,
    autoplay = true,
    loop = false,
    size = 120,
    reducedMotion = 'last-frame',
    label,
    style,
  } = props
  const { known, still, finished, finish } = useLottieState(props)

  if (still && reducedMotion === 'hide') return null

  return (
    <View style={[{ width: size, height: size }, style]} {...a11yProps(label)}>
      {/* 설정을 아직 모르면 그리지 않는다 — 줄이기 켬 기기에서 첫 프레임이 재생되지 않게 */}
      {!known ? null : still || finished.current ? (
        // 정지 프레임 — progress 0 = 첫 프레임 · 1 = 마지막(완료) 프레임
        <LottieView
          key="still"
          source={source}
          autoPlay={false}
          loop={false}
          progress={still && reducedMotion === 'first-frame' ? 0 : 1}
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
          onAnimationFailure={finish}
          style={{ width: size, height: size }}
        />
      )}
    </View>
  )
}
