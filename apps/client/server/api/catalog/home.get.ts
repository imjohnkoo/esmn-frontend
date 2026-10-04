import { POPULAR_COUNTRIES, POPULAR_MULTI_ZONES } from '../../../app/content/popular'
import { resolveHome } from '../../../shared/catalog/home'

// 페이지 전용 데이터 라우트 — 외부 계약이 아니다(`/api/v1` 밖 · mobile · backend 가 쓰지 않는다).
// 홈(`/`)이 프리렌더 때 부르고 결과는 payload 에 고정된다. 응답 모양은 홈과 함께 바뀌어도 된다.
export default defineEventHandler(async () => {
  const catalog = await useCatalog()
  const home = resolveHome(catalog, POPULAR_COUNTRIES, POPULAR_MULTI_ZONES)
  // 실 카탈로그에서 목록이 어긋나면 500 — 홈 페이지가 받아 페이지 500 으로 던져 프리렌더(빌드)를 멈춘다.
  // 표본 픽스처는 없는 것을 건너뛴다. statusMessage 는 ASCII 만(h3 가 그 밖의 글자를 지운다) — 한글 진단은 로그로.
  if (home.missing.length > 0 && !catalog.fixture) {
    console.error(
      `[catalog] 홈 인기 목록이 카탈로그와 어긋난다 — app/content/popular.ts: ${home.missing.join(', ')}`,
    )
    throw createError({
      statusCode: 500,
      statusMessage: `Home popular list mismatch (app/content/popular.ts): ${home.missing.length}`,
    })
  }
  return { popular: home.popular, multi: home.multi }
})
