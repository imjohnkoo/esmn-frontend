import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startCountdown } from './countdown'

describe('startCountdown (catalog spec F-8 · E2E-14)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('3 → 2 → 1 → 0 에서 한 번만 이동한다', () => {
    const ticks: number[] = []
    const done = vi.fn()
    startCountdown(3, (n) => ticks.push(n), done)
    expect(ticks).toEqual([3])
    vi.advanceTimersByTime(2999)
    expect(done).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(ticks).toEqual([3, 2, 1, 0])
    expect(done).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(5000)
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('stop() 뒤에는 이동하지 않는다(취소 · 닫기)', () => {
    const done = vi.fn()
    const c = startCountdown(3, () => {}, done)
    vi.advanceTimersByTime(1500)
    c.stop()
    vi.advanceTimersByTime(5000)
    expect(done).not.toHaveBeenCalled()
  })
})
