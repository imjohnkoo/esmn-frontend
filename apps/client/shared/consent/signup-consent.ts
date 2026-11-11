// 가입 필수 동의 — 판 · 해시 상수(member-client-auth spec D-17 · I-9). 화면(signup 3단계) · 서버(검증 · consent_log) · 테스트가 여기서만 가져온다.
// textHash = SHA-256(LINES.join('\n')) hex — 화면은 LINES 를 그대로 그린다(글자 한 곳). 글자를 바꾸면 signup-consent.test.ts 가 깨진다 →
// textVersion 과 textHash 를 함께 올린다. 첫 판 = 디자인 패킷 copy.md M-3c · A-L(legal-pages) 문안이 오면 개시 전에 바꾼다.
export interface SignupConsent {
  kind: 'signup-terms'
  textVersion: string
  textHash: string
}

export const SIGNUP_CONSENT_LINES = [
  '(필수) 이용약관에 동의해요',
  '(필수) 만 14세 이상이에요',
] as const

export const SIGNUP_CONSENT: SignupConsent = {
  kind: 'signup-terms',
  textVersion: 'signup-v1',
  textHash: '3f70076c18428a6122539c0a4e37c0aad8425637cf77295073d767009e10a978',
}
