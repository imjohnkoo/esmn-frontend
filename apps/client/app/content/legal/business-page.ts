// 생성물 — scripts/legal-import.mjs 가 legal-pages 정본에서 게시 규칙(08 D절)을 적용해 만든다.
// 손으로 고치지 말 것 — 정본을 고친 뒤 `yarn workspace nomacom-client legal:import --from <정본 폴더>` 로 다시 만든다.
// 정본: 04_사업자정보-고객센터.md ## 2. · legal-pages @f64203c
// sha256(본문): db0124aa6e18850e6655d36ea90b304c5a45590ed602a541b96774b6a6670395
import { P9_4_PENDING } from '../pending'
import type { LegalMarkdownDoc } from '../../utils/legal-markdown'

export const BUSINESS_DOC: LegalMarkdownDoc = {
  slug: 'business',
  title: '사업자정보',
  markdown: `| 항목 | 값 |
| --- | --- |
| 서비스명 | 이심마니 — esimmany.com · app.esimmany.com |
| 상호 | 노마컴 |
| 대표자 | 구장회 |
| 사업자등록번호 | 704-24-01747 |
| 통신판매업 신고번호 | 제 2023-경기광주-1950 호 (신고기관: 경기도 광주시) |
| 사업장 소재지 | 제주특별자치도 제주시 신대로 145, 멘써빌딩 2층 (1-27호)(연동) |
| 업태 · 종목 | 정보통신업, 도매 및 소매업 · 응용 소프트웨어 개발 및 공급업, 전자상거래 소매업 |
| 개업일 | 2023년 9월 30일 |
| 고객센터 | 070-8064-5232 · 카카오톡 채널 @이심마니 · 네이버 톡톡(스마트스토어) · 이메일 esimmany@naver.com |
| 운영 시간 | 평일 09:00–18:00 (주말·공휴일 휴무) · 해외 체류 중 발급·설치 긴급 문의는 카카오톡 채널로 남겨 주시면 순차 응대 |
| 개인정보보호책임자 | 구장회 · 070-8064-5232 · esimmany@naver.com |
| 호스팅 서비스 제공자 | ${P9_4_PENDING} |
| 분쟁 조정 | 1372 소비자상담센터 · 한국소비자원 · 전자거래분쟁조정위원회 |
`,
}
