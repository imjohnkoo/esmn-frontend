import { afterEach, describe, expect, it, vi } from 'vitest'
import { activeCatalog, fixtureCatalog } from '../../../shared/catalog/test-data'
import type { CatalogView } from '../../../shared/catalog/types'

/**
 * 홈 데이터 라우트 fail-closed (catalog spec S-1 · E2E-10) — 실 카탈로그에서 인기 목록 코드가 빠지면 500.
 * 홈 페이지가 이 500 을 페이지 500 으로 다시 던져 프리렌더(빌드)가 멈춘다(그 결선은 빌드 실측 — plan as-built).
 * Nitro 전역(defineEventHandler · createError · useCatalog)만 바꿔 끼워 핸들러를 직접 부른다.
 */
async function handlerWith(catalog: CatalogView) {
  vi.resetModules()
  vi.stubGlobal('defineEventHandler', (h: unknown) => h)
  vi.stubGlobal('createError', (o: { statusCode: number; statusMessage: string }) =>
    Object.assign(new Error(o.statusMessage), o),
  )
  vi.stubGlobal('useCatalog', async () => catalog)
  const mod = await import('./home.get')
  return mod.default as unknown as () => Promise<{ popular: unknown[]; multi: unknown[] }>
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('GET /api/catalog/home', () => {
  it('실 카탈로그 — 인기국가 12 · 다국가 12', async () => {
    const home = await (await handlerWith(activeCatalog()))()
    expect(home.popular).toHaveLength(12)
    expect(home.multi).toHaveLength(12)
  })

  it('실 카탈로그에서 목록 코드가 빠지면 500 — 상태 메시지는 ASCII(h3 가 그 밖의 글자를 지운다)', async () => {
    const cat = activeCatalog()
    const broken = { ...cat, zones: cat.zones.filter((z) => z.zone !== 'NLD00') }
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const run = await handlerWith(broken)
    await expect(run()).rejects.toMatchObject({
      statusCode: 500,
      statusMessage: expect.stringMatching(/^[\x20-\x7e]+$/),
    })
    expect(log.mock.calls.join(' ')).toContain('인기국가 NLD')
  })

  it('표본 픽스처는 없는 칸을 건너뛴다(개발용 — 머지 게이트는 «실 카탈로그는 표본 아님» 테스트)', async () => {
    const home = await (await handlerWith(fixtureCatalog()))()
    expect(home.popular.length).toBeGreaterThan(0)
    expect(home.popular.length).toBeLessThan(12)
  })
})
