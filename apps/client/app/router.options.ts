import type { RouterConfig } from '@nuxt/schema'

// 경로 대소문자 구분 (spec D-19) — vue-router 기본(대소문자 무시)이면 `/View/1` · `/Details/1` 이 페이지에 매칭되는데,
// order-flow 가드(flowStepOf) · noindex(isNoindexPath) · routeRules(X-Robots-Tag · no-store) · robots.txt 는 대소문자를 구분해
// 변형 경로가 가드와 캐시 금지를 모두 비껴 갔다. 라우터를 구분 쪽으로 맞춰 네 판정을 하나로 만든다 — 변형 경로는 404.
export default <RouterConfig>{
  sensitive: true,
}
