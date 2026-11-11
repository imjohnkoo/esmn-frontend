// backend `internal/notify/email` 위임(A1 spec «내부 endpoint 계약» · member-client-auth F-4 · F-9).
// env 는 withdraw-cancel 과 같은 ESIM_MANAGER_INTERNAL_ENDPOINT · ESIM_MANAGER_INTERNAL_SECRET. 수신 주소 · 코드 · 링크는 본문에만 — 로그 0
export type MemberEmailKind = 'signup_code' | 'password_reset'

export type SendResult =
  | { ok: true; result: 'SENT' | 'STUBBED'; ms: number }
  | { ok: false; upstreamStatus: number | null; ms: number }

export function emailConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return !!env.ESIM_MANAGER_INTERNAL_ENDPOINT && !!env.ESIM_MANAGER_INTERNAL_SECRET
}

export async function sendMemberEmail(
  kind: MemberEmailKind,
  to: string,
  vars: Record<string, string>,
): Promise<SendResult> {
  const started = Date.now()
  const endpoint = process.env.ESIM_MANAGER_INTERNAL_ENDPOINT
  const secret = process.env.ESIM_MANAGER_INTERNAL_SECRET
  if (!endpoint || !secret) return { ok: false, upstreamStatus: null, ms: 0 }
  try {
    const res = await $fetch<{ result?: string }>(`${endpoint}/internal/notify/email`, {
      method: 'POST',
      headers: { 'X-Internal-Auth': secret, 'Content-Type': 'application/json' },
      body: { kind, to, vars },
      timeout: 10_000,
    })
    const ms = Date.now() - started
    return res?.result === 'SENT' || res?.result === 'STUBBED'
      ? { ok: true, result: res.result, ms }
      : { ok: false, upstreamStatus: 200, ms }
  } catch (e) {
    const err = e as { statusCode?: number; status?: number }
    return {
      ok: false,
      upstreamStatus: err.statusCode ?? err.status ?? null,
      ms: Date.now() - started,
    }
  }
}
