// 결제 페이지 상품 값(client-shell spec D-60) — 옵션 코드로 서버 카탈로그에서 찾는다. 코드가 없으면 심사 품목 · 모르는 코드는 404
import { PREVIEW_OPTION_CODE, previewLookup } from '../../../../shared/catalog/preview'

export default defineEventHandler(async (event) => {
  const { option = PREVIEW_OPTION_CODE } = getQuery(event)
  const lookup = typeof option === 'string' ? previewLookup(await useCatalog(), option) : null
  if (!lookup) throw createError({ statusCode: 404, statusMessage: 'Unknown option' })
  return lookup
})
