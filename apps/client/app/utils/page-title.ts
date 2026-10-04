/** 문서 제목(client-shell spec F-1) — «페이지 · 이심마니». 정본 제목이 이미 브랜드로 시작하면(«이심마니 서비스 이용약관») 다시 붙이지 않는다 */
export const SITE_NAME = '이심마니'

export function pageTitle(title?: string | null): string {
  if (!title) return SITE_NAME
  return title.startsWith(SITE_NAME) ? title : `${title} · ${SITE_NAME}`
}
