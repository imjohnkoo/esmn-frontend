import { zonePageData } from '../../../../shared/catalog/pages'

// 페이지 전용 데이터 라우트 — 외부 계약이 아니다(`/api/v1` 밖). `/products/{zone}` 가 프리렌더 때 부른다.
export default defineEventHandler(async (event) => {
  const param = getRouterParam(event, 'zone') ?? ''
  if (!/^[a-z0-9]{5}$/.test(param)) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  const zone = zonePageData(await useCatalog(), param.toUpperCase())
  if (!zone) throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  return zone
})
