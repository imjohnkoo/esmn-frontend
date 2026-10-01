// 생성물 — scripts/legal-import.mjs 가 legal-pages 정본에서 게시 규칙(08 D절)을 적용해 만든다.
// 손으로 고치지 말 것 — 정본을 고친 뒤 `yarn workspace nomacom-client legal:import --from <정본 폴더>` 로 다시 만든다.
// 정본: 04_사업자정보-고객센터.md ## 1. · legal-pages @f64203c
// sha256(본문): 6c427078fdb8e0b5f5585a45f808f551b110f510e225df182bcd9330e3364241
import { P9_4_PENDING } from '../pending'

export const BUSINESS_INFO = {
  brand: '이심마니 | 상호: 노마컴 | 대표: 구장회',
  registration: '사업자등록번호: 704-24-01747 [사업자정보확인](https://www.ftc.go.kr/bizCommPop.do?wrkr_no=7042401747)',
  mailOrder: '통신판매업신고: 제 2023-경기광주-1950 호',
  address: '주소: 제주특별자치도 제주시 신대로 145, 멘써빌딩 2층 (1-27호)(연동)',
  contact: '전화: 070-8064-5232 (평일 09:00–18:00, 주말·공휴일 휴무) | 이메일: esimmany@naver.com',
  privacyOfficer: '개인정보보호책임자: 구장회',
  hosting: `호스팅 서비스: ${P9_4_PENDING}`,
  copyright: '© 2026 노마컴. All rights reserved.',
} as const
