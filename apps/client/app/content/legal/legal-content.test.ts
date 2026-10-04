import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BLOCK_RULES, DOC_RULES, MIDNIGHT, forbiddenIn, unsupportedIn } from '../../../scripts/legal-posting'
import { blocksText, parseLegalMarkdown } from '../../utils/legal-markdown'
import { P9_4_PENDING } from '../pending'
import { BUSINESS_INFO } from './business'
import { LEGAL_LINKS } from '../../utils/shell-nav'
import { CHECKOUT_NOTICE } from './checkout-notice'
import { ISSUE_NOTICE } from './issue-notice'
import { PRIVACY_DOC } from './privacy'
import { REFUND_DOC } from './refund'
import { TERMS_DOC } from './terms'
import * as SUPPORT from '../support'

/**
 * 게시 형태(client-shell spec F-12 · D-25 · D-29 · D-32 · D-35 · D-36 — legal-pages 08 D절) — 생성물이 정본의 게시 형태이고 손으로 고치지 않았는가.
 * 정본과의 1:1 대조는 CI 밖(legal-pages 리포) — `legal:import` 로 다시 만들어 diff 0 을 본다(plan as-built 증거).
 */
const DOCS = [
  { doc: TERMS_DOC, file: './terms.ts', origin: /^\/\/ 정본: 01_.+\.md · legal-pages @[0-9a-f]{7}$/m },
  { doc: PRIVACY_DOC, file: './privacy.ts', origin: /^\/\/ 정본: 02_.+\.md · legal-pages @[0-9a-f]{7}$/m },
  { doc: REFUND_DOC, file: './refund.ts', origin: /^\/\/ 정본: 03_.+\.md · legal-pages @[0-9a-f]{7}$/m },
]
const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
/** 생성 때 해시는 값 자리 표시(NUL 감싼 PENDING) 기준 — 런타임 문자열을 되돌려 잰다 */
const unmark = (s: string) => s.split(P9_4_PENDING).join('\u0000PENDING\u0000')
const header = (src: string) => /^\/\/ sha256\(본문\): ([0-9a-f]{64})$/m.exec(src)?.[1]

describe.each(DOCS)('$doc.slug — 게시 형태', ({ doc, file, origin }) => {
  const text = blocksText(parseLegalMarkdown(doc.markdown))
  const src = read(file)

  it('게시 수정(정본과 다른 글자)은 머리줄에 드러난다 — 규칙의 수정 건수와 같다(D-41)', () => {
    const n = DOC_RULES[doc.slug].edits?.length ?? 0
    expect(/^\/\/ 게시 수정 (\d+)건 — /m.exec(src)?.[1] ?? '0').toBe(String(n))
  })
  it('값 채움(정본의 값 자리를 결정 글자로)도 머리줄에 드러난다 — 규칙의 채움 건수와 같다(D-54)', () => {
    const n = Object.keys(DOC_RULES[doc.slug].fills ?? {}).length
    expect(/^\/\/ 값 채움 (\d+)건 — /m.exec(src)?.[1] ?? '0').toBe(String(n))
  })
  it('생성물을 손으로 고치지 않았다 — 머리줄의 본문 해시 = 지금 본문', () => {
    expect(header(src)).toBe(sha(unmark(doc.markdown)))
  })

  it('정본 출처(파일 · legal-pages 커밋)는 주석에만 — 공개 JS 에 실리는 값에는 없다', () => {
    expect(src).toMatch(origin)
    expect(JSON.stringify(doc)).not.toMatch(/legal-pages|\.md/)
  })

  it('초안 표식 · 인용 블록 · 대괄호 태그 · 자리 {N} · 코드 백틱 · 공개 금지어 · 지원하지 않는 문법이 없다', () => {
    expect(doc.title).not.toMatch(/초안|v\d/)
    expect(doc.markdown).not.toMatch(/^>/m)
    expect(doc.markdown.replace(/\[[^\]\n]+\]\((?:https:\/\/|\/)[^)\s]*\)/g, '')).not.toMatch(
      /[[\]]/,
    )
    // 예외 없음 — D-33 의 자정 예시 괄호는 게시 수정으로 뺐다(John 2026-10-02)
    expect(forbiddenIn(doc.title + '\n' + unmark(doc.markdown))).toEqual([])
    expect(unsupportedIn(doc.markdown)).toEqual([])
  })

  it('해외 공급사 명칭(영문 · 한글) · 내부 용어 · 자리표시자 상수 이름이 화면 글자에 없다(John)', () => {
    expect(text).not.toMatch(/spark|maya|airalo|tsim/i)
    expect(text).not.toMatch(/스파크|티심|마야|에어알로/)
    expect(text).not.toMatch(/\bphase|proposal|브리프/i)
    expect(text).not.toMatch(/[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/)
  })
})

// spec D-33 resolved(John 2026-10-02 «괄호를 지우고 게시») — 약관 8조② 의 자정 예시 괄호는 게시 수정으로 뺀다(eSIM 불변식 — 첫 연결부터 24시간 단위)
describe('D-33 — 약관 8조② 자정 예시 없음 · 게시 수정 = 결정 그대로', () => {
  it('8조② 줄 = 정본 줄에서 «(예: 한국시간 자정 기준)» 만 뺀 글자 · 자정 표현 0', () => {
    expect(TERMS_DOC.markdown).not.toMatch(MIDNIGHT) // 날짜 경계 낱말(«사업자정보» 같은 «…자 + 정보» 는 제외)
    expect(TERMS_DOC.markdown.split('\n').filter((l) => l.includes('상품 상세에 별도 기준'))).toEqual([
      '2. 이용 기간은 **설치가 아닌 개통(이용 가능 지역에서의 최초 망 접속) 시점부터** 24시간 단위로 계산됩니다. 상품 상세에 별도 기준이 표시된 경우 그에 따릅니다.',
    ])
  })
})

describe('이용약관 — 구조 · 확정 문장', () => {
  const blocks = parseLegalMarkdown(TERMS_DOC.markdown)
  const text = blocksText(blocks)
  const titles = blocks.filter((b) => b.t === 'h3').map((b) => blocksText([b]))
  const chapters = blocks.filter((b) => b.t === 'h2').map((b) => blocksText([b]))

  it('장 1~5 + 부칙 · 조 1~20 이 빠짐없이 차례대로(가져오기에서 조가 통째로 빠지면 잡힌다)', () => {
    expect(chapters.map((c) => /^제(\d)장/.exec(c)?.[1] ?? c)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '부칙',
    ])
    expect(titles.map((t) => Number(/^제(\d+)조/.exec(t)?.[1]))).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    )
  })

  it('시행일 · 제3장 회원 시행 · 자동 발급 유예(정본 그대로)', () => {
    expect(text).toContain(
      '이 약관은 2026년 9월 1일부터 시행합니다. 다만, 제3장(회원)은 회원 서비스 개시일부터 시행합니다.',
    )
    expect(text).toContain('자동 발급 기능을 개시하여 서비스 화면에 공지한 날부터 시행하며')
  })

  it('제7조 ② — 발급 요청 화면의 표시 · 동의(05-A 와 짝)', () => {
    expect(text).toContain(
      '회사는 발급 요청 화면에서 이 사실과 청약철회 제한 내용을 표시하고 이용자의 동의를 받습니다.',
    )
  })

  it('제12조 ③ · ④ — 설치 전 폐기 비용 · 표시 요건 · 전액 환불 예외 · 환불 기한 기산(D-28 · D-30 — 정본 그대로)', () => {
    expect(text).toContain(
      '폐기 비용은 발급 요청 화면(제7조 제4항에 따라 자동 발급된 주문은 구매 당시 상품 상세·판매 채널의 안내, 제7조 제5항에 따라 회사가 직접 발급한 주문은 발급 전 고객센터의 안내)에 미리 표시된 경우에만 부담합니다.',
    )
    expect(text).toContain(
      '발급 후 설치 전에 이용자가 환불을 요청하는 경우, 회사는 eSIM이 설치되지 않았음을 확인한 뒤 이미 발급된 eSIM의 폐기 비용 3,500원을 이용자가 부담하는 조건으로 환불합니다.',
    )
    expect(text).toContain(
      '다만, 회사 또는 공급사의 귀책사유가 있는 경우, 상품이 표시·광고 또는 계약 내용과 다르게 발급된 경우, 제14조에 따라 미성년자의 계약을 취소하는 경우에는 폐기 비용 없이 전액 환불합니다.',
    )
    expect(text).toContain(
      '(제3항에 따른 폐기 비용 부담의 확인이 필요한 경우에는 그 확인을 마친 날)',
    )
  })

  it('자리표시자 없음', () => {
    expect(TERMS_DOC.markdown).not.toContain(P9_4_PENDING)
  })
})

describe('개인정보처리방침 — 구조 · 확정 문장 · 자리표시자', () => {
  const blocks = parseLegalMarkdown(PRIVACY_DOC.markdown)
  const text = blocksText(blocks)
  it('장 1~12 가 빠짐없이 차례대로', () => {
    expect(
      blocks.filter((b) => b.t === 'h2').map((b) => Number(/^(\d+)\./.exec(blocksText([b]))?.[1])),
    ).toEqual(Array.from({ length: 12 }, (_, i) => i + 1))
  })
  it('서문 — 첫 문단(인용 블록 바로 뒤 · 빈 줄 다음)이 빠지지 않는다', () => {
    expect(blocks[0]).toMatchObject({ t: 'p' })
    expect(blocksText([blocks[0]!])).toBe(
      '노마컴(이하 「회사」)은 「개인정보 보호법」 제30조에 따라 정보주체의 개인정보를 보호하고 관련 고충을 신속하게 처리하기 위하여 다음과 같이 개인정보처리방침을 수립·공개합니다.',
    )
  })
  it('발급 화면(verify)에서 받는 이름 · 전화의 처리 고지(1장 — F-20 의 이유 · D-31 흐름 쿠키) · 국외 이전 없음 · 시행일', () => {
    expect(text).toContain(
      '이름·휴대전화번호(주문 정보와 대조해 본인을 확인하는 데에만 쓰고 회사 서버에 저장하지 않음 — 발급 단계를 이어 가도록 이용자 브라우저 쿠키에 마지막 이용 후 1시간 보관, 9장)',
    )
    expect(text).not.toContain('데에만 쓰고 저장하지 않음)')
    expect(text).toContain('개인을 식별할 수 있는 정보를 국외로 이전하지 않습니다')
    expect(text).toContain('이 개인정보처리방침은 2026년 9월 1일부터 적용됩니다.')
  })
  it('4장 수탁자 표 — 값 채움(D-54 · John 10-03): «AWS (Amazon Web Services 서울 리전)» · 알림톡 수탁사 «솔라피(주)» · 값 자리 0', () => {
    expect(PRIVACY_DOC.markdown).not.toContain(P9_4_PENDING)
    expect(text).toContain('AWS (Amazon Web Services 서울 리전) | 서비스 인프라·데이터 보관')
    expect(text).toMatch(/(^|\n)솔라피\(주\) \| 알림톡·문자 발송 \| 현행/)
    expect(text).not.toContain('누리고')
    expect(DOC_RULES.privacy.fills).toEqual({ 0: 'AWS', 1: '' })
  })
})

describe('취소·환불 정책(03) — 구조 · 확정 문장(D-28 공제 그대로)', () => {
  const blocks = parseLegalMarkdown(REFUND_DOC.markdown)
  const text = blocksText(blocks)
  it('«한눈에 보기» 표 + 1~7절 · «결정 기록» 절 없음', () => {
    expect(blocks.filter((b) => b.t === 'h2').map((b) => blocksText([b]))).toEqual([
      '한눈에 보기',
      '1. 발급 전에는 언제든 전액 환불됩니다',
      '2. 발급 후에는 청약철회가 제한됩니다',
      '3. eSIM에 문제가 있으면 재발급 또는 전액 환불합니다',
      '4. 발급 기한(유효기간)과 이용 기간',
      '5. 환불은 이렇게 처리됩니다',
      '6. 미성년자 구매',
      '7. 분쟁 해결',
    ])
    expect(text).not.toMatch(/결정 기록|채택안|원가/)
  })
  it('설치 전 폐기 비용 · 발급 전 전액 · 환불 기한(약관 12조와 같은 말)', () => {
    expect(text).toContain('폐기 비용 **3,500원**을 부담하시면 환불됩니다'.replace(/\*\*/g, ''))
    expect(text).toContain('발급을 요청하기 전이라면 사유를 묻지 않고 결제 금액 전액을 환불합니다.')
    expect(text).toContain('환불 요청을 받은 날부터 3영업일 이내에 환불하며')
  })
  // D-28 — 공제 문장은 정본 그대로(리뷰 blocker). 2절(청약철회 제한 · 설치 전 폐기 비용 · 예외)은 줄 전체를, 그 밖은
  // 3,500원 · 폐기 비용 · 전액 환불이 든 줄을 글자 그대로 고정한다 — 가져오기 버그로 한 줄이 빠지거나 바뀌어도 막힌다
  it('공제 문장 줄 전체 = 정본(2절 전부 + 3,500원 · 폐기 비용 · 전액이 든 줄)', () => {
    const lines = REFUND_DOC.markdown.split('\n')
    const s2 = lines.findIndex((l) => l.startsWith('## 2.'))
    const e2 = lines.findIndex((l, i) => i > s2 && l.startsWith('## '))
    expect(lines.slice(s2, e2).filter((l) => l.trim())).toEqual([
      "## 2. 발급 후에는 청약철회가 제한됩니다",
      "- eSIM 발급은 상품 제공을 시작하는 절차입니다. 발급하면 eSIM이 그 주문에 배정되며, 회수·재사용이 불가능한 디지털콘텐츠이므로 「전자상거래 등에서의 소비자보호에 관한 법률」 제17조 제2항 제5호에 따라 발급 이후에는 단순 변심에 의한 청약철회가 제한됩니다.",
      "- 이 내용은 발급 화면에서 다시 한 번 안내하고 동의를 받은 뒤에만 발급이 진행됩니다. (결제 후 30일이 지나 자동 발급되는 경우는 4항을 따릅니다.)",
      "- 고객센터가 eSIM을 직접 발급해 카카오톡 채널·전자우편 등으로 보내 드린 경우에도, 보내 드린 때부터 발급된 것으로 봅니다. 이때는 발급 전에 고객센터가 같은 내용을 안내하고 동의를 받습니다.",
      "- **발급은 했지만 아직 설치하지 않았다면** 고객센터로 요청해 주세요. eSIM이 설치되지 않은 것을 확인한 뒤, 이미 발급된 eSIM을 폐기해야 하므로 폐기 비용 **3,500원**을 부담하시면 환불됩니다. 실물 배송이 없어 그 밖의 반품 비용은 없습니다.",
      "- 설치(QR 스캔·수동 등록)한 뒤에는 단순 변심 환불이 불가능합니다. 삭제해도 설치 이력이 남으므로 마찬가지입니다.",
      "- 다만 다음 경우에는 폐기 비용 없이 전액 환불합니다.",
      "  - 상품 내용이 표시·광고와 다르거나 계약과 다르게 이행된 경우 (받은 날부터 3개월, 안 날부터 30일 이내)",
      "  - 회사나 공급사의 잘못으로 주문과 다른 국가·상품이 발급된 경우 — 설치 전이라도 폐기 비용을 받지 않습니다",
      "  - eSIM 자체의 하자로 설치·개통이 되지 않는 경우 (아래 3항)",
      "  - 만 19세 미만 미성년자가 법정대리인 동의 없이 구매해 계약을 취소하는 경우 (약관 제14조)",
    ])
    expect(
      lines.filter((l, i) => (i < s2 || i >= e2) && /3,500|폐기 비용|전액/.test(l)),
    ).toEqual([
      "| ① 결제 완료, **발급 요청 전** | QR 코드가 아직 만들어지지 않음 | **전액 환불** (수수료 없음) | 네이버 구매: 스마트스토어 취소 요청 · 자체 결제: 마이 > 주문 내역 > 취소 (자체 결제 서비스 개시 후) |",
      "| ② **발급 완료**(QR 코드 수령 — 고객센터가 직접 발급해 전달한 경우 포함), 설치 전 | eSIM이 주문자에게 배정됨 | 미설치 확인 후 **폐기 비용 3,500원**을 부담하시면 환불 | 고객센터 (주문번호·연락처) |",
      "| ③ 설치 완료, 개통 전 | 단말기에 등록됨, 아직 현지 망 미접속 | 단순 변심 환불 불가 · eSIM 하자 시 재발급 또는 전액 환불 | 고객센터 |",
      "| ④ 개통 후(이용 중) | 현지 망 접속, 이용 기간 진행 중 | 단순 변심 환불 불가 · 현지 망 24시간 이상 연속 장애는 일할 환불(무제한 상품) · 회사 귀책 하자 시 재발급 또는 전액 | 고객센터 (현지에서, 이용 기간 내 접수) |",
      "| ⑥ 결제 후 30일 미발급 (자동 발급 기능 도입 후 결제된 주문) | 자동 발급(별도 알림 없음) → ② 상태 | ②와 동일 (폐기 비용 3,500원) | 고객센터 |",
      "## 1. 발급 전에는 언제든 전액 환불됩니다",
      "- 발급을 요청하기 전이라면 사유를 묻지 않고 결제 금액 전액을 환불합니다. 수수료·위약금은 없습니다.",
      "## 3. eSIM에 문제가 있으면 재발급 또는 전액 환불합니다",
      "회사 또는 공급사 원인으로 eSIM이 작동하지 않으면 고객이 원하는 방법(재발급 / 전액 환불)으로 처리합니다. 이용 중 현지 통신망 장애로 데이터를 쓰지 못한 경우, 공급사 기록과 고객이 보내 주신 자료로 **24시간 이상 연속 장애**가 확인되면 그 일수만큼 계산해 환불합니다. 일할 환불은 매일 제공되는 무제한 상품에 적용하며, 용량형(종량제) 상품은 재발급 또는 전액 환불로 처리합니다.",
      "- 국가·일수·용량을 잘못 고른 경우 (발급 전이라면 1항에 따라 전액 환불 후 다시 구매하시면 됩니다)",
      "- 자동 발급 기능이 도입된 뒤 결제된 주문은 30일이 지나면 별도 알림 없이 **자동 발급**되며, 그 뒤에는 발급 후 환불 기준(폐기 비용 3,500원)이 적용됩니다.",
      "- 환불은 원칙적으로 결제하신 수단으로 돌려드립니다. 환불 요청을 받은 날부터 **3영업일 이내**에 환불하며(폐기 비용 부담의 확인이 필요한 경우에는 확인을 마친 날부터), 카드사·결제대행사 사정에 따라 실제 입금까지 3~7영업일이 걸릴 수 있습니다.",
    ])
  })
  it('자리표시자 없음', () => {
    expect(REFUND_DOC.markdown).not.toContain(P9_4_PENDING)
  })
  it('전화번호 없음(D-41) — 3항 고객센터 안내는 카카오톡 채널만 · 그 줄은 정본 줄에서 « · 070-8064-5232» 만 뺀 글자', () => {
    // 지역 · 휴대 · 인터넷 전화 · 대표번호(15xx~19xx) · 국가번호 · 괄호 지역번호 꼴 + «전화» 낱말
    expect(REFUND_DOC.markdown).not.toMatch(
      /(?:\+\s?82[-.\s]?0?\d{1,2}|\(?0\d{1,2}\)?)[-.\s)]?\d{3,4}[-.\s]?\d{4}|(?<!\d)1[5-9]\d{2}[-.\s]?\d{4}(?!\d)|전화/,
    )
    expect(REFUND_DOC.markdown.split('\n').filter((l) => l.includes('고객센터(카카오톡 채널'))).toEqual([
      '- 문제가 생기면 eSIM을 **삭제하지 말고** 그 상태 그대로 고객센터(카카오톡 채널 @이심마니)에 연락해 주세요. 대부분은 설정 안내로 바로 해결됩니다. 운영 시간(평일 09:00–18:00) 외에는 카카오톡 채널에 남겨 주시면 남기신 시각을 접수 시각으로 봅니다.',
    ])
  })
  it('게시 수정 = 결정된 것 그대로(D-41 전화번호 · D-33 자정 예시 괄호 — 다른 수정 0)', () => {
    expect(DOC_RULES.refund.edits).toEqual([
      { line: '5ccceaa412d5bbe591a837489e87a66b1905fb249d602496ca6adb7080ace3b7', from: ' · 070-8064-5232', to: '' },
    ])
    expect(DOC_RULES.terms.edits).toEqual([{ line: 'fbf7c3835a588a2040eb24b5d6b6249ba9df6a3002e3feefc5e13fd76eb54549', from: '(예: 한국시간 자정 기준)', to: '' }])
    expect(DOC_RULES.privacy.edits?.map((e) => e.line)).toEqual([
      '71f1b4a4514644500026a644d11134b60e01059ed8474ffbd929dd5819151304', // D-54 솔라피
      '357c59c7a3e6de6021f376c2b7fb02291d79a54f1c67e1a3335eb395aec8bc7a', // D-31 1장 발급 행
      '6fa32529429fd9304adf05649670af702b36f2ebea2b2e146dd449bc3521802c', // D-31 9장①
    ])
    expect(DOC_RULES.privacy.edits?.[0]).toEqual({ line: '71f1b4a4514644500026a644d11134b60e01059ed8474ffbd929dd5819151304', from: '(주)누리고(Solapi)', to: '솔라피(주)' })
    expect(BLOCK_RULES.business.edits).toEqual([{ line: 'f71a51520585665b3445cb4cd65f00ed0f47d05d9046ce297b748a7cf32934dc', from: '1950 호', to: '1950 호 (경기도 광주시)' }])
  })
})

describe('푸터 사업자정보(04 1절) — 법정 표시 항목(D-11) · `/business` 가 없으니(D-39) 푸터가 유일한 표시 · 통신판매업 신고기관 이름은 D-40', () => {
  const lines = Object.values(BUSINESS_INFO)
  it.each([
    ['상호', '상호: 노마컴'],
    ['대표자', '대표: 구장회'],
    ['사업자등록번호', '사업자등록번호: 704-24-01747'],
    ['통신판매업 신고번호 · 신고기관(D-40)', '통신판매업신고: 제 2023-경기광주-1950 호 (경기도 광주시)'],
    ['사업장 소재지', '주소: 제주특별자치도 제주시 신대로 145'],
    ['전화', '전화: 070-8064-5232'],
    ['이메일', '이메일: esimmany@naver.com'],
    ['개인정보보호책임자', '개인정보보호책임자: 구장회'],
    ['호스팅 서비스 제공자', '호스팅 서비스: '],
  ])('%s', (_, item) => {
    expect(lines.filter((l) => l.includes(item))).toHaveLength(1)
  })
})

describe('조각 — 사업자정보(04 1절 · D-36) · 발급 화면 고지(05-A · D-32 · D-35)', () => {
  it('손으로 고치지 않았다 — 머리줄 해시 = 지금 줄들 · 정본 출처(파일 · 절 · 커밋, dirty 아님)는 주석에만', () => {
    for (const [file, lines, origin] of [
      ['./business.ts', BUSINESS_INFO, /^\/\/ 정본: 04_[^ ]+\.md ## 1\. · legal-pages @[0-9a-f]{7}$/m],
      ['./issue-notice.ts', ISSUE_NOTICE, /^\/\/ 정본: 05_[^ ]+\.md ## A\. · legal-pages @[0-9a-f]{7}$/m],
      ['./checkout-notice.ts', CHECKOUT_NOTICE, /^\/\/ 정본: 05_[^ ]+\.md ## B\. · legal-pages @[0-9a-f]{7}$/m],
    ] as const) {
      expect(header(read(file))).toBe(sha(unmark(Object.values(lines).join('\n') + '\n')))
      expect(read(file)).toMatch(origin)
      expect(JSON.stringify(lines)).not.toMatch(/legal-pages|\.md/)
    }
  })
  it('푸터 링크 줄(F-7) — 화면의 LEGAL_LINKS 라벨 · 차례 = 04 1절 링크 줄에서 «사업자정보» 만 뺀 것(D-39)', () => {
    const canon = BUSINESS_INFO.legalLinks.split(' | ')
    expect(canon).toContain('사업자정보')
    expect(LEGAL_LINKS.map((l) => l.label)).toEqual(canon.filter((label) => label !== '사업자정보'))
    expect(LEGAL_LINKS.map((l) => l.to)).toEqual(['/terms', '/privacy', '/refund'])
  })
  it('사업자정보 생성물 머리 — 값 채움 1건(D-54 호스팅 AWS)', () => {
    expect(/^\/\/ 값 채움 (\d+)건 — /m.exec(read('./business.ts'))?.[1]).toBe('1')
    // 블록 게시 수정도 머리줄에 드러난다 — 규칙의 수정 건수와 같다(D-40)
    expect(/^\/\/ 게시 수정 (\d+)건 — /m.exec(read('./business.ts'))?.[1]).toBe(String(BLOCK_RULES.business.edits?.length))
    expect(BLOCK_RULES.business.edits).toHaveLength(1)
  })
  it('사업자정보 7줄 — 순서 · 공정위 조회 링크 · 호스팅 = AWS(D-54 값 채움 · 값 자리 0)', () => {
    expect(Object.keys(BUSINESS_INFO)).toEqual([
      'brand',
      'registration',
      'mailOrder',
      'address',
      'contact',
      'privacyOfficer',
      'hosting',
      'legalLinks',
      'copyright',
    ])
    expect(BUSINESS_INFO.registration).toBe(
      '사업자등록번호: 704-24-01747 [사업자정보확인](https://www.ftc.go.kr/bizCommPop.do?wrkr_no=7042401747)',
    )
    expect(BUSINESS_INFO.hosting).toBe('호스팅 서비스: AWS')
    expect(Object.values(BUSINESS_INFO).filter((l) => l.includes(P9_4_PENDING))).toHaveLength(0)
  })
  it('발급 화면 고지 — 설치 전 3,500원 환불 · 이용약관 동의 포함(약관 6조④ · 12조③)', () => {
    expect(ISSUE_NOTICE.refund).toBe(
      '발급 후 설치 전에는 이미 발급된 eSIM의 폐기 비용 3,500원을 부담하시면 환불됩니다. 설치 후에는 단순 변심에 의한 환불이 되지 않습니다(eSIM 하자나 표시와 다른 경우는 재발급 또는 환불).',
    )
    expect(ISSUE_NOTICE.consent).toBe(
      '(필수) 이용약관과 위 내용을 확인했으며, 발급 후 청약철회가 제한되고 설치 전 환불 시 폐기 비용 3,500원을 부담하는 것에 동의합니다.',
    )
  })
  it('05-A 원문 — 제목 · 안내 5줄(이용 기간은 첫 연결부터 — eSIM 불변) · 지원 기기 링크는 사이트 안 경로', () => {
    expect(ISSUE_NOTICE.heading).toBe('발급 전에 확인해 주세요')
    expect(ISSUE_NOTICE.period).toBe('이용 기간은 현지에서 처음 연결된 시점부터 계산됩니다.')
    expect(ISSUE_NOTICE.start).toMatch(/^eSIM 발급은 상품 제공을 시작하는 절차입니다\./)
    expect(ISSUE_NOTICE.device).toMatch(/\[지원 기기 확인\]\(\/supported-devices\)$/)
    expect(ISSUE_NOTICE.trouble).toMatch(/^eSIM에 문제가 있으면 삭제하지 말고 고객센터로/)
  })
  it('05-B 원문 — 필수 2 · 선택 1(구매와 무관) · 개인정보는 «안내»(계약 이행 근거 · 체크 없음) · 결제 전 공제 안내(D-28)', () => {
    expect(CHECKOUT_NOTICE.terms).toBe('(필수) 이용약관에 동의합니다 [보기](/terms)')
    expect(CHECKOUT_NOTICE.age).toBe('(필수) 만 14세 이상입니다')
    expect(CHECKOUT_NOTICE.marketing).toMatch(/^\(선택\) /)
    expect(CHECKOUT_NOTICE.marketingInfo).toMatch(/동의하지 않아도 구매할 수 있습니다$/)
    expect(CHECKOUT_NOTICE.privacyTitle).toBe('개인정보 수집·이용 안내 [개인정보처리방침 보기](/privacy)')
    expect(CHECKOUT_NOTICE.privacyInfo).toContain('근거: 계약 이행(「개인정보 보호법」 제15조 제1항 제4호)')
    expect(CHECKOUT_NOTICE.beforeRefund).toContain('발급 후 설치 전에는 폐기 비용 3,500원을 부담하시면 환불되며')
    expect(CHECKOUT_NOTICE.beforeRefund).toMatch(/\[취소·환불 정책\]\(\/refund\)$/)
  })
  it('공개 금지어 · 대괄호 태그 없음', () => {
    for (const l of [
      ...Object.values(BUSINESS_INFO),
      ...Object.values(ISSUE_NOTICE),
      ...Object.values(CHECKOUT_NOTICE),
    ]) {
      expect(forbiddenIn(unmark(l))).toEqual([])
      expect(l.replace(/\[[^\]\n]+\]\((?:https:\/\/|\/)[^)\s]*\)/g, '')).not.toMatch(/[[\]]/)
    }
  })
})

describe('값 자리는 토큰으로만(D-29 · D-30 · D-47)', () => {
  it('생성 문서 · 고객센터 원문에 «(확정 전)» 글자를 직접 쓰지 않는다 — 렌더러가 괄호 낱말을 나눠 감싸 HTML 검사로는 안 보인다 · 값 자리는 P9_4_PENDING 토큰만', () => {
    const norm = (s: string) =>
      s.replace(/[\u00ad\u200b-\u200d\u2060-\u2064\ufeff]/g, '').replace(/[\u00a0\u2007\u202f\u3000]/g, ' ').replace(/\uff08/g, '(').replace(/\uff09/g, ')')
    const strings = (v: unknown): string[] =>
      typeof v === 'string' ? [v] : v && typeof v === 'object' ? Object.values(v).flatMap(strings) : []
    const sources: [string, unknown][] = [
      ['terms', TERMS_DOC],
      ['privacy', PRIVACY_DOC],
      ['refund', REFUND_DOC],
      ['business', BUSINESS_INFO],
      ['issue-notice', ISSUE_NOTICE],
      ['checkout-notice', CHECKOUT_NOTICE],
      ['support', SUPPORT],
    ]
    for (const [name, v] of sources) {
      const all = strings(v)
      expect(all.length, name).toBeGreaterThan(0)
      for (const t of all) expect(norm(t), name).not.toMatch(/\(\s*확정\s*전|확정\s*전\s*\)/) // 괄호 앞 · 뒤 어느 쪽이든(«(확정 전 — …)» · «(… 확정 전)») — «구매확정 전» 같은 문장은 막지 않는다
    }
  })
})
