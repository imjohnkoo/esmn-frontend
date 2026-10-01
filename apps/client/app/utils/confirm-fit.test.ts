import { describe, expect, it } from 'vitest'
import {
  CONFIRM_MARGIN,
  CONFIRM_SCROLL_MIN,
  CONFIRM_SCROLL_MIN_COMPACT,
  confirmScrollFit,
} from './confirm-fit'

/**
 * client-shell spec F-20 — 발급 확인 팝업 스크롤 높이. 고정 부분(다이얼로그 − 스크롤 영역) 높이는 3008 빌드를 크기별로 잰 값
 * (QA 5회차 뒤 iframe 실측 — 체크 밖 = 보통 · 체크 안 = compact). 화면이 하는 일(체크 밖으로 재고 → 모자라면 compact 로 다시 잰다)을
 * 그대로 따라 «다이얼로그가 화면 안» 인지 본다. 요약 + 안내(+ compact 면 체크) 내용 = 360(+110).
 */
const CONTENT = 360
const AGREE = 110
function open(viewport: number, fixedNormal: number, fixedCompact: number) {
  let compact = false
  let r = confirmScrollFit(viewport, fixedNormal + CONTENT, CONTENT, false)
  if (r.compact) {
    compact = true
    r = confirmScrollFit(viewport, fixedCompact + CONTENT + AGREE, CONTENT + AGREE, true)
  }
  const scroll = Math.min(compact ? CONTENT + AGREE : CONTENT, r.max)
  return { compact, dialog: (compact ? fixedCompact : fixedNormal) + scroll }
}

describe('confirmScrollFit — 다이얼로그가 화면 안(«발급하기» 가 잘리지 않는다)', () => {
  it.each([
    ['390×844 세로', 844, 302],
    ['360×640 세로', 640, 304],
    ['375×548 SE 인앱', 548, 308],
    ['326×481 작은 화면', 481, 354],
  ])('%s — 동의 체크는 밖(늘 보임) · 스크롤만 줄인다', (_, vh, fixed) => {
    const r = open(vh, fixed, fixed - AGREE)
    expect(r.compact).toBe(false)
    expect(r.dialog).toBeLessThanOrEqual(vh - CONFIRM_MARGIN)
  })

  it.each([
    ['Android 가로 844×300', 300, 237],
    ['가로 568×320', 320, 237],
    ['iPhone 175% 확대 223×377', 377, 258],
    ['iPhone 150% 확대 250×365', 365, 235],
    ['iPhone 190% 확대 207×449', 449, 254],
  ])('%s — 공간이 모자라면 compact(체크도 스크롤 안) · 그래도 화면 안', (_, vh, fixedCompact) => {
    const r = open(vh, fixedCompact + AGREE + 40, fixedCompact)
    expect(r.compact).toBe(true)
    // 아주 낮은 화면은 여백까지는 못 지킨다 — 다이얼로그(그리고 버튼)가 화면 안이면 된다
    expect(r.dialog).toBeLessThanOrEqual(vh)
  })

  it('높이 = 화면 − (다이얼로그 − 스크롤) − 여백', () => {
    expect(confirmScrollFit(640, 585, 281, false)).toEqual({
      max: 640 - (585 - 281) - CONFIRM_MARGIN,
      compact: false,
    })
  })

  it('최소 높이 — 보통 96 · compact 40(그보다 낮은 화면은 다이얼로그 아래 여백 안에서 버튼이 일부 잘릴 수 있다 — 알고 넘어감)', () => {
    expect(CONFIRM_SCROLL_MIN_COMPACT).toBe(40)
    expect(confirmScrollFit(500, 500, 100, false)).toEqual({
      max: CONFIRM_SCROLL_MIN_COMPACT,
      compact: true,
    })
    expect(confirmScrollFit(200, 500, 100, true).max).toBe(CONFIRM_SCROLL_MIN_COMPACT)
    expect(CONFIRM_SCROLL_MIN).toBe(96)
  })

  it('이미 compact 면 다시 꺼내지 않는다(화면이 넓어져도 체크가 오가며 깜박이지 않게)', () => {
    expect(confirmScrollFit(900, 400, 200, true)).toEqual({
      max: 900 - 200 - CONFIRM_MARGIN,
      compact: true,
    })
  })
})
