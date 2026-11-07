// 결제 페이지 상품 값(client-shell spec D-60) — 실제 픽스처 카탈로그로 핸들러를 돌린다. Nitro 자동 import 는 대역.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fixtureRaw } from '../../../../shared/catalog/test-data'
import { parseCatalog } from '../../../../shared/catalog/validate'

const catalog = parseCatalog(fixtureRaw())
let query: Record<string, unknown> = {}
vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
vi.stubGlobal('getQuery', () => query)
vi.stubGlobal('useCatalog', async () => catalog)
vi.stubGlobal('createError', (e: { statusCode: number }) => Object.assign(new Error('x'), e))

const handler = (await import('./item.get')).default as unknown as () => Promise<{
  item: { amount: number; optionCode: string }
  zone: string
}>
const finalWon = (code: string) =>
  catalog.zones
    .flatMap((z) => z.products)
    .flatMap((p) => p.options)
    .find((o) => o.code === code)!.finalWon

beforeEach(() => {
  query = {}
})

describe('GET /api/v1/checkout-preview/item (D-60)', () => {
  it('코드가 없으면 심사 품목(프랑스 7일)', async () => {
    const res = await handler()
    expect(res.item.optionCode).toBe('FRA00U01D07V2')
    expect(res.item.amount).toBe(finalWon('FRA00U01D07V2'))
    expect(res.zone).toBe('FRA00')
  })

  it('고른 옵션이면 그 옵션의 카탈로그 금액 · zone', async () => {
    query = { option: 'CZE00L10D30V2' }
    const res = await handler()
    expect(res.item.amount).toBe(finalWon('CZE00L10D30V2'))
    expect(res.zone).toBe('CZE00')
  })

  it.each([['XXX00U01D07V2'], [''], [['FRA00U01D07V2', 'CZE00L10D30V2']]])(
    '모르는 코드 %j → 404',
    async (option) => {
      query = { option }
      await expect(handler()).rejects.toMatchObject({ statusCode: 404 })
    },
  )
})
