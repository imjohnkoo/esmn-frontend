// 구매 시트 보조 버튼 표시 판정(client-shell spec D-60) — Nitro 자동 import 는 대역.
import { describe, expect, it, vi } from 'vitest'

const config = { public: { toss: { clientKey: '' } } }
vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
vi.stubGlobal('useRuntimeConfig', () => config)

const handler = (await import('./test-key.get')).default as unknown as () => unknown

describe('GET /api/v1/checkout-preview/test-key (D-60)', () => {
  it.each([
    ['test_gck_docs_abc', true],
    ['live_gck_abc', false],
    ['', false],
    ['xtest_gck_abc', false],
  ])('키 %j → testKey %s · 키 값은 응답에 없다', (key, testKey) => {
    config.public.toss.clientKey = key
    expect(handler()).toEqual({ testKey })
  })
})
