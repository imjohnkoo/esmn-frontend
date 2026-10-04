/**
 * 카탈로그 파일 이름 — `server/data/` 안. 실 catalog.json(W1-1 export · 손편집 금지)이 먼저, 없으면 표본 픽스처.
 * 빌드 모듈 · 서버 로더 · 자산 스크립트 · 테스트가 모두 이 순서를 쓴다(한 곳에서만 바꾼다).
 */
export const CATALOG_DIR = 'server/data'
/** nitro.serverAssets 의 dir — `server/` 기준(= CATALOG_DIR). 서버 로더는 이 폴더를 `assets:catalog` 로 읽는다 */
export const CATALOG_SERVER_ASSET_DIR = 'data'
export const REAL_CATALOG = 'catalog.json'
export const FIXTURE_CATALOG = 'catalog.fixture.json'
/** 찾는 순서 — 앞의 것이 있으면 그것 */
export const CATALOG_FILES = [REAL_CATALOG, FIXTURE_CATALOG] as const
