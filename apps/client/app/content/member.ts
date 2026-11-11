// 회원 화면 문안 — 한 곳(member-client-auth spec ⑤ · 디자인 패킷 MEMBER copy.md @ c4f2065 + C-1 · C-2 · E-3w · 디자인 리뷰 R2 · R3 · R4).
// 계정 유무를 드러내는 문장 금지(K-A3) · «회원님» · «고객님» · «OTP» · «세션» · «토큰» 금지(copy.md §3).
// 숫자는 spec §4.2 와 같다 — 코드 10분 · 재발송 60초 · 재설정 링크 30분 · 잠금 15분.

export const MEMBER_MIN_PASSWORD = 8
export const MEMBER_MAX_PASSWORD = 128
export const RESEND_SECONDS = 60

/** 대화상자 문안 — { title, body } */
export const MEMBER_DIALOG = {
  e1: { title: '이메일 또는 비밀번호가 맞지 않아요', body: '다시 확인해 주세요.' },
  e3: {
    title: '잠시 후 다시 시도해 주세요',
    body: '로그인에 여러 번 실패해서 15분 동안 로그인을 막았어요. 비밀번호가 기억나지 않으면 재설정해 주세요.',
  },
  e3w: {
    title: '잠시 후 다시 시도해 주세요',
    body: '비밀번호를 여러 번 틀려서 15분 동안 로그인과 탈퇴를 막았어요. 비밀번호가 기억나지 않으면 재설정해 주세요.',
  },
  e30: { title: '잠시 후 다시 시도해 주세요', body: '연결이 원활하지 않아요.' },
  e31: { title: '이미 가입된 이메일이에요', body: '로그인하거나 비밀번호를 재설정해 주세요.' },
  c1: {
    title: '잠시 후 다시 시도해 주세요',
    body: '코드를 너무 자주 요청했어요. 잠시 후 다시 받아 주세요.',
  },
  c2: {
    title: '가입 시간이 지났어요',
    body: '코드를 받은 지 10분이 지나서 처음부터 다시 해야 해요.',
  },
  codeMismatch: { title: '코드가 맞지 않아요', body: '처음부터 다시 진행해 주세요.' },
  codeLocked: {
    title: '이 코드는 쓸 수 없어요',
    body: '여러 번 틀려서 이 코드는 쓸 수 없어요. 새 코드를 받아 주세요.',
  },
} as const

/** 칸 아래 한 줄 */
export const MEMBER_FIELD = {
  e2: '이메일 주소를 다시 확인해 주세요.',
  e5: '코드가 맞지 않아요. 다시 입력해 주세요.',
  e6: '코드 입력 시간이 지났어요. 새 코드를 받아 주세요.',
  e7: '여러 번 틀려서 이 코드는 쓸 수 없어요. 새 코드를 받아 주세요.',
  e8: '8자 이상으로 정해 주세요.',
  e8max: '128자 이하로 정해 주세요.',
  e16: '비밀번호가 맞지 않아요.',
  pwEmpty: '비밀번호를 입력해 주세요.',
} as const

/** 도착 화면에 한 번 보이는 안내(토스트 대신 상태 줄 — plan as-built) */
export const MEMBER_FLASH = {
  e10: '가입을 마쳤어요.',
  e11: '비밀번호를 바꿨어요. 모든 기기에서 로그아웃됐으니 새 비밀번호로 로그인해 주세요.',
  e13: '로그아웃했어요.',
  e17: '탈퇴했어요. 그동안 이용해 주셔서 고마워요.',
} as const

export type MemberFlash = keyof typeof MEMBER_FLASH

/** E-0 — 구매하기에서 로그인으로 왔을 때(`next` 가 상품 · 결제 경로) */
export const PURCHASE_LOGIN_NOTE =
  '구매하려면 로그인이 필요해요. 로그인하면 고른 상품으로 바로 돌아와요.'

export function codeSentText(maskedEmail: string): string {
  return `${maskedEmail}으로 코드를 보냈어요. 10분 안에 입력해 주세요.`
}

export function unissuedWarningTitle(n: number): string {
  return `아직 QR 코드를 받지 않은 주문이 ${n}건 있어요`
}

/** 화면에서 바로 가리는 이메일(서버 maskEmail 과 같은 규칙) — 입력값을 화면에 그대로 다시 보이지 않게 */
export function maskEmailForView(email: string): string {
  const e = email.trim().toLowerCase()
  const at = e.lastIndexOf('@')
  if (at < 1) return e
  const local = e.slice(0, at)
  return `${local.slice(0, local.length <= 2 ? 1 : 2)}***${e.slice(at)}`
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** 새 비밀번호 칸 오류 — 길이는 코드 포인트(서버 parsePassword 와 같은 셈). 통과면 빈 문자열 */
export function passwordError(pw: string): string {
  const n = [...pw].length
  if (n < MEMBER_MIN_PASSWORD) return MEMBER_FIELD.e8
  if (n > MEMBER_MAX_PASSWORD) return MEMBER_FIELD.e8max
  return ''
}

/** E-0 — 구매하기에서 로그인으로 왔는가(spec S-2): `/products/…` 또는 `/checkout`(그 자체 · `/checkout/…` · `?…` — `/checkout-preview` 는 아님) */
export function isPurchaseNext(next: string): boolean {
  return /^\/(products\/|checkout(\/|$|\?))/.test(next)
}

/** C-5 — 탈퇴 경고 재료를 받지 못했을 때(D-29) */
export const UNISSUED_UNKNOWN =
  'QR 코드를 받지 않은 주문이 있는지 확인하지 못했어요. 탈퇴하기 전에 내 주문을 확인해 주세요.'
