import { CATALOG_FILES } from '../../shared/catalog/files'
import type { CatalogView } from '../../shared/catalog/types'
import { parseCatalog } from '../../shared/catalog/validate'

/**
 * 카탈로그 로더 — `server/data/catalog.json`(W1-1 export · 손편집 금지)이 있으면 그것, 없으면 표본 픽스처.
 * 서버 자산(`nitro.serverAssets` baseName `catalog`)으로 번들에 들어가므로 .output 에서도 같은 파일을 읽는다.
 * 한 번 검증해 메모한다 — 검증 실패면 첫 요청(프리렌더 포함)에서 throw 해 빌드가 멈춘다(spec F-1).
 */
let cached: Promise<CatalogView> | undefined

export function useCatalog(): Promise<CatalogView> {
  cached ??= load()
  return cached
}

async function load(): Promise<CatalogView> {
  const storage = useStorage('assets:catalog')
  let raw: unknown = null
  for (const name of CATALOG_FILES) {
    raw = await storage.getItem(name)
    if (raw != null) break
  }
  if (raw == null)
    throw new Error(
      '카탈로그 파일이 없다 — server/data/catalog.json(W1-1) 또는 catalog.fixture.json',
    )
  return parseCatalog(typeof raw === 'string' ? JSON.parse(raw) : raw)
}
