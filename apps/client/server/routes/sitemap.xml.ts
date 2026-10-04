import { buildSitemapXml, sitemapPaths } from '../../shared/catalog/seo'

// sitemap.xml — 색인 대상(홈 · 법정 3종 · 가이드 · 지원 기기 · 국가 · 상품)만. noindex 목록(shared/utils/robots.ts)으로 거른다.
export default defineEventHandler(async (event) => {
  const catalog = await useCatalog()
  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  return buildSitemapXml(sitemapPaths(catalog), catalog.generatedAt)
})
