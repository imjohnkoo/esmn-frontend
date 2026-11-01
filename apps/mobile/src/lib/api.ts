/**
 * Mobile → client Nitro API wrapper.
 *
 * 동작:
 *  - base URL = `EXPO_PUBLIC_API_BASE_URL` (dev fallback `http://localhost:3000`)
 *  - `X-Client-Platform: mobile` 헤더 (client middleware/auth.ts 의 platform 감지 트리거)
 *  - 미래 Bearer 토큰 자리 (`setAuthToken()`) — E-2 의 auth middleware placeholder 와 짝
 *  - 응답이 ok 가 아니면 throw — 호출자가 try/catch
 */

import type {
  VerifyOrderRequest,
  VerifyOrderResponse,
  ActivateOrderRequest,
  ActivateOrderResponse,
} from './types'

const DEFAULT_BASE_URL = 'http://localhost:3000'

function getBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_BASE_URL
}

let authToken: string | null = null

export function setAuthToken(token: string | null): void {
  authToken = token
}

async function request<TBody, TResponse>(
  path: string,
  method: 'GET' | 'POST',
  body?: TBody,
): Promise<TResponse> {
  const url = `${getBaseUrl()}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'mobile',
  }
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`
  }

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${method} ${path} → ${res.status} ${res.statusText} ${text}`)
  }

  return res.json() as Promise<TResponse>
}

export const api = {
  verifyOrder(body: VerifyOrderRequest): Promise<VerifyOrderResponse> {
    return request<VerifyOrderRequest, VerifyOrderResponse>('/api/v1/verify', 'POST', body)
  },
  // consent 없이 보낸다 — mobile 은 발급 동의 UI 가 없어 동의를 꾸며 보내지 않는다. 서버는 400(CONSENT_REQUIRED)으로 거절한다
  // (client-consent-log spec F-8 · 알려진 영향 — 동의 UI 는 mobile 트랙 몫)
  activateOrder(body: Omit<ActivateOrderRequest, 'consent'>): Promise<ActivateOrderResponse> {
    return request<Omit<ActivateOrderRequest, 'consent'>, ActivateOrderResponse>('/api/v1/activate', 'POST', body)
  },
  health(): Promise<{ status: string; app: string; commit: string; timestamp: string }> {
    return request<undefined, { status: string; app: string; commit: string; timestamp: string }>(
      '/api/health',
      'GET',
    )
  },
}
