/**
 * 구매 시트 카운트다운(catalog spec F-8 · K2) — 3 → 2 → 1 → 0 에서 한 번 `onDone`. `stop()` 뒤에는 아무것도 부르지 않는다.
 * 타이머를 주입받아 테스트한다(vi.useFakeTimers).
 */
export interface Countdown {
  stop(): void
}

export function startCountdown(
  seconds: number,
  onTick: (remaining: number) => void,
  onDone: () => void,
  timers: { setInterval: typeof setInterval; clearInterval: typeof clearInterval } = globalThis,
): Countdown {
  let remaining = seconds
  let stopped = false
  onTick(remaining)
  const id = timers.setInterval(() => {
    if (stopped) return
    remaining -= 1
    onTick(remaining)
    if (remaining <= 0) {
      stopped = true
      timers.clearInterval(id)
      onDone()
    }
  }, 1000)
  return {
    stop() {
      stopped = true
      timers.clearInterval(id)
    },
  }
}
