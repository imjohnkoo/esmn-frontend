import { lowercaseRedirect } from '~/utils/catalog-path'

// 카탈로그 URL 소문자 정규화(catalog spec D-13) — `/countries/[iso3]` · `/products/[zone]` 가 definePageMeta 로 건다.
// SSR 에서는 301 응답, 클라이언트 이동에서는 그 이동을 소문자 주소로 바꿔 끝낸다 — replace 를 주면 직전 방문 기록이 덮여
// 뒤로 가기가 한 칸을 건너뛴다(대문자 주소는 기록에 남기 전에 바뀌므로 치환할 것이 없다).
export default defineNuxtRouteMiddleware((to) => {
  const target = lowercaseRedirect(to.path)
  if (target)
    return navigateTo({ path: target, query: to.query, hash: to.hash }, { redirectCode: 301 })
})
