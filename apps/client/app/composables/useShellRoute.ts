/**
 * 셸(하단 탭 · 헤더)이 읽는 라우트 — 오류 화면이 «그 오류가 난 주소» 라우트를 내려 주면 그것, 아니면 `useRoute()`.
 * 오류에서는 `useRoute()` 가 갱신되지 않아 앞 화면의 탭이 켜지거나 메뉴가 열린 채 남는다(catalog spec S-7).
 */
import type { InjectionKey } from 'vue'
import { inject } from 'vue'
import type { RouteLocationNormalizedLoaded } from 'vue-router'

export const ERROR_ROUTE_KEY: InjectionKey<RouteLocationNormalizedLoaded> = Symbol('error-route')

export function useShellRoute(): RouteLocationNormalizedLoaded {
  return inject(ERROR_ROUTE_KEY, null) ?? useRoute()
}
