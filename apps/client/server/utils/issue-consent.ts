import { createHmac } from 'node:crypto'
import { ISSUE_CONSENT } from '../../shared/consent/issue-consent'

// 발급 동의 — activate 바디 검증 · consent_log 값(client-consent-log spec F-4 · F-7 · D-5 · D-6 · D-7)

export type ConsentCheck = 'ok' | 'missing' | 'mismatch'

// 바디 consent 의 세 값이 서버 상수와 모두 같을 때만 ok — 클라이언트가 보낸 판 · 해시를 믿지 않고 대조만 한다
export function checkIssueConsent(value: unknown): ConsentCheck {
  if (!value || typeof value !== 'object') return 'missing'
  const v = value as Record<string, unknown>
  return v.kind === ISSUE_CONSENT.kind &&
    v.textVersion === ISSUE_CONSENT.textVersion &&
    v.textHash === ISSUE_CONSENT.textHash
    ? 'ok'
    : 'mismatch'
}

// 고객 IP — X-Forwarded-For 맨 오른쪽(CloudFront 가 viewer IP 를 끝에 붙인다), 없으면 소켓 주소(D-6).
// ponytail: 원본(:3000)이 공개라 CloudFront 를 안 거친 요청은 XFF 를 꾸밀 수 있다 — 원본을 CloudFront prefix list 로 막으면 해소(infra)
export function viewerIp(xff: string | undefined, socket: string | undefined): string | null {
  const last = (xff ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .pop()
  return last ?? (socket?.trim() || null)
}

// HMAC-SHA256(PII_HMAC_KEY 32바이트, UTF-8(ip)) hex(member-core §4.3 과 같은 키 · 방식). 키가 없거나 32바이트가 아니면 null
export function hashIp(ip: string, keyBase64: string | undefined): string | null {
  if (!keyBase64) return null
  const key = Buffer.from(keyBase64, 'base64')
  if (key.length !== 32) return null
  return createHmac('sha256', key).update(ip, 'utf8').digest('hex')
}
