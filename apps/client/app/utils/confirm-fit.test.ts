import { describe, expect, it } from 'vitest'
import {
  CONFIRM_MARGIN,
  CONFIRM_SCROLL_MIN,
  CONFIRM_SCROLL_MIN_COMPACT,
  confirmScrollFit,
} from './confirm-fit'

/**
 * client-shell spec F-20 — 발급 확인 팝업 스크롤 높이. 높이(px)는 QA walk 실측에 맞춘 모델:
 * 제목 · 아이콘 · 버튼 = BASE 230 · 동의 체크 = 90(390 폭) ~ 140(좁고 글자 큼) · 요약 + 안내 = 360.
 * 화면이 하는 일(체크 밖으로 재고 → 모자라면 compact 로 다시 잰다)을 그대로 따라 «다이얼로그가 화면 안» 인지 본다.
 */
const BASE = 230
const CONTENT = 360
function open(viewport: number, agree: number) {
  let compact = false
  let r = confirmScrollFit(viewport, BASE + agree + CONTENT, CONTENT, false)
  if (r.compact) {
    compact = true
    r = confirmScrollFit(viewport, BASE + CONTENT + agree, CONTENT + agree, true)
  }
  const scroll = Math.min(compact ? CONTENT + agree : CONTENT, r.max)
  return { compact, dialog: (compact ? BASE : BASE + agree) + scroll }
}

describe('confirmScrollFit — 다이얼로그가 화면 안(«발급하기» 가 잘리지 않는다)', () => {
  it.each([
    ['390×844 세로', 844, 90],
    ['360×640 세로', 640, 90],
    ['375×548 SE 인앱', 548, 90],
    ['326×481 작은 화면', 481, 110],
  ])('%s — 동의 체크는 밖(늘 보임) · 스크롤만 줄인다', (_, vh, agree) => {
    const r = open(vh, agree)
    expect(r.compact).toBe(false)
    expect(r.dialog).toBeLessThanOrEqual(vh - CONFIRM_MARGIN)
  })

  it.each([
    ['Android 가로 844×300', 300, 90],
    ['가로 568×320', 320, 90],
    ['iPhone 175% 확대 223×377', 377, 140],
    ['iPhone 190% 확대 207×449', 449, 160],
  ])('%s — 공간이 모자라면 compact(체크도 스크롤 안) · 그래도 화면 안', (_, vh, agree) => {
    const r = open(vh, agree)
    expect(r.compact).toBe(true)
    expect(r.dialog).toBeLessThanOrEqual(vh - CONFIRM_MARGIN)
  })

  it('높이 = 화면 − (다이얼로그 − 스크롤) − 여백', () => {
    expect(confirmScrollFit(640, 585, 281, false)).toEqual({
      max: 640 - (585 - 281) - CONFIRM_MARGIN,
      compact: false,
    })
  })

  it('최소 높이 — 보통 96 · compact 40(그보다 낮은 화면은 회전 안내 몫)', () => {
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
