import React, { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// DS-MOTION — 제안 2026-11-12-motion-foundation §3 reduced-motion · §4 NLottie(앱)
// react-native · lottie-react-native 는 DOM 대역으로 바꾸고 NLottie 의 분기만 본다.

const a11y = vi.hoisted(() => ({
  resolve: null as null | ((v: boolean) => void),
  listeners: new Set<(v: boolean) => void>(),
  emit(v: boolean) {
    for (const l of [...this.listeners]) l(v)
  },
}))

vi.mock('react-native', () => ({
  View: ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
    createElement(
      'div',
      {
        'data-testid': 'n-lottie',
        'data-role': p.accessibilityRole,
        'data-label': p.accessibilityLabel,
        'data-hidden': p.accessibilityElementsHidden ? 'true' : undefined,
      },
      children,
    ),
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

const finishers = vi.hoisted(() => [] as Array<(cancelled: boolean) => void>)
vi.mock('lottie-react-native', () => ({
  default: (p: Record<string, unknown>) => {
    if (typeof p.onAnimationFinish === 'function') finishers.push(p.onAnimationFinish as never)
    return createElement('i', {
      'data-testid': 'lottie',
      'data-autoplay': String(p.autoPlay),
      'data-loop': String(p.loop),
      'data-progress': p.progress === undefined ? undefined : String(p.progress),
    })
  },
}))

const { NLottie } = await import('../components/NLottie/NLottie')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let host: HTMLElement
beforeEach(() => {
  host = document.createElement('div')
  root = createRoot(host)
  finishers.length = 0
})
afterEach(() => {
  act(() => root.unmount())
  expect(a11y.listeners.size).toBe(0) // 마지막 부품이 내려가면 OS 구독도 푼다
})

const lottie = () => host.querySelector('[data-testid="lottie"]')
const render = (props: Partial<React.ComponentProps<typeof NLottie>> = {}) =>
  act(() => root.render(<NLottie source={{ uri: 'x.json' }} {...props} />))
const settle = (reduced: boolean) =>
  act(async () => {
    a11y.resolve?.(reduced)
  })

describe('NLottie (앱)', () => {
  it('설정을 아직 모르는 동안은 플레이어를 그리지 않는다 — 줄이기 켬 기기에서 첫 프레임이 재생되지 않게', async () => {
    render()
    expect(host.querySelector('[data-testid="n-lottie"]')).not.toBeNull()
    expect(lottie()).toBeNull()
    await settle(true)
    expect(lottie()?.getAttribute('data-autoplay')).toBe('false')
  })

  it('label 이 있으면 이미지 · 이름, 없으면 장식(스크린리더 숨김)', async () => {
    render({ label: '발급 완료' })
    await settle(false)
    const box = host.querySelector('[data-testid="n-lottie"]')!
    expect(box.getAttribute('data-role')).toBe('image')
    expect(box.getAttribute('data-label')).toBe('발급 완료')
    render({})
    expect(box.getAttribute('data-hidden')).toBe('true')
    expect(box.getAttribute('data-role')).toBeNull()
  })

  it('줄이기 끔 — autoplay · loop 그대로 재생, 끝나면 onComplete 1회(취소는 제외)', async () => {
    const onComplete = vi.fn()
    render({ onComplete })
    await settle(false)
    expect(lottie()?.getAttribute('data-autoplay')).toBe('true')
    expect(lottie()?.getAttribute('data-loop')).toBe('false')
    expect(lottie()?.getAttribute('data-progress')).toBeNull()
    act(() => finishers.at(-1)!(true))
    expect(onComplete).not.toHaveBeenCalled()
    act(() => finishers.at(-1)!(false))
    act(() => finishers.at(-1)!(false))
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['last-frame', '1'],
    ['first-frame', '0'],
  ] as const)(
    '줄이기 켬 · %s — 재생하지 않고 progress %s 정지 + onComplete 즉시',
    async (mode, progress) => {
      const onComplete = vi.fn()
      render({ reducedMotion: mode, onComplete })
      await settle(true)
      expect(lottie()?.getAttribute('data-autoplay')).toBe('false')
      expect(lottie()?.getAttribute('data-progress')).toBe(progress)
      expect(onComplete).toHaveBeenCalledTimes(1)
    },
  )

  it('줄이기 켬 · hide — 아무것도 그리지 않고 onComplete 즉시', async () => {
    const onComplete = vi.fn()
    render({ reducedMotion: 'hide', onComplete })
    await settle(true)
    expect(host.innerHTML).toBe('')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('loop · autoplay=false 는 줄이기 켬이어도 onComplete 를 내지 않는다', async () => {
    const onComplete = vi.fn()
    render({ loop: true, onComplete })
    await settle(true)
    render({ autoplay: false, onComplete })
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('재생 중 줄이기를 켜면 정지 프레임 + onComplete 1회, 다시 꺼도 처음부터 다시 돌지 않는다', async () => {
    const onComplete = vi.fn()
    render({ onComplete })
    await settle(false)
    act(() => a11y.emit(true))
    expect(lottie()?.getAttribute('data-progress')).toBe('1')
    expect(onComplete).toHaveBeenCalledTimes(1)
    act(() => a11y.emit(false))
    expect(lottie()?.getAttribute('data-progress')).toBe('1')
    expect(lottie()?.getAttribute('data-autoplay')).toBe('false')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('두 부품이 OS 구독 하나를 같이 쓰고, 한쪽이 내려가도 남은 쪽은 계속 따라간다', async () => {
    const other = document.createElement('div')
    const otherRoot = createRoot(other)
    render()
    act(() => otherRoot.render(<NLottie source={{ uri: 'y.json' }} />))
    await settle(false)
    expect(a11y.listeners.size).toBe(1)
    act(() => root.render(<></>))
    act(() => a11y.emit(true))
    expect(other.querySelector('[data-testid="lottie"]')?.getAttribute('data-progress')).toBe('1')
    act(() => otherRoot.unmount())
  })
})
