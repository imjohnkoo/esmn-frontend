import { countryPageData } from '../../../../shared/catalog/pages'

// 페이지 전용 데이터 라우트 — 외부 계약이 아니다(`/api/v1` 밖). `/countries/{iso3}` 가 프리렌더 때 부른다.
export default defineEventHandler(async (event) => {
  const param = getRouterParam(event, 'iso3') ?? ''
  if (!/^[a-z]{3}$/.test(param)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const data = countryPageData(await useCatalog(), param.toUpperCase())
  if (!data) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return data
})
