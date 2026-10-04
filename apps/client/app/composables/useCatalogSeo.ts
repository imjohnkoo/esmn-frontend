import { SITE_ORIGIN, canonicalUrl, type PageMeta } from '#shared/catalog/seo'
import { pageTitle } from '~/utils/page-title'

/**
 * 카탈로그 페이지 메타(catalog spec F-9 · S-6 · D-15) — 제목(템플릿 « · 이심마니») · 설명 · canonical · og.
 * canonical · og:url 은 빌드 상수 https://esimmany.com + 경로(호스트 판정 0). og:image 는 자사 자산 절대 URL.
 */
export function useCatalogSeo(meta: PageMeta, image?: string) {
  const route = useRoute()
  const url = canonicalUrl(route.path)
  useSeoMeta({
    title: meta.title,
    description: meta.description,
    // 문서 제목과 같은 규칙(client-shell F-1) — 정본 제목이 이미 «이심마니» 로 시작하면 다시 붙이지 않는다
    ogTitle: pageTitle(meta.title),
    ogDescription: meta.description,
    ogUrl: url,
    ogType: 'website',
    ogSiteName: '이심마니',
    ogImage: image ? `${SITE_ORIGIN}${image}` : undefined,
    twitterCard: 'summary',
  })
  useHead({ link: [{ rel: 'canonical', href: url }] })
}
