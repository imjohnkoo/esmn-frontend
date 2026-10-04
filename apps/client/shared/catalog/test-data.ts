/**
 * 테스트 전용 — 카탈로그 파일 읽기(앱 코드에서 import 하지 않는다).
 *
 * - 표본(`fixture*`): 기대값을 숫자로 박은 테스트용 — 스냅샷 2026-09-22 에서 뽑은 5 zone · 7 SKU
 * - 지금 빌드가 쓰는 것(`active*`): 실 catalog.json(W1-1 export)이 있으면 그것, 없으면 표본.
 *   «목록 코드가 다 있어야 한다» · «전 옵션 대조» 처럼 실데이터에서 돌아야 뜻이 있는 테스트가 쓴다.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { URL, fileURLToPath } from 'node:url'
import { CATALOG_DIR, CATALOG_FILES, FIXTURE_CATALOG } from './files'
import type { CatalogView } from './types'
import { parseCatalog } from './validate'

// happy-dom 환경에서는 import.meta.url 이 file: 이 아니다 — Vitest 가 채우는 import.meta.dirname 을 먼저 쓴다
const HERE = import.meta.dirname ?? fileURLToPath(new URL('.', import.meta.url))
export const APP_DIR = `${resolve(HERE, '../..')}/`
export const FIXTURE_CATALOG_FILE = `${CATALOG_DIR}/${FIXTURE_CATALOG}`
export const ACTIVE_CATALOG_FILE = CATALOG_FILES.map((f) => `${CATALOG_DIR}/${f}`).find((f) =>
  existsSync(`${APP_DIR}${f}`),
)!

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 원본 K1 을 그대로 다루는 변이 테스트용
export type RawCatalog = any

export const readRaw = (file: string): RawCatalog =>
  JSON.parse(readFileSync(`${APP_DIR}${file}`, 'utf8'))
export const fixtureRaw = (): RawCatalog => readRaw(FIXTURE_CATALOG_FILE)
export const activeRaw = (): RawCatalog => readRaw(ACTIVE_CATALOG_FILE)
export const fixtureCatalog = (): CatalogView => parseCatalog(fixtureRaw())
export const activeCatalog = (): CatalogView => parseCatalog(activeRaw())

/**
 * 합성 zone — 표본에 없는 경계(국가 수 · 가격 순서)를 만들려고 원본 K1 에 zone 하나를 덧붙인다.
 * 나라는 원본의 같은 iso3 값을 복사하고, 상품은 FRA00U 를 새 SKU 로 다시 붙인다(코드 · 경로 · 링크 포함).
 * 최저가가 `lowestWon` 이 되도록 모든 옵션 가격을 같은 폭만큼 옮긴다.
 */
export function addSynthZone(
  raw: RawCatalog,
  {
    zone,
    iso3s,
    lowestWon,
    label,
  }: { zone: string; iso3s: string[]; lowestWon: number; label?: string },
): RawCatalog {
  const countries = iso3s.map((iso3) => {
    const found = raw.zones
      .flatMap((z: RawCatalog) => z.countries)
      .find((c: RawCatalog) => c.iso3 === iso3)
    if (!found) throw new Error(`표본에 ${iso3} 가 없다`)
    return structuredClone(found)
  })
  const template = raw.zones
    .flatMap((z: RawCatalog) => z.products)
    .find((p: RawCatalog) => p.sku === 'FRA00U')
  const product = structuredClone(template)
  const sku = `${zone}U`
  const shift = lowestWon - Math.min(...product.options.map((o: RawCatalog) => o.finalWon))
  product.sku = sku
  product.channelProductNo = 1_000_000 + raw.zones.length
  product.naverUrl = `https://smartstore.naver.com/esimmany/products/${product.channelProductNo}?nt_source=esimmany-web&nt_medium=detail&nt_detail=${sku}`
  product.images = { thumb: `/catalog/thumbs/${sku}.webp` }
  for (const o of product.options) {
    o.code = `${sku}${o.code.slice(sku.length)}`
    o.finalWon += shift
    o.optionPriceWon += shift // 최종가 = 판매가 − 즉시할인 + 옵션가 를 지킨다
  }
  raw.zones.push({
    zone,
    nameKr: label ?? `합성 ${iso3s.length}개국`,
    subtitle: `합성 부제 ${zone}`,
    countries,
    map: { svg: `/catalog/maps/${zone}.svg`, pins: [] },
    products: [product],
  })
  return recount(raw)
}

/** 최종가를 바꾼다 — 옵션가도 같이 옮겨 «판매가 − 즉시할인 + 옵션가» 산식을 지킨다 */
export function setFinalWon(raw: RawCatalog, code: string, won: number): RawCatalog {
  for (const z of raw.zones)
    for (const p of z.products)
      for (const o of p.options)
        if (o.code === code) {
          o.optionPriceWon += won - o.finalWon
          o.finalWon = won
          return raw
        }
  throw new Error(`옵션 ${code} 가 없다`)
}

/** 상품 · 옵션을 빼거나 더한 뒤 meta 개수를 다시 센다(검증기가 export 의 개수와 실제를 대조한다) */
export function recount(raw: RawCatalog): RawCatalog {
  raw.meta.zoneCount = raw.zones.length
  raw.meta.skuCount = raw.zones.reduce((n: number, z: RawCatalog) => n + z.products.length, 0)
  raw.meta.cellCount = raw.zones.reduce(
    (n: number, z: RawCatalog) =>
      n + z.products.reduce((m: number, p: RawCatalog) => m + p.options.length, 0),
    0,
  )
  return raw
}
