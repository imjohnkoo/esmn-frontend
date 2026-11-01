// 발급 요청 실패를 어느 화면으로 보낼지(client-consent-log spec §⑤ ST-4 · D-21 · D-22).
// 동의 기록 문제(서버 data.code CONSENT_REQUIRED · CONSENT_LOG_FAILED)만 «다시 시도» — 팝업으로 돌아가 다시 누르면 된다.
// 그 밖(provider 400 · 404 · 403 · 409 · 발급 500 · 네트워크)은 지금까지처럼 본인 확인으로 돌려보낸다.
// 상태 코드 · message 글자로 판정하지 않는다 — 400 은 provider 거절에도 쓴다
const RETRY_CODES = new Set(['CONSENT_REQUIRED', 'CONSENT_LOG_FAILED'])

export type IssueFailureView = 'consent-retry' | 'order-missing'

export function issueFailureView(error: unknown): IssueFailureView {
  // $fetch(ofetch) 오류의 data = h3 오류 응답 본문 { statusCode, message, data } → 서버가 단 code 는 data.data.code
  const code = (error as { data?: { data?: { code?: unknown } } } | null)?.data?.data?.code
  return typeof code === 'string' && RETRY_CODES.has(code) ? 'consent-retry' : 'order-missing'
}
