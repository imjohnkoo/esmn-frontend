// 구매 시트 보조 버튼 표시 판정(client-shell spec D-60) — 상품 페이지는 프리렌더라 useRuntimeConfig 가 빌드 값(빈 문자열)으로 굳는다.
// 런타임 env 를 읽는 서버가 판정하고 불리언만 돌려준다 — 키 값 · DB · 벤더 · PII 0.
import { isTestClientKey } from '../../../../shared/catalog/preview'

export default defineEventHandler((event) => ({
  testKey: isTestClientKey(useRuntimeConfig(event).public.toss.clientKey),
}))
