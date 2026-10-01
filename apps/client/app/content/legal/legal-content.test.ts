import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { forbiddenIn, unsupportedIn } from '../../../scripts/legal-posting'
import { blocksText, parseLegalMarkdown } from '../../utils/legal-markdown'
import { P9_4_PENDING } from '../pending'
import { BUSINESS_INFO } from './business'
import { ISSUE_NOTICE } from './issue-notice'
import { PRIVACY_DOC } from './privacy'
import { TERMS_DOC } from './terms'

/**
 * 게시 형태(client-shell spec F-12 · D-25 · D-29 · D-32 · D-35 · D-36 — legal-pages 08 D절) — 생성물이 정본의 게시 형태이고 손으로 고치지 않았는가.
 * 정본과의 1:1 대조는 CI 밖(legal-pages 리포) — `legal:import` 로 다시 만들어 diff 0 을 본다(plan as-built 증거).
 */
const DOCS = [
  { doc: TERMS_DOC, file: './terms.ts' },
  { doc: PRIVACY_DOC, file: './privacy.ts' },
]
const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8')
const sha = (s: string) => createHash('sha256').update(s).digest('hex')
/** 생성 때 해시는 값 자리 표시(NUL 감싼 PENDING) 기준 — 런타임 문자열을 되돌려 잰다 */
const unmark = (s: string) => s.split(P9_4_PENDING).join('\u0000PENDING\u0000')
const header = (src: string) => /^\/\/ sha256\(본문\): ([0-9a-f]{64})$/m.exec(src)?.[1]

describe.each(DOCS)('$doc.slug — 게시 형태', ({ doc, file }) => {
  const text = blocksText(parseLegalMarkdown(doc.markdown))
  const src = read(file)

  it('생성물을 손으로 고치지 않았다 — 머리줄의 본문 해시 = 지금 본문', () => {
    expect(header(src)).toBe(sha(unmark(doc.markdown)))
  })

  it('정본 출처(파일 · legal-pages 커밋)는 주석에만 — 공개 JS 에 실리는 값에는 없다', () => {
    expect(src).toMatch(/^\/\/ 정본: 0[12]_.+\.md · legal-pages @[0-9a-f]{7}$/m)
    expect(JSON.stringify(doc)).not.toMatch(/legal-pages|\.md/)
  })

  it('초안 표식 · 인용 블록 · 대괄호 태그 · 자리 {N} · 코드 백틱 · 공개 금지어 · 지원하지 않는 문법이 없다', () => {
    expect(doc.title).not.toMatch(/초안|v\d/)
    expect(doc.markdown).not.toMatch(/^>/m)
    expect(doc.markdown.replace(/\[[^\]\n]+\]\((?:https:\/\/|\/)[^)\s]*\)/g, '')).not.toMatch(
      /[[\]]/,
    )
    // 알고 있는 예외 하나 — D-33(약관 8조② «자정» 예시, 리뷰 blocker · ready PR 보류) — 아래 it.fails 가 따로 잡는다
    const known = (h: string) => doc.slug === 'terms' && h.includes('자정/')
    expect(forbiddenIn(doc.title + '\n' + unmark(doc.markdown)).filter((h) => !known(h))).toEqual([])
    expect(unsupportedIn(doc.markdown)).toEqual([])
  })

  it('해외 공급사 명칭(영문 · 한글) · 내부 용어 · 자리표시자 상수 이름이 화면 글자에 없다(John)', () => {
    expect(text).not.toMatch(/spark|maya|airalo|tsim/i)
    expect(text).not.toMatch(/스파크|티심|마야|에어알로/)
    expect(text).not.toMatch(/\bphase|proposal|브리프/i)
    expect(text).not.toMatch(/[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/)
  })
})

// ⛔ spec D-33 open — 약관 8조② «(예: 한국시간 자정 기준)» 이 eSIM 불변식(첫 연결부터 24시간 단위)과 부딪힌다.
// it.fails 는 «지금 실패하는 것이 정상» 이다. legal-pages rev(괄호 삭제)를 가져오면 이 테스트가 빨간불이 된다 → it 으로 바꾸고 위 known 예외를 지운다.
it.fails('D-33 — 공개 약관에 자정 기준 서술이 없다(풀리면 it 으로)', () => {
  expect(blocksText(parseLegalMarkdown(TERMS_DOC.markdown))).not.toMatch(/(?<![가-힣])자정/)
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
  it('발급 화면(verify)에서 받는 이름 · 전화의 처리 고지(1장 — F-20 의 이유) · 국외 이전 없음 · 시행일', () => {
    expect(text).toContain(
      '이름·휴대전화번호(주문 정보와 대조해 본인을 확인하는 데에만 쓰고 저장하지 않음)',
    )
    expect(text).toContain('개인을 식별할 수 있는 정보를 국외로 이전하지 않습니다')
    expect(text).toContain('이 개인정보처리방침은 2026년 9월 1일부터 적용됩니다.')
  })
  it('미확정 값 2곳(4장 — 호스팅 계약 법인명 · 알림톡 수탁사 계약 주체)만 «(확정 전)» · 수탁사 이름은 남는다(D-29)', () => {
    expect(PRIVACY_DOC.markdown.split(P9_4_PENDING)).toHaveLength(3)
    expect(text).toContain('(확정 전) (Amazon Web Services 서울 리전)')
    expect(text).toMatch(/\(주\)누리고\(Solapi\) \(확정 전\) \| 알림톡·문자 발송/)
  })
})

describe('조각 — 사업자정보(04 1절 · D-36) · 발급 화면 고지(05-A · D-32 · D-35)', () => {
  it('손으로 고치지 않았다 — 머리줄 해시 = 지금 줄들 · 정본 출처(파일 · 절 · 커밋, dirty 아님)는 주석에만', () => {
    for (const [file, lines, origin] of [
      ['./business.ts', BUSINESS_INFO, /^\/\/ 정본: 04_[^ ]+\.md ## 1\. · legal-pages @[0-9a-f]{7}$/m],
      ['./issue-notice.ts', ISSUE_NOTICE, /^\/\/ 정본: 05_[^ ]+\.md ## A\. · legal-pages @[0-9a-f]{7}$/m],
    ] as const) {
      expect(header(read(file))).toBe(sha(unmark(Object.values(lines).join('\n') + '\n')))
      expect(read(file)).toMatch(origin)
      expect(JSON.stringify(lines)).not.toMatch(/legal-pages|\.md/)
    }
  })
  it('사업자정보 7줄 — 순서 · 공정위 조회 링크 · 호스팅 칸만 확정 전', () => {
    expect(Object.keys(BUSINESS_INFO)).toEqual([
      'brand',
      'registration',
      'mailOrder',
      'address',
      'contact',
      'privacyOfficer',
      'hosting',
    ])
    expect(BUSINESS_INFO.registration).toBe(
      '사업자등록번호: 704-24-01747 [사업자정보확인](https://www.ftc.go.kr/bizCommPop.do?wrkr_no=7042401747)',
    )
    expect(BUSINESS_INFO.hosting).toBe(`호스팅 서비스: ${P9_4_PENDING}`)
    expect(Object.values(BUSINESS_INFO).filter((l) => l.includes(P9_4_PENDING))).toHaveLength(1)
  })
  it('발급 화면 고지 — 설치 전 3,500원 환불 · 이용약관 동의 포함(약관 6조④ · 12조③)', () => {
    expect(ISSUE_NOTICE.refund).toBe(
      '발급 후 설치 전에는 이미 발급된 eSIM의 폐기 비용 3,500원을 부담하시면 환불됩니다. 설치 후에는 단순 변심에 의한 환불이 되지 않습니다(eSIM 하자나 표시와 다른 경우는 재발급 또는 환불).',
    )
    expect(ISSUE_NOTICE.consent).toBe(
      '(필수) 이용약관과 위 내용을 확인했으며, 발급 후 청약철회가 제한되고 설치 전 환불 시 폐기 비용 3,500원을 부담하는 것에 동의합니다.',
    )
  })
  it('공개 금지어 · 대괄호 태그 없음', () => {
    for (const l of [...Object.values(BUSINESS_INFO), ...Object.values(ISSUE_NOTICE)]) {
      expect(forbiddenIn(unmark(l))).toEqual([])
      expect(l.replace(/\[[^\]\n]+\]\(https:\/\/[^)\s]*\)/g, '')).not.toMatch(/[[\]]/)
    }
  })
})
