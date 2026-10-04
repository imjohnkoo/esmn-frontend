/**
 * 카탈로그 자산 매니페스트 해석 — K1 의 논리 경로(`/catalog/thumbs/{SKU}.webp` · `/catalog/maps/{ZONE}.svg`)를
 * 해시 파일명(`{SKU}.{hash8}.webp`)으로 푼다(spec D-14). 해시 파일명은 CDN 장기 캐시용 — 쿼리스트링 버전은 무효.
 * 매니페스트는 `scripts/catalog-assets.ts` 생성물(`app/content/catalog-assets.json`). 없는 키 = throw(프리렌더 실패).
 */

export interface AssetManifest {
  source: { catalog: string; generatedAt: string }
  thumbs: Record<string, string>
  maps: Record<string, string>
  flags: Record<string, string>
}

function pick(table: Record<string, string>, key: string, what: string): string {
  const v = table[key]
  if (!v)
    throw new Error(
      `자산 매니페스트에 ${what} «${key}» 가 없다 — scripts/catalog-assets.ts 를 다시 돌릴 것`,
    )
  return v
}

const THUMB_RE = /^\/catalog\/thumbs\/([A-Z0-9]+)\.webp$/
const MAP_RE = /^\/catalog\/maps\/([A-Z0-9]+)\.svg$/

export function thumbUrl(m: AssetManifest, logical: string): string {
  const sku = logical.match(THUMB_RE)?.[1]
  if (!sku) throw new Error(`썸네일 논리 경로가 아니다: ${logical}`)
  return pick(m.thumbs, sku, '썸네일')
}

export function mapUrl(m: AssetManifest, logical: string): string {
  const zone = logical.match(MAP_RE)?.[1]
  if (!zone) throw new Error(`지도 논리 경로가 아니다: ${logical}`)
  return pick(m.maps, zone, '지도')
}

export function flagUrl(m: AssetManifest, iso2: string): string {
  return pick(m.flags, iso2.toUpperCase(), '국기')
}
