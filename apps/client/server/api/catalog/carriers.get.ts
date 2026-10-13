import { carrierGroups } from '../../../shared/catalog/pages'

// 페이지 전용 데이터 라우트 — 외부 계약이 아니다(`/api/v1` 밖). `/guide/carriers` · `/install-guide/carriers` 가 프리렌더 때 부른다
// (client-guide-check D-15 — 앱 설정에 넣으면 모든 페이지 번들에 실린다).
export default defineEventHandler(async () => carrierGroups(await useCatalog()))
