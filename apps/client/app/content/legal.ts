/**
 * 법정 문서 — 이용약관 · 개인정보처리방침 · 환불정책 (K5). 문안 정본은 John(P9-4).
 *
 * - 약관 · 처리방침 본문은 P9-4 대기 — 처리방침은 법정 목차(개인정보보호법 제30조)만 뼈대로 둔다.
 * - 환불정책은 A5: «발급 전 전액 환불» · 신청 경로 · 처리 기한만.
 *   (A5 의 «발급 뒤 문장 금지» 는 spec D-28 로 해제 — K2 에서 이 파일을 legal-pages 정본 생성물로 대체한다)
 *   문구 출처: 2609 상세 13-refund(«발급 전 100% 환불») · 라이브 상품정보제공고시(«3영업일 이내»).
 */
import { P9_4_PENDING, isPending, type ContentValue } from './pending'

export interface LegalSection {
  key: string
  heading: string
  paragraphs: readonly ContentValue[]
}

export interface LegalDocument {
  slug: 'terms' | 'privacy' | 'refund'
  title: string
  effectiveDate: ContentValue
  sections: readonly LegalSection[]
}

export const TERMS: LegalDocument = {
  slug: 'terms',
  title: '이용약관',
  effectiveDate: P9_4_PENDING,
  sections: [{ key: 'body', heading: '약관 본문', paragraphs: [P9_4_PENDING] }],
}

const PRIVACY_HEADINGS: readonly [string, string][] = [
  ['purpose', '개인정보의 처리 목적'],
  ['items', '처리하는 개인정보의 항목'],
  ['retention', '개인정보의 처리 및 보유 기간'],
  ['third-party', '개인정보의 제3자 제공'],
  ['outsourcing', '개인정보 처리의 위탁'],
  ['overseas', '개인정보의 국외 이전'],
  ['destruction', '개인정보의 파기 절차 및 방법'],
  ['rights', '정보주체와 법정대리인의 권리 · 의무 및 행사 방법'],
  ['safety', '개인정보의 안전성 확보 조치'],
  // 제30조①7호 — 흐름 쿠키(nomacom_flow)가 이름 · 전화번호를 1시간 담으므로 «해당» (spec S-4)
  ['cookies', '개인정보 자동 수집 장치(쿠키)의 설치 · 운영 및 거부'],
  ['officer', '개인정보 보호책임자'],
  ['changes', '개인정보처리방침의 변경'],
]

export const PRIVACY: LegalDocument = {
  slug: 'privacy',
  title: '개인정보처리방침',
  effectiveDate: P9_4_PENDING,
  sections: PRIVACY_HEADINGS.map(([key, heading], i) => ({
    key,
    heading: `${i + 1}. ${heading}`,
    paragraphs: [P9_4_PENDING],
  })),
}

export const REFUND: LegalDocument = {
  slug: 'refund',
  title: '환불정책',
  effectiveDate: P9_4_PENDING,
  sections: [
    {
      key: 'before-issue',
      heading: 'eSIM 발급 전',
      paragraphs: ['eSIM 을 발급받기 전에는 단순 변심이라도 100% 환불이 가능합니다.'],
    },
    {
      key: 'how',
      heading: '신청 방법',
      paragraphs: ['주문번호와 함께 아래 고객센터로 요청해 주세요.'],
    },
    {
      key: 'timeline',
      heading: '처리 기한',
      paragraphs: [
        '환불은 결제하신 수단으로 처리되며, 환불 사유를 확인한 날부터 3영업일 이내에 조치합니다.',
      ],
    },
  ],
}

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [TERMS, PRIVACY, REFUND]

/** 문서 전체 텍스트 — 테스트(금지 조항 검사)용 */
export function documentText(doc: LegalDocument): string {
  return [doc.title, ...doc.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join('\n')
}

/** 문서의 모든 문단이 P9-4 대기인가 — 그렇다면 본문 자리에 «문안을 확정하고 있어요.» 한 줄만 (spec S-4 특수 상태) */
export function isFullyPending(doc: LegalDocument): boolean {
  const paragraphs = doc.sections.flatMap((section) => section.paragraphs)
  // 절 · 문단이 0 이면 «대기» 가 아니라 빈 문서다 — 대기 한 줄로 가리지 않는다(테스트가 빈 문서를 막는다)
  return paragraphs.length > 0 && paragraphs.every((p) => isPending(p))
}
