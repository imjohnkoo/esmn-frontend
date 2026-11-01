// 발급 필수 동의 — 판 · 해시 상수(client-consent-log spec F-2 · D-2 · D-3). 화면(바디) · 서버(검증 · consent_log) · 테스트가 여기서만 가져온다.
// textHash = IssueConsentLabel 이 렌더한 글자(textContent → NFC → 공백 접기 → trim)의 SHA-256 hex — 런타임에 계산하지 않는다.
// 글자가 바뀌면 IssueConsentLabel.hash.dom.test.ts 가 깨진다 → textVersion 과 textHash 를 함께 올린다(spec I-4).
export interface IssueConsent {
  kind: 'issue-terms'
  textVersion: string
  textHash: string
}

export const ISSUE_CONSENT: IssueConsent = {
  kind: 'issue-terms',
  // 게시 판 = client-shell spec D-51 글자
  textVersion: 'issue-D51-v1',
  textHash: '168299c05fbe4c01a473fcb9d1878622d4652b0f4d88d78b4ffdf0857ae7ea7d',
}
