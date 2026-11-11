import React, { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// 앱 웹 미리 보기(NLottie.web.tsx) — dotlottie-react 플레이어를 대역으로 바꿔 정지 프레임 · complete 를 본다

const a11y = vi.hoisted(() => ({
  resolve: null as null | ((v: boolean) => void),
  listeners: new Set<(v: boolean) => void>(),
  emit(v: boolean) {
    for (const l of [...this.listeners]) l(v)
  },
}))
vi.mock('react-native', () => ({
  View: ({ children }: { children?: React.ReactNode }) =>
    createElement('div', { 'data-testid': 'n-lottie' }, children),
  AccessibilityInfo: {
    isReduceMotionEnabled: () =>
      new Promise<boolean>((r) => {
        a11y.resolve = r
      }),
    addEventListener: (_: string, l: (v: boolean) => void) => {
      a11y.listeners.add(l)
      return { remove: () => a11y.listeners.delete(l) }
    },
  },
}))

function makeFake(autoplay: boolean) {
  const handlers = new Map<string, Set<() => void>>()
  return {
    autoplay,
    isLoaded: false,
    isPlaying: false,
    totalFrames: 60,
    pause: vi.fn(),
    play: vi.fn(),
    setFrame: vi.fn(),
    addEventListener(t: string, cb: () => void) {
      if (!handlers.has(t)) handlers.set(t, new Set())
      handlers.get(t)!.add(cb)
    },
    removeEventListener(t: string, cb: () => void) {
      handlers.get(t)?.delete(cb)
    },
    fire(t: string) {
      if (t === 'load') {
        this.isLoaded = true
        this.isPlaying = this.autoplay
      }
      for (const cb of [...(handlers.get(t) ?? [])]) cb()
    },
  }
}
const players = vi.hoisted(() => [] as Array<ReturnType<typeof makeFake>>)
vi.mock('@lottiefiles/dotlottie-react', async () => {
  const { useEffect } = await import('react')
  return {
    DotLottieReact: (p: { autoplay?: boolean; dotLottieRefCallback: (d: unknown) => void }) => {
      useEffect(() => {
        const dl = makeFake(p.autoplay === true) // 실제처럼 만들 때 autoplay 한 번만 읽는다
        players.push(dl)
        p.dotLottieRefCallback(dl)
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return createElement('canvas')
    },
  }
})

const { NLottie } = await import('../components/NLottie/NLottie.web')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let host: HTMLElement
beforeEach(() => {
  host = document.createElement('div')
  root = createRoot(host)
  players.length = 0
})
afterEach(() => {
  act(() => root.unmount())
})

const render = (props: Partial<React.ComponentProps<typeof NLottie>> = {}) =>
  act(() => root.render(<NLottie source={{ uri: 'x.json' }} {...props} />))
const settle = (reduced: boolean) =>
  act(async () => {
    a11y.resolve?.(reduced)
  })

describe('NLottie (앱 웹 미리 보기)', () => {
  it.each([
    ['last-frame', 59],
    ['first-frame', 0],
  ] as const)(
    '줄이기 켬 · %s — 재생하지 않고 setFrame(%s) 정지 + onComplete 1회',
    async (mode, frame) => {
      const onComplete = vi.fn()
      render({ reducedMotion: mode, onComplete })
      await settle(true)
      const dl = players.at(-1)!
      expect(dl.autoplay).toBe(false)
      act(() => dl.fire('load'))
      expect(dl.pause).toHaveBeenCalled()
      expect(dl.setFrame).toHaveBeenLastCalledWith(frame)
      expect(onComplete).toHaveBeenCalledTimes(1)
    },
  )

  it('줄이기 끔 — autoplay 로 만들고 끝나면 onComplete 1회 · 재생 중 켜면 그 자리 정지', async () => {
    const onComplete = vi.fn()
    render({ onComplete })
    await settle(false)
    const dl = players.at(-1)!
    expect(dl.autoplay).toBe(true)
    act(() => dl.fire('load'))
    expect(dl.setFrame).not.toHaveBeenCalled()
    act(() => a11y.emit(true))
    expect(dl.setFrame).toHaveBeenLastCalledWith(59)
    expect(onComplete).toHaveBeenCalledTimes(1)
    act(() => a11y.emit(false))
    expect(dl.play).not.toHaveBeenCalled()
  })

  it('로드 실패(loadError)도 onComplete 로 풀어 준다', async () => {
    const onComplete = vi.fn()
    render({ onComplete })
    await settle(false)
    act(() => players.at(-1)!.fire('loadError'))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })
})
