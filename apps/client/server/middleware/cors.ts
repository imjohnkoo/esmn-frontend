/**
 * CORS middleware — Nitro/h3.
 *
 * 정책:
 *  - `/api/**` 만 CORS 적용 (SSR 페이지는 same-origin 이라 불필요)
 *  - 화이트리스트 origin: localhost dev(웹 Nuxt + Expo dev) + prod CloudFront · esimmany.com · app.esimmany.com
 *    + 런타임 ENV 추가 — 목록과 판정은 `server/utils/cors-origins.ts`
 *  - 허용 헤더: Authorization, Content-Type, X-Client-Platform, X-Requested-With
 *  - expose 헤더: X-Client-Platform (mobile 측 디버깅용)
 *  - credentials: false — 본 PR 은 Bearer + cookie 둘 다 받지만, mobile 채널은 cookie 무관 / 웹은 same-origin 이라 cross-origin credentials 불필요
 *  - preflight (OPTIONS) 204 단답
 */

import { handleCors } from 'h3'
import { isOriginAllowed, parseExtraOrigins } from '../utils/cors-origins'

export default defineEventHandler((event) => {
  const url = event.node.req.url ?? ''
  // SSR 페이지는 CORS 무관 — /api/** 만 처리
  if (!url.startsWith('/api/')) return

  const requestOrigin = getRequestHeader(event, 'origin')

  // origin 없는 호출 (curl, server-to-server, mobile 일부) 은 CORS 검사 자체 불필요 → preflight 만 처리
  if (!requestOrigin) {
    if (event.method === 'OPTIONS') {
      // preflight 그대로 204. handleCors 의 boolean 반환값을 그대로 return 하면
      // h3 가 그 값을 응답 바디로 삼아 요청을 조기 종료하므로 버려야 함
      handleCors(event, {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type', 'X-Client-Platform', 'X-Requested-With'],
        exposeHeaders: ['X-Client-Platform'],
        maxAge: '600',
      })
    }
    return
  }

  const extra = parseExtraOrigins(process.env.CORS_EXTRA_ORIGINS)

  if (!isOriginAllowed(requestOrigin, extra)) {
    // 비허용 origin — 403. preflight 든 본 요청이든 동일하게 차단
    throw createError({
      statusCode: 403,
      statusMessage: 'Origin not allowed',
    })
  }

  // 반환값 (boolean) 을 return 하면 일반 요청까지 바디 `false` 로 조기 종료됨 —
  // preflight 는 handleCors 가 내부에서 응답을 완료하므로 반환값은 버리고 통과시킨다
  handleCors(event, {
    origin: [requestOrigin],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Authorization', 'Content-Type', 'X-Client-Platform', 'X-Requested-With'],
    exposeHeaders: ['X-Client-Platform'],
    credentials: false,
    maxAge: '600',
  })
})
