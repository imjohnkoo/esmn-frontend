import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixtureRaw, readRaw } from '../../shared/catalog/test-data'

/**
 * 서버 로더(spec F-1) — `assets:catalog` 에서 실 catalog.json 을 먼저, 없으면 표본을 읽는다.
 * Nitro 전역 useStorage 만 끼운다(메모가 모듈 안에 있어 케이스마다 모듈을 새로 읽는다).
 */
async function loaderWith(files: Record<string, unknown>) {
  vi.resetModules()
  const reads: string[] = []
  vi.stubGlobal('useStorage', (base: string) => ({
    getItem: async (name: string) => {
      if (base !== 'assets:catalog') throw new Error(`다른 저장소 ${base}`)
      reads.push(name)
      return files[name] ?? null
    },
  }))
  const { useCatalog } = await import('./catalog')
  return { useCatalog, reads }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useCatalog', () => {
  it('실 catalog.json 이 있으면 표본은 읽지 않는다', async () => {
    const { useCatalog, reads } = await loaderWith({
      'catalog.json': JSON.stringify(readRaw('server/data/catalog.json')),
      'catalog.fixture.json': JSON.stringify(fixtureRaw()),
    })
    const cat = await useCatalog()
    expect(cat.fixture).toBe(false)
    expect(reads).toEqual(['catalog.json'])
  })

  it('실 파일이 없으면 표본 · 둘 다 없으면 throw', async () => {
    const a = await loaderWith({ 'catalog.fixture.json': fixtureRaw() })
    expect((await a.useCatalog()).fixture).toBe(true)
    const b = await loaderWith({})
    await expect(b.useCatalog()).rejects.toThrow(/카탈로그 파일이 없다/)
  })

  it('한 번 검증해 메모한다(두 번째 요청은 다시 읽지 않는다)', async () => {
    const { useCatalog, reads } = await loaderWith({
      'catalog.json': readRaw('server/data/catalog.json'),
    })
    await useCatalog()
    await useCatalog()
    expect(reads).toEqual(['catalog.json'])
  })
})

describe('카탈로그 파일 위치가 한 곳에서 맞물린다', () => {
  it('CATALOG_DIR = server/ + serverAssets dir', async () => {
    const { CATALOG_DIR, CATALOG_SERVER_ASSET_DIR } = await import('../../shared/catalog/files')
    expect(CATALOG_DIR).toBe(`server/${CATALOG_SERVER_ASSET_DIR}`)
  })

  it('실 파일이 검증에 실패하면 표본으로 넘어가지 않고 멈춘다', async () => {
    const broken = readRaw('server/data/catalog.json')
    broken.zones[0].products[0].options[0].usable = false
    const { useCatalog, reads } = await loaderWith({
      'catalog.json': JSON.stringify(broken),
      'catalog.fixture.json': JSON.stringify(fixtureRaw()),
    })
    await expect(useCatalog()).rejects.toThrow(/검증 실패/)
    expect(reads).toEqual(['catalog.json'])
  })
})
