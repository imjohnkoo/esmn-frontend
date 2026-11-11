import React, { useEffect, useState } from 'react'
import { View } from 'react-native'
import { DotLottieReact, type DotLottie } from '@lottiefiles/dotlottie-react'
import { a11yProps, useLottieState, type NLottieProps } from './shared'

export { useReducedMotion, type NLottieProps } from './shared'

/**
 * 앱 웹 미리 보기(dev:web)용. lottie-react-native 웹 구현은 `progress` 를 무시해 정지 프레임을 못 그린다 —
 * 그 아래 dotlottie-react 를 직접 써서 design-vue NLottie 와 같은 방식(setFrame)으로 멈춘다.
 * 화면 밖 일시정지는 dotlottie-web 기본(freezeOnOffscreen).
 */
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
  const [dl, setDl] = useState<DotLottie | null>(null)

  useEffect(() => {
    if (!dl) return
    // 줄이기 = 재생하지 않고 정해진 프레임에 멈춤 · 끔 = 아직 안 끝난 연출만 autoplay 대로(플레이어는 만들 때 autoplay 만 읽는다)
    const sync = () => {
      if (!dl.isLoaded) return
      if (still) {
        dl.pause()
        dl.setFrame(reducedMotion === 'first-frame' ? 0 : Math.max(dl.totalFrames - 1, 0))
        finish()
      } else if (autoplay && !finished.current && !dl.isPlaying) {
        dl.play()
      }
    }
    dl.addEventListener('load', sync)
    dl.addEventListener('complete', finish)
    dl.addEventListener('loadError', finish)
    sync()
    return () => {
      dl.removeEventListener('load', sync)
      dl.removeEventListener('complete', finish)
      dl.removeEventListener('loadError', finish)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish 는 마운트당 1회 가드가 있는 ref 기반
  }, [dl, still, reducedMotion, autoplay])

  if (still && reducedMotion === 'hide') return null

  const src = typeof source === 'string' ? source : 'uri' in source ? source.uri : undefined
  const data = typeof source === 'object' && !('uri' in source) ? JSON.stringify(source) : undefined

  return (
    <View style={[{ width: size, height: size }, style]} {...a11yProps(label)}>
      {known && (
        <DotLottieReact
          dotLottieRefCallback={setDl}
          src={src}
          data={data}
          autoplay={autoplay && !still}
          loop={loop}
          style={{ width: size, height: size }}
        />
      )}
    </View>
  )
}
