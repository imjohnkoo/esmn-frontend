/**
 * 공용 wire 타입 — apps/client 의 server route + apps/mobile (workspace 직접 의존) 이 공유.
 *
 * 본 PR (E-2) 단계에선 cross-cutting 응답 wrap + auth context placeholder 만 정의.
 * 도메인별 wire 타입 (VerifyOrderRequest 등) 은 E-3 시점에 `app/types/api.ts` 에서 단일 소스화.
 */

/** Client 식별 — middleware 에서 헤더(X-Client-Platform) 또는 User-Agent 로 추정 */
export type ClientPlatform = 'web' | 'mobile' | 'unknown'

/** 인증 컨텍스트 — server/middleware/auth.ts 가 event.context.auth 에 채운다(member-client-auth F-3). PII 를 싣지 않는다 */
export interface AuthUser {
  serviceUserId: number
  sessionId: number
}

export interface AuthContext {
  user: AuthUser | null
  platform: ClientPlatform
}

/** 표준 성공 응답 wrap */
export interface ApiSuccessResponse<T> {
  ok: true
  data: T
}

/** 표준 실패 응답 wrap — Nitro 의 createError 가 throw 하면 h3 가 별 형식으로 직렬화하므로,
 *  본 타입은 endpoint 가 의도적으로 ok:false 를 반환할 때만 사용 (예: 도메인 레벨 reject) */
export interface ApiErrorResponse {
  ok: false
  error: {
    code: string
    message: string
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

/** Nitro h3 의 event.context 확장 — middleware 에서 채움 */
declare module 'h3' {
  interface H3EventContext {
    auth?: AuthContext
  }
}
