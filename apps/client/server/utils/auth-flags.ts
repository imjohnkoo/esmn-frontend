import { createError, type H3Event } from 'h3'

// 로그인 수단별 플래그(spec F-15 · D-1 · K-A7) — 서버 전용 runtimeConfig `auth.*Enabled` ← env NUXT_AUTH_*_ENABLED.
// 값 없음 = 꺼짐. 화면은 GET /api/v1/auth/session 의 methods 로만 판정한다(프리렌더 · 공개 runtimeConfig 0).
// 코드 경로가 있는 수단은 email 뿐 — google · naver · kakao 는 키만 있고 켜도 methods 에 들어가지 않는다(A2-b 가 여기 한 줄씩 더한다).

export type AuthMethod = 'email'

export interface AuthConfig {
  emailEnabled?: unknown
  googleEnabled?: unknown
  naverEnabled?: unknown
  kakaoEnabled?: unknown
  linkOrigin?: unknown
}

const on = (v: unknown) => v === true || v === 'true'

export function enabledMethods(config: AuthConfig | undefined): AuthMethod[] {
  return on(config?.emailEnabled) ? ['email'] : []
}

export function authConfig(event: H3Event): AuthConfig {
  return (useRuntimeConfig(event).auth ?? {}) as AuthConfig
}

export function authMethods(event: H3Event): AuthMethod[] {
  return enabledMethods(authConfig(event))
}

/** 회원 기능이 꺼져 있으면 404 — auth API 가 있다는 사실도 드러내지 않는다(spec I-6) */
export function requireAuthEnabled(event: H3Event): void {
  // Nitro 의 «없는 라우트» 404 와 같은 모양 — 꺼져 있을 때 경로가 있다는 사실도 드러내지 않게(I-6)
  if (authMethods(event).length === 0) {
    throw createError({
      statusCode: 404,
      statusMessage: `Page not found: ${event.path}`,
      data: { path: event.path },
    })
  }
}
