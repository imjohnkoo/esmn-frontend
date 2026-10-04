import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import { readSource } from '#shared/catalog/test-source'

// catalog spec F-10 · D-13 — 대상 미들웨어를 그대로 돌린다. Nuxt 전역(defineNuxtRouteMiddleware · navigateTo)만 대신한다.
const calls: unknown[][] = []
vi.stubGlobal('defineNuxtRouteMiddleware', (fn: unknown) => fn)
vi.stubGlobal('navigateTo', (...args: unknown[]) => {
  calls.push(args)
  return args[0]
})
const { default: catalogPath } = await import('./catalog-path')
type Route = { path: string; query: Record<string, string>; hash: string }
const run = (to: Route) => (catalogPath as unknown as (to: Route) => unknown)(to)

describe('catalog-path 미들웨어 — 소문자 정규화', () => {
  it('대문자 → 소문자 주소로(쿼리 · 해시 유지) · SSR 301 · 클라이언트 이동은 방문 기록을 덮지 않는다(replace 없음)', () => {
    calls.length = 0
    // 미들웨어가 돌려준 값이 이동을 바꾼다(돌려주지 않으면 SSR 301 도 클라이언트 정규화도 없다 — 대문자 주소가 404)
    expect(run({ path: '/products/FRA00', query: { utm_source: 'x' }, hash: '#plans' })).toEqual({
      path: '/products/fra00',
      query: { utm_source: 'x' },
      hash: '#plans',
    })
    expect(calls).toEqual([
      [
        { path: '/products/fra00', query: { utm_source: 'x' }, hash: '#plans' },
        { redirectCode: 301 },
      ],
    ])
    const opts = calls[0]![1] as { replace?: boolean }
    expect(opts.replace).toBeUndefined()
  })

  it('/countries/JPN · /countries/Fra/ 도 소문자 한 벌로', () => {
    expect(run({ path: '/countries/JPN', query: {}, hash: '' })).toEqual({
      path: '/countries/jpn',
      query: {},
      hash: '',
    })
    expect(run({ path: '/countries/Fra/', query: {}, hash: '' })).toEqual({
      path: '/countries/fra',
      query: {},
      hash: '',
    })
  })

  it('이미 소문자 · 카탈로그 밖이면 그대로', () => {
    calls.length = 0
    expect(run({ path: '/countries/fra', query: {}, hash: '' })).toBeUndefined()
    expect(run({ path: '/guide', query: {}, hash: '' })).toBeUndefined()
    expect(calls).toEqual([])
  })

  it('클라이언트 전용 분기 · replace 가 없다 — vitest 는 import.meta.client 를 돌리지 않으므로 소스로 잠근다', () => {
    const FILE = fileURLToPath(new URL('./catalog-path.ts', import.meta.url))
    const tokens = readSource(FILE).script.map((t) => t.text)
    expect(tokens).not.toContain('replace')
    expect(tokens.join(' ')).not.toMatch(/import \. meta \. (client|server)/)
  })
})
