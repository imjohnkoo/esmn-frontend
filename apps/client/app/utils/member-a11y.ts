// 회원 화면 접근성(design-qa MEMBER-A2 5-5 · spec D-31) — 제출이 막히면 첫 오류 칸으로 포커스(칸이 describedby 로 오류 문장을 읽는다).
// 코드 6칸은 묶음(role=group)에 aria-invalid 가 붙으므로 그 안의 첫 칸으로 간다 — reka PinInput 의 숨은 input 은 건너뛴다.

/** NPinInput 의 보이는 칸(첫 칸 = 묶음의 첫 일치) — 묶음 안 첫 `input` 은 reka 의 숨은 input 이다 */
export const PIN_FIELD = '.n-pin-input__field'

export function focusFirstInvalid(root: ParentNode | null | undefined): HTMLElement | null {
  const hit = root?.querySelector<HTMLElement>('[aria-invalid="true"]')
  const target = hit?.matches('input, textarea, select')
    ? hit
    : (hit?.querySelector<HTMLElement>(PIN_FIELD) ?? null)
  target?.focus()
  return target
}

/** 다음 렌더 뒤 그 폼의 첫 오류 칸으로 */
export async function focusFirstInvalidIn(formId: string): Promise<void> {
  await nextTick()
  focusFirstInvalid(document.getElementById(formId))
}
