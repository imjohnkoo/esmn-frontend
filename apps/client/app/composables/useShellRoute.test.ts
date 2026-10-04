// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, shallowReactive } from 'vue'
import { ERROR_ROUTE_KEY, useShellRoute } from './useShellRoute'

/**
 * catalog spec S-7 «틀도 같은 주소» — 오류 화면이 내려 준 라우트가 있으면 셸(하단 탭 · 헤더)은 그것을 읽는다.
 * 없으면 평소처럼 useRoute() (Nuxt 전역 — 테스트가 끼운다).
 */
const live = { path: '/live', fullPath: '/live' }
afterEach(() => vi.unstubAllGlobals())

function read(provide?: object) {
  vi.stubGlobal('useRoute', () => live)
  let got: unknown
  const Probe = defineComponent({
    setup() {
      got = useShellRoute()
      return () => h('div')
    },
  })
  mount(Probe, provide ? { global: { provide: { [ERROR_ROUTE_KEY as symbol]: provide } } } : {})
  return got
}

describe('useShellRoute', () => {
  it('오류 화면이 내려 준 라우트가 있으면 그것 — useRoute() 가 있어도', () => {
    const errorRoute = shallowReactive({ path: '/abc', fullPath: '/abc' })
    expect(read(errorRoute)).toBe(errorRoute)
  })

  it('없으면 useRoute()', () => {
    expect(read()).toBe(live)
  })
})
