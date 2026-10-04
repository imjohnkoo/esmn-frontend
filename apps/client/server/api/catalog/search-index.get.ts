import { COUNTRY_ALIASES } from '../../../app/content/catalog-search'
import upcoming from '../../../app/content/catalog-upcoming.json'
import { buildSearchIndex } from '../../../shared/catalog/search'

// 페이지 전용 데이터 라우트 — 외부 계약이 아니다(`/api/v1` 밖). `/search` 가 프리렌더 때 부른다.
// 영문 이름은 서버(빌드)의 ICU 로 만든다 — 브라우저마다 다른 지역 이름 데이터를 피한다.
export default defineEventHandler(async () => {
  const catalog = await useCatalog()
  const en = new Intl.DisplayNames('en', { type: 'region' })
  return buildSearchIndex(
    catalog,
    upcoming.countries,
    COUNTRY_ALIASES,
    (iso2) => en.of(iso2) ?? iso2,
  )
})
