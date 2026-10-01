/**
 * P9-4 문안 대기 자리표시자 — 사업자정보 · 고객센터 · 약관 · 처리방침 · 환불정책의 «아직 확정되지 않은 값».
 *
 * 값 정본은 John(Proposal P9-4). 콘텐츠 파일은 확정 전 값을 `P9_4_PENDING` 으로 두고, 화면은 «(확정 전)» 으로 보인다.
 * ⛔ main 머지 게이트(spec D-17): 이 파일 · 테스트 밖에서 `P9_4_PENDING` 을 쓰는 파일이 0 이어야 한다.
 *    bash .github/scripts/content-pending-gate.sh   → 0 (nomacomfe-finish-branch Step 0 이 부른다)
 * 판정 함수 · 타입은 이 파일에만 둔다 — 그래야 위 명령이 «남은 자리표시자» 만 센다(테스트 픽스처는 제외).
 */

export const P9_4_PENDING = 'P9_4_PENDING' as const

export type Pending = typeof P9_4_PENDING

/** 확정되면 문자열, 확정 전이면 자리표시자 */
export type ContentValue = string | Pending

export const PENDING_LABEL = '(확정 전)'

export function isPending(value: unknown): value is Pending {
  return value === P9_4_PENDING
}

export function displayValue(value: ContentValue): string {
  return isPending(value) ? PENDING_LABEL : value
}
