// 생성물 — scripts/legal-import.mjs 가 legal-pages 정본에서 게시 규칙(08 D절)을 적용해 만든다.
// 손으로 고치지 말 것 — 정본을 고친 뒤 `yarn workspace nomacom-client legal:import --from <정본 폴더>` 로 다시 만든다.
// 정본: 04_사업자정보-고객센터.md ## 1. · legal-pages @f64203c
// sha256(본문): 0d4a094935e740318d050fde6d427d0833546df291b6226e3186207e5167e486
// 값 채움 1건 — 정본의 값 자리를 결정 글자로(규칙 scripts/legal-posting.ts 의 fills · spec D-54)
// 게시 수정 1건 — 정본과 다른 글자(규칙 scripts/legal-posting.ts 의 edits · spec 결정)
export const BUSINESS_INFO = {
  brand: '이심마니 | 상호: 노마컴 | 대표: 구장회',
  registration: '사업자등록번호: 704-24-01747 [사업자정보확인](https://www.ftc.go.kr/bizCommPop.do?wrkr_no=7042401747)',
  mailOrder: '통신판매업신고: 제 2023-경기광주-1950 호 (경기도 광주시)',
  address: '주소: 제주특별자치도 제주시 신대로 145, 멘써빌딩 2층 (1-27호)(연동)',
  contact: '전화: 070-8064-5232 (평일 09:00–18:00, 주말·공휴일 휴무) | 이메일: esimmany@naver.com',
  privacyOfficer: '개인정보보호책임자: 구장회',
  hosting: '호스팅 서비스: AWS',
  legalLinks: '이용약관 | 개인정보처리방침 | 취소·환불 정책 | 사업자정보',
  copyright: '© 2026 노마컴. All rights reserved.',
} as const
