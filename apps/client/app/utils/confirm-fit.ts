/**
 * 발급 확인 팝업의 스크롤 높이(client-shell spec F-20 · D-32 · D-35) — select-date 팝업이 부른다.
 * 팝업은 페이지 스크롤을 잠그고 다이얼로그 자체는 넘치는 부분을 자른다 → «뒤로 · 발급하기» 가 화면 안에 남게
 * 요약 · 안내만 스크롤하고, 그 높이 = 화면 − (다이얼로그 − 스크롤 영역) − 여백.
 * 동의 체크를 밖에 둔 채로는 스크롤 최소 높이도 못 얻는 화면(가로 · 글자 크게)이면 compact — 체크도 스크롤 안으로 넣어
 * 고정 부분을 줄인다(체크 · 버튼보다 버튼을 지킨다).
 */
export const CONFIRM_SCROLL_MIN = 96
/** compact 일 때의 최소 — 낮은 가로 화면(약 300px)에서도 버튼이 들어가게 더 줄인다 */
export const CONFIRM_SCROLL_MIN_COMPACT = 40
export const CONFIRM_MARGIN = 24

export interface ConfirmFit {
  /** 스크롤 영역 max-height(px) */
  max: number
  /** 동의 체크를 스크롤 안으로 넣어야 하는가 */
  compact: boolean
}

/**
 * @param viewport 화면 높이(layout viewport — 다이얼로그가 고정되는 기준. 손가락 확대의 visual viewport 가 아니다)
 * @param dialog 다이얼로그 높이(offsetHeight — 열림 애니메이션의 scale 영향 없음)
 * @param scroll 지금 스크롤 영역 높이
 * @param compact 이미 compact 인가(체크가 스크롤 안에 있다)
 */
export function confirmScrollFit(
  viewport: number,
  dialog: number,
  scroll: number,
  compact: boolean,
): ConfirmFit {
  const fixed = dialog - scroll
  const avail = Math.floor(viewport - fixed - CONFIRM_MARGIN)
  if (!compact && avail < CONFIRM_SCROLL_MIN) return { max: CONFIRM_SCROLL_MIN_COMPACT, compact: true }
  return { max: Math.max(compact ? CONFIRM_SCROLL_MIN_COMPACT : CONFIRM_SCROLL_MIN, avail), compact }
}
