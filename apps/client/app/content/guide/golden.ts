/**
 * 설치 가이드 골든(client-guide spec F-2 · D-3 · D-4) — 콘텐츠 전체를 «읽는 순서 그대로» 한 덩어리로 편다.
 * 문장(표기 포함) · 보조 문장 위치 · 화면 창(화면 · 상태 · 강조 · 비율 · 초점 · 배율 · 대체 글) · 안내 박스 종류 · 공통 문안.
 *
 * `guide.golden.json` 은 2609 원본(design/install-guide/{ios,android}.html @ eb96d75)과 QA ⑥ 리뷰가 기계 대조해
 * spec D-3 · D-4 표 밖 차이 0 을 확인한 상태를 고정한 것이다. 문안 · 창을 일부러 바꾸면
 * spec 표를 먼저 고치고 `WRITE_GUIDE_GOLDEN=1 yarn workspace nomacom-client vitest run app/content/guide` 로 다시 쓴다
 * (그 밖에는 테스트가 어긋남을 막는다).
 */
import { ANDROID_GUIDE } from './android'
import {
  GUIDE_CONTACT,
  GUIDE_FLOW,
  GUIDE_HL_HINT,
  GUIDE_HUB,
  GUIDE_PAGES,
  GUIDE_SECTIONS,
} from './common'
import { GUIDE_FIGURES, type FigureKey } from './figures'
import { IOS_GUIDE } from './ios'

function expand(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(expand)
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, x] of Object.entries(v)) {
      out[k] =
        k === 'figure' && typeof x === 'string'
          ? { key: x, ...GUIDE_FIGURES[x as FigureKey] }
          : expand(x)
    }
    return out
  }
  return v
}

export function guideGolden() {
  return {
    ios: expand(IOS_GUIDE),
    android: expand(ANDROID_GUIDE),
    common: expand({
      GUIDE_FLOW,
      GUIDE_SECTIONS,
      GUIDE_HL_HINT,
      GUIDE_PAGES,
      GUIDE_HUB,
      GUIDE_CONTACT,
    }),
  }
}
