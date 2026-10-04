// 생성물 — scripts/legal-import.mjs 가 legal-pages 정본에서 게시 규칙(08 D절)을 적용해 만든다.
// 손으로 고치지 말 것 — 정본을 고친 뒤 `yarn workspace nomacom-client legal:import --from <정본 폴더>` 로 다시 만든다.
// 정본: 05_고지문구-동의체크-FAQ.md ## B. · legal-pages @f64203c
// sha256(본문): 4d213ad5666624cf1e4a80aa72f0c3d0a66dd06c67e0fdbaacead3b48acb01bb
export const CHECKOUT_NOTICE = {
  terms: '(필수) 이용약관에 동의합니다 [보기](/terms)',
  age: '(필수) 만 14세 이상입니다',
  marketing: '(선택) 혜택·이벤트 알림 수신 (카카오톡·이메일)',
  marketingInfo: '수집 항목: 이메일 주소, 휴대전화번호 · 목적: 신상품·혜택 안내 · 보유: 동의 철회 시까지 · 동의하지 않아도 구매할 수 있습니다',
  privacyTitle: '개인정보 수집·이용 안내 [개인정보처리방침 보기](/privacy)',
  privacyInfo: '수집 항목: 이름, 휴대전화번호, 이메일, 주문 상품·금액, 결제 수단 정보, 현금영수증 발급 정보 · 목적: 주문·결제 처리, eSIM 발급·안내, 취소·환불 · 근거: 계약 이행(「개인정보 보호법」 제15조 제1항 제4호) · 보유: 개인정보처리방침 2.에 따름',
  beforeTitle: '결제 전 안내',
  beforeRefund: '결제 후 발급 전에는 전액 환불됩니다. 발급 후 설치 전에는 폐기 비용 3,500원을 부담하시면 환불되며, 설치 후에는 단순 변심에 의한 환불이 되지 않습니다. 결제 후 30일 안에 발급해 주세요(자동 발급 기능 도입 후에는 30일이 지나면 별도 알림 없이 자동 발급됩니다). [취소·환불 정책](/refund)',
  beforeMinor: '만 19세 미만 미성년자가 법정대리인 동의 없이 결제한 경우 본인 또는 법정대리인이 취소할 수 있습니다.',
  beforeNotify: '결제 완료 사실은 알림톡·이메일로 알려드립니다.',
} as const
