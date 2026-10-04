/**
 * 카탈로그 빌드 모듈(catalog spec F-1 · F-9 · F-12 · F-13) — K1 을 읽어 검증하고 세 가지를 넣는다.
 *  1. 프리렌더 목록 — 홈 · 검색 · 국가 전수 · 상품 전수 · 정적(와일드카드는 페이지를 생성하지 않는다)
 *  2. `/checkout-preview` 상품 값 — 앱 설정 `checkoutPreview`(페이지는 서버를 부르지 않는다 · shell F-19)
 *  3. 오류 화면 칩(인기 8 · 아시아 5) — 앱 설정 `errorChips`(오류 화면은 서버를 부르지 않는다 · catalog S-7)
 * 실 catalog.json(W1-1 export)이 없으면 표본 픽스처. 검증 실패 · 심사용 옵션 없음 · 칩 나라 없음이면 throw — 빌드 · dev 기동이 멈춘다.
 * `nuxt prepare`(postinstall · 타입 생성)에서는 건너뛴다 — 깨진 카탈로그가 yarn install 을 막지 않게(F-1).
 * `modules/` 폴더라 Nuxt 가 자동으로 등록한다(nuxt.config 의 modules 에 다시 적지 않는다).
 * 이 파일은 nuxt 설정 시점에 읽히므로 `#shared` 별칭 없이 상대경로로 import 한다.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineNuxtModule } from 'nuxt/kit'
import { COUNTRY_ALIASES } from '../app/content/catalog-search'
import upcoming from '../app/content/catalog-upcoming.json'
import { ERROR_ASIA_COUNTRIES } from '../app/content/error-page'
import { POPULAR_COUNTRIES } from '../app/content/popular'
import { errorChipsFromCatalog } from '../shared/catalog/chips'
import { CATALOG_DIR, CATALOG_FILES } from '../shared/catalog/files'
import { checkoutPreviewFromCatalog } from '../shared/catalog/preview'
import { prerenderRoutes } from '../shared/catalog/seo'
import { parseCatalog } from '../shared/catalog/validate'

export default defineNuxtModule({
  meta: { name: 'nomacom-catalog' },
  setup(_options, nuxt) {
    if (nuxt.options._prepare) return
    const dir = join(nuxt.options.rootDir, CATALOG_DIR)
    const file = CATALOG_FILES.map((f) => join(dir, f)).find((f) => existsSync(f))
    if (!file) throw new Error(`카탈로그가 없다 — ${dir}/catalog.json 또는 catalog.fixture.json`)
    const catalog = parseCatalog(JSON.parse(readFileSync(file, 'utf8')))
    if (catalog.fixture) {
      console.warn(
        '⚠ FIXTURE 카탈로그(server/data/catalog.fixture.json · 표본 5 zone) — main 머지 전 W1-1 catalog.json 이 필요하다',
      )
    }
    const prerender = (nuxt.options.nitro.prerender ??= {})
    prerender.routes = [...new Set([...(prerender.routes ?? []), ...prerenderRoutes(catalog)])]
    nuxt.options.appConfig.checkoutPreview = checkoutPreviewFromCatalog(catalog)
    nuxt.options.appConfig.errorChips = errorChipsFromCatalog(
      catalog,
      upcoming.countries,
      COUNTRY_ALIASES,
      POPULAR_COUNTRIES,
      ERROR_ASIA_COUNTRIES,
      { strict: !catalog.fixture },
    )
  },
})
