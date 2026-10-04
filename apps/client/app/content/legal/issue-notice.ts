// 생성물 — scripts/legal-import.mjs 가 legal-pages 정본에서 게시 규칙(08 D절)을 적용해 만든다.
// 손으로 고치지 말 것 — 정본을 고친 뒤 `yarn workspace nomacom-client legal:import --from <정본 폴더>` 로 다시 만든다.
// 정본: 05_고지문구-동의체크-FAQ.md ## A. · legal-pages @f64203c
// sha256(본문): 9f9f60adf748b5f28a14bd20634e02cc4c92d6ce0a7b895db9d8a8aa9c0a8643
export const ISSUE_NOTICE = {
  refund: '발급 후 설치 전에는 이미 발급된 eSIM의 폐기 비용 3,500원을 부담하시면 환불됩니다. 설치 후에는 단순 변심에 의한 환불이 되지 않습니다(eSIM 하자나 표시와 다른 경우는 재발급 또는 환불).',
  consent: '(필수) 이용약관과 위 내용을 확인했으며, 발급 후 청약철회가 제한되고 설치 전 환불 시 폐기 비용 3,500원을 부담하는 것에 동의합니다.',
  heading: '발급 전에 확인해 주세요',
  start: 'eSIM 발급은 상품 제공을 시작하는 절차입니다. 발급을 누르면 QR 코드가 생성되고 이 주문에 eSIM이 배정됩니다. 배정된 eSIM은 회수·재사용할 수 없어 발급 후에는 단순 변심에 의한 취소·환불이 제한됩니다.',
  period: '이용 기간은 현지에서 처음 연결된 시점부터 계산됩니다.',
  device: 'eSIM을 설치할 기기가 eSIM 지원·잠금 해제 기기인지 확인하셨나요? [지원 기기 확인](/supported-devices)',
  trouble: 'eSIM에 문제가 있으면 삭제하지 말고 고객센터로 바로 연락해 주세요. 재발급 또는 환불해 드립니다.',
} as const
