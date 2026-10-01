// 생성물 — scripts/legal-import.mjs 가 legal-pages 정본에서 게시 규칙(08 D절)을 적용해 만든다.
// 손으로 고치지 말 것 — 정본을 고친 뒤 `yarn workspace nomacom-client legal:import --from <정본 폴더>` 로 다시 만든다.
// 정본: 05_고지문구-동의체크-FAQ.md ## A. · legal-pages @f64203c
// sha256(본문): 718ccb0c7a9085f4af2edf3b171a0069723b971726c17fc7c45e07e85a64912d
export const ISSUE_NOTICE = {
  refund: '발급 후 설치 전에는 이미 발급된 eSIM의 폐기 비용 3,500원을 부담하시면 환불됩니다. 설치 후에는 단순 변심에 의한 환불이 되지 않습니다(eSIM 하자나 표시와 다른 경우는 재발급 또는 환불).',
  consent: '(필수) 이용약관과 위 내용을 확인했으며, 발급 후 청약철회가 제한되고 설치 전 환불 시 폐기 비용 3,500원을 부담하는 것에 동의합니다.',
} as const
