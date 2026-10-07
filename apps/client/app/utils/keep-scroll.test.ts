import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { keepScrollAfterClose } from './keep-scroll'

/** client-guide S-4 · D-25 · QA ⑥ R13 — 시트를 닫은 뒤 포커스 복귀가 만든 스크롤만 되돌린다 */
class FakeWindow extends EventTarget {
  scrollY = 0
  scrollTo(_x: number, y: number) {
    this.scrollY = y
  }
  /** 브라우저가 스크롤한 것처럼 — 위치를 바꾸고 scroll 이벤트 */
  browserScroll(y: number) {
    this.scrollY = y
    this.dispatchEvent(new Event('scroll'))
  }
}
const make = (y: number) => {
  const w = new FakeWindow()
  w.scrollY = y
  return w
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('keepScrollAfterClose', () => {
  it('닫은 뒤 생긴 스크롤(포커스 복귀)은 닫을 때 자리로 되돌린다 — 여러 번이어도', () => {
    const w = make(338)
    keepScrollAfterClose(w as unknown as Window)
    w.browserScroll(366.5)
    expect(w.scrollY).toBe(338)
    w.browserScroll(300)
    expect(w.scrollY).toBe(338)
  })

  it('1px 이하 차이는 그대로(소수점 반올림 흔들림에 되돌리기를 반복하지 않게)', () => {
    const w = make(100)
    keepScrollAfterClose(w as unknown as Window)
    w.browserScroll(100.5)
    expect(w.scrollY).toBe(100.5)
  })

  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])(
    '사용자가 직접 움직이면(%s) 그 뒤 스크롤은 건드리지 않는다',
    (type) => {
      const w = make(200)
      keepScrollAfterClose(w as unknown as Window)
      w.dispatchEvent(new Event(type))
      w.browserScroll(500)
      expect(w.scrollY).toBe(500)
    },
  )

  it('정해진 시간(기본 1.5초)이 지나면 손을 뗀다 · 돌려준 stop 으로 바로 뗄 수도 있다', () => {
    const w = make(50)
    keepScrollAfterClose(w as unknown as Window)
    vi.advanceTimersByTime(1499)
    w.browserScroll(80)
    expect(w.scrollY).toBe(50)
    vi.advanceTimersByTime(2)
    w.browserScroll(90)
    expect(w.scrollY).toBe(90)

    const v = make(10)
    const stop = keepScrollAfterClose(v as unknown as Window)
    stop()
    v.browserScroll(40)
    expect(v.scrollY).toBe(40)
  })
})
