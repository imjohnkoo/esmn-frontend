/**
 * 법정 문서 게시 변환 규칙(client-shell spec F-12 · F-20 · D-25 · D-29 · D-32 · D-35 · D-36) — legal-pages 정본 md → 게시용 글자.
 * scripts/legal-import.mjs(CLI)와 테스트(app/utils/legal-posting.test.ts)가 같이 쓴다. 타입 문법만 쓴다(node 타입 제거 실행).
 *
 * 게시 규칙 = legal-pages 08 D절: 제목의 «— 초안 vX» · frontmatter · `>` 인용 블록(이어지는 줄 포함) · «결정 기록» 절(제목 수준 무관) ·
 * 검토 태그 · 코드 백틱을 걷는다. 태그는 **알고 있는 것만** 처리한다 — 검토 메모(notes · 지운다) · 값 자리(placeholders ·
 * 확정 전 표시로 바꾼다). 둘 다 **태그 글자의 sha256** 으로만 적는다 — 이 리포는 공개라 내부 검토 메모 글자를 두지 않는다.
 * 처음 보는 태그나 걷고 난 뒤 남은 대괄호는 실패(그 태그의 sha256 을 알려 준다) — 사람이 메모인지 값 자리인지 정해 목록에 넣는다.
 * 렌더러(app/utils/legal-markdown.ts)가 지원하지 않는 문법도 실패 — 조용히 깨져 게시되지 않게.
 * ⚠️ 이 파일에 자리표시자 이름 · 화면 표기를 직접 쓰지 않는다(콘텐츠 게이트 D-17) — PENDING_MARK 로 두고 모듈 생성 때 바꾼다.
 */
import { createHash } from 'node:crypto'

export type DocKey = 'terms' | 'privacy'
export type BlockKey = 'business' | 'issue-notice'

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

export interface TagRules {
  /** 지우는 검토 메모 — 정본 태그 글자(백틱 포함)의 sha256 */
  notes: readonly string[]
  /** 값이 아직 없는 자리 — 정본 태그 글자의 sha256. 그 태그만 확정 전 표시로(앞뒤 문장 · 이름은 남는다) */
  placeholders: readonly string[]
}

/** 게시 수정(spec D-33 · D-41) — 정본에 있지만 게시하지 않기로 결정한 글자. 정본 rev 가 오면 규칙에서 지운다 */
export interface PostingEdit {
  /** 고칠 줄 — 게시 본문(꾸밈 · 백틱 정리 뒤) 한 줄의 sha256. ⚠️ 값 자리가 있는 줄은 내부 표식 상태로 해시된다 — 지금은 값 자리 없는 줄만 고친다 */
  line: string
  /** 그 줄에서 바꿀 글자 — 정확히 한 번 나와야 한다 */
  from: string
  to: string
}

export interface DocRules extends TagRules {
  file: string
  exportName: string
  /** 게시 수정 — 결정된 것만(spec D-33). 줄 · 글자를 못 찾으면 가져오기가 멈춘다 */
  edits?: readonly PostingEdit[]
}

export const DOC_RULES: Record<DocKey, DocRules> = {
  terms: {
    file: '01_이용약관.md',
    exportName: 'TERMS_DOC',
    notes: [
      '0ea1d26f2eb8f5abdafb70533c5e2a8586293e13a8c91dfe12ad784a592fd7fa',
      '38f36ea7a059ab45e1ccdea6b77072d79a1ee7ddaa8fc12ddc91b0db7c58660d',
      '13ba4bdc505d129420855617baa03c305765fdbd6ccb2581f8cfc32a231655b9',
      'e3cf9880b01e2521bac263bfb9672bc94b3bc4b2a8a468fb9d1882523733a6cd',
    ],
    placeholders: [],
    // 게시 수정(spec D-33 — John 2026-10-02 «괄호를 지우고 게시»): 8조② 의 자정 예시 괄호를 뺀다(정본 rev 가 오면 지운다)
    edits: [{ line: 'fbf7c3835a588a2040eb24b5d6b6249ba9df6a3002e3feefc5e13fd76eb54549', from: '(예: 한국시간 자정 기준)', to: '' }],
  },
  privacy: {
    file: '02_개인정보처리방침.md',
    exportName: 'PRIVACY_DOC',
    notes: [
      '1660933dd42f23ab5f4adedbe6c768c11237ea7bbe4f10e8453f3208fc2027e5',
      '64755b3fa167fbe42ab955eed70f45d14051dfaf3404816fb2de966e9aa9c438',
    ],
    // 4장 수탁자 표 — 호스팅 계약 법인명 · 알림톡 수탁사 계약 주체
    placeholders: [
      'ea699f1ac6590ff3f191078b4d4e99330958f5b967f16332876c37edad615718',
      '5f7f843b806d94c2a9013548c68efb81f1d309dce803d605109489163201df5c',
    ],
  },
}

/** 정본 한 절의 코드 블록에서 줄을 골라 오는 규칙(문서 통째가 아니라 화면 한 조각에 쓰는 문구) */
export interface BlockRules extends TagRules {
  file: string
  exportName: string
  /** 이 글자로 시작하는 `##` 제목의 절 — 그 절의 첫 코드 블록에서 고른다 */
  section: string
  /** 고를 줄 — 키 · 줄 머리(그 글자로 시작하는 줄이 정확히 1개여야 한다) · 걷어 낼 머리 기호 */
  pick: readonly { key: string; startsWith: string; strip?: string }[]
  /** 대괄호 표시 → 링크 주소(공개 주소만) */
  links: Readonly<Record<string, string>>
}

export const BLOCK_RULES: Record<BlockKey, BlockRules> = {
  // 04 1절 — 사업자정보 7줄(D-36 발급기 `/` 임시 블록 · W1-2 푸터 F-7 이 그대로 쓴다)
  business: {
    file: '04_사업자정보-고객센터.md',
    exportName: 'BUSINESS_INFO',
    section: '## 1.',
    pick: [
      { key: 'brand', startsWith: '이심마니 |' },
      { key: 'registration', startsWith: '사업자등록번호:' },
      { key: 'mailOrder', startsWith: '통신판매업신고:' },
      { key: 'address', startsWith: '주소:' },
      { key: 'contact', startsWith: '전화:' },
      { key: 'privacyOfficer', startsWith: '개인정보보호책임자:' },
      { key: 'hosting', startsWith: '호스팅 서비스:' },
    ],
    links: { '[사업자정보확인]': 'https://www.ftc.go.kr/bizCommPop.do?wrkr_no=7042401747' },
    notes: [],
    placeholders: ['fbb49b2998f2c4650e47969848dd7c006c102bd6a8ca18e6b429bd40e7a92b69'],
  },
  // 05-A — 발급 화면의 환불 안내 한 줄(14행 · D-32) · 동의 체크 문구(19행 · D-35)
  'issue-notice': {
    file: '05_고지문구-동의체크-FAQ.md',
    exportName: 'ISSUE_NOTICE',
    section: '## A.',
    pick: [
      { key: 'refund', startsWith: '• 발급 후 설치 전에는', strip: '• ' },
      { key: 'consent', startsWith: '☐ (필수)', strip: '☐ ' },
    ],
    links: {},
    notes: [],
    placeholders: [],
  },
}

/** 값 자리 표시 — 모듈 생성 때 자리표시자 상수로 바뀐다 */
export const PENDING_MARK = '\u0000PENDING\u0000'
const slotMark = (i: number) => `\u0000SLOT${i}\u0000`

/** eSIM 도메인 불변(사용일수는 첫 연결부터 24시간 단위) — 날짜 경계 낱말 자체를 금지: 자정(«당일자정» 처럼 붙여 써도) ·
 *  0시 · 00시 · 24시(«24시간» 은 제외) · 0:00 · 00:00 · 24:00 · 23:59(공백 허용) · 오전/밤/새벽 12시 · 영시 · 열두 시 · 12 AM · midnight. 법정 문서에 정상으로 쓰일 일이 없어 시끄럽게 멈추는 쪽.
 *  «사업자정보 · 판매자정보 · 이용자정보» 처럼 «…자 + 정보» 의 글자만 제외(«자정보다» 는 잡는다) */
/** «…시» 뒤 — 시끄럽게 멈추는 쪽: 숫자 꼴(0 · 00 · 24시)은 «시간» 만 빼고 모두 시각으로 본다(경 · 쯤 · 로 · 면 · 께 … 어떤 뒷말이든).
 *  낱말 꼴(영시 · 열두 시)은 «시간 · 시즌 · 시행» 만 뺀다(그 낱말의 다른 뜻) */
const HOUR_END = '(?!\\s*간)'
const WORD_HOUR_END = '(?!\\s*(?:간|즌|행))'
export const MIDNIGHT = new RegExp(
  [
    '자정(?!보(?!다))',
    `(?<!\\d)(?:0|00|24)\\s*시${HOUR_END}`,
    '(?<![\\d:])(?:0?0|24)\\s*:\\s*00(?!\\d)',
    '(?<![\\d:])23\\s*:\\s*59(?!\\d)',
    '(?<!\\d)23\\s*시\\s*59\\s*분',
    '(?:오후|밤|저녁)\\s*11\\s*(?:시\\s*59\\s*분|:\\s*59(?!\\d))',
    '(?<!\\d)11\\s*(?::\\s*59|시\\s*59\\s*분)\\s*(?:p\\.?\\s?m\\b|오후)',
    '\\bp\\.?\\s?m\\.?\\s*11\\s*(?::\\s*59|시\\s*59\\s*분)',
    '(?:오전|밤|새벽)\\s*12\\s*(?:시|:\\s*00)',
    `(?:(?<![가-힣])|(?<=밤|새벽|오전))(?:영|열두)\\s*시${WORD_HOUR_END}`,
    '\\b12(?:\\s*:\\s*00)?\\s*a\\.?\\s?m\\b\\.?',
    'midnight',
  ].join('|'),
  'i',
)

/** 공개 화면에 남으면 안 되는 말(John — 해외 공급사 명칭 영문 · 한글 · 내부 용어 · 사람 · 결정/브리프/과제 번호 · 개발 경로) */
export const FORBIDDEN: readonly RegExp[] = [
  /spark/i,
  /maya/i,
  /airalo/i,
  /tsim/i,
  /스파크|티심|마야|에어알로/,
  /\bphase|proposal|초안|브리프|\bTODO\b|\bTBD\b|변호사/i,
  /\bjohn\b/i,
  /\{N\}/,
  // 결정 · 과제 · 브리프 번호(대소문자 무관) · 한 글자 코드(대문자만 — «5G» 같은 일반 표기와 구분)
  /\b(?:W\d-\d{1,2}|P\d{1,2}-\d{1,2}|H-\d{3}|D-\d{1,3}|INF-\d|E2E-\d|L\d~L\d)\b/i,
  /\b[A-Z]-?\d{1,2}\b/,
  /\br\d{1,2}\b/,
  // 개발 경로 · 파일 · 리포 이름 — 링크가 아닌 «/경로» 표기 포함(08 D절)
  /apps\/|server\/api|\/api\/v\d|checkout-preview|\.vue\b|\.mjs\b|\.ts\b|\.md\b|legal-pages|nomacom|esim-manager/i,
  /(?:^|[\s«「]|(?<!\])\()\/(?:checkout-preview|business|support|refund|terms|privacy|my|verify|details|select-date|view)\b/,
  // 경쟁사 이름
  /유심사|도시락|로밍도깨비|로깨비|말톡/,
  MIDNIGHT,
]

export interface Posting {
  title: string
  body: string
  pendingCount: number
}

/** «결정 기록» 절 제목 — 맨 앞(번호 · 괄호 머리 허용)에서만. «제5장 결정 기록의 보관» 같은 본문 장은 걷지 않는다 */
const DECISION = /^(?:[\d.]+\s*|\([^)]*\)\s*)?결정\s*기록/

/** 검토 메모 · 값 자리의 후보 — 백틱으로 감싼 대괄호 태그(해시는 백틱 포함) 또는 맨 대괄호 태그(뒤에 «(» 가 붙은 링크 글자는 제외) */
const DOC_TAG = /`\[[^`\n]*\]`|\[[^\]\n]*\](?!\()/g
/** 인용 블록이 빈 줄 없이 끝나는 줄 — 제목 · 목록 · 표 · 한 줄 굵게 · 구분선은 새 블록이다(이어지는 줄이 아니다) */
const BLOCK_START = /^(?:#{1,6}\s|\s*(?:\d+\.|[-*])\s|\s*\||\*\*[^*]+\*\*\s*$|-{3,}\s*$)/

function normalize(source: string): string {
  return source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n')
}

/** 태그를 규칙대로 바꾼다 — 값 자리는 자리마다 다른 표시(본문에 살아남았는지 따로 본다) · 메모는 지움 · 모르는 태그는 그대로(뒤에서 실패) */
function applyTags(text: string, rules: TagRules, tagRe: RegExp): string {
  const seen = new Set<string>()
  const out = text.replace(tagRe, (tag) => {
    const h = sha256(tag)
    const slot = rules.placeholders.indexOf(h)
    if (slot >= 0) {
      seen.add(h)
      return slotMark(slot)
    }
    if (rules.notes.includes(h)) {
      seen.add(h)
      return ''
    }
    return tag
  })
  for (const h of [...rules.notes, ...rules.placeholders])
    if (!seen.has(h)) throw new Error(`정본에서 이 태그를 찾지 못했다(정본이 바뀌었다): sha256 ${h.slice(0, 12)}…`)
  return out
}

/** 값 자리마다 본문에 남았는지(인용 블록 안에만 있으면 빈칸이 된다) · 옆 글자 · 지원 문법 · 남은 대괄호를 본 뒤 표시를 하나로 */
function finish(body: string, rules: TagRules): { body: string; pendingCount: number } {
  rules.placeholders.forEach((_, i) => {
    if (!body.includes(slotMark(i)))
      throw new Error(`값 자리 ${i + 1} 이 게시 본문에 없다(걷어 내는 줄 안에만 있었다)`)
  })
  rules.placeholders.forEach((_, i) => (body = body.split(slotMark(i)).join(PENDING_MARK)))
  const word = /[A-Za-z0-9_]/
  for (let at = body.indexOf(PENDING_MARK); at >= 0; at = body.indexOf(PENDING_MARK, at + 1))
    if (word.test(body[at - 1] ?? '') || word.test(body[at + PENDING_MARK.length] ?? ''))
      throw new Error('값 자리 바로 옆에 영문 · 숫자 · 밑줄이 붙었다 — 화면에서 자리표시자 이름이 샌다')
  const rest = body.replace(/\[[^\]\n]+\]\((?:https:\/\/|\/(?![/\\]))[^)\s]*\)/g, '')
  const left = rest
    .split('\n')
    .filter((l) => /[[\]]/.test(l))
    .map((l) => {
      const tag = /\[[^\]\n]*\]?/.exec(l)?.[0] ?? l
      return `${tag} (sha256 — 맨 글자 ${sha256(tag)} · 백틱 포함 ${sha256('`' + tag + '`')})`
    })
  if (left.length)
    throw new Error(`처음 보는 태그(메모인지 값 자리인지 정해 sha256 을 규칙에 넣는다): ${left.join(' · ')}`)
  const bad = unsupportedIn(body)
  if (bad.length) throw new Error(`렌더러가 지원하지 않는 문법:\n  ${bad.join('\n  ')}`)
  return { body, pendingCount: body.split(PENDING_MARK).length - 1 }
}

/** 정본 md → 게시용 md(값 자리는 PENDING_MARK). 모르는 태그 · 남은 대괄호 · 지원하지 않는 문법 · 제목 없음은 throw */
export function toPosting(source: string, rules: TagRules & { edits?: readonly PostingEdit[] }): Posting {
  let text = normalize(source)
  // frontmatter(첫 줄 --- … ---)
  if (text.startsWith('---\n')) {
    const end = text.indexOf('\n---\n', 4)
    if (end < 0) throw new Error('frontmatter 가 닫히지 않았다')
    text = text.slice(end + 5)
  }
  text = applyTags(text, rules, DOC_TAG)
  const out: string[] = []
  let title = ''
  let inQuote = false
  let skip: { level: number; bold: boolean } | null = null
  for (const raw of text.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    // 한 줄 전체 굵게(조 제목 꼴) — «**결정 기록**» 도 걷는다
    const bold = /^\*\*([^*]+)\*\*\s*$/.exec(line)
    if (inQuote) {
      if (!line.trim()) {
        inQuote = false
        continue
      }
      if (!BLOCK_START.test(line)) continue
      inQuote = false
    }
    if (!title && heading?.[1] === '#') {
      title = heading[2]!.replace(/\s+—\s+초안.*$/, '').trim()
      continue
    }
    // «결정 기록» 절 — `#` 제목으로 시작했으면 같거나 높은 단계의 `#` 제목에서만 끝난다(안의 굵은 줄 · 낮은 제목은 함께 걷는다).
    // 한 줄 굵게로 시작했으면 다음 굵은 줄이나 제목에서 끝난다
    if (skip && heading && heading[1]!.length <= skip.level) skip = null
    else if (skip?.bold && (bold || heading)) skip = null
    const headText = heading?.[2] ?? bold?.[1]
    if (headText && DECISION.test(headText)) {
      skip = heading ? { level: heading[1]!.length, bold: false } : { level: 0, bold: true }
      continue
    }
    if (skip) continue
    // 인용 블록 — `>` 줄(들여쓴 것 포함 — 목록 항 아래 메모)과 빈 줄(또는 새 블록) 전까지 이어지는 줄(lazy continuation)까지
    if (/^\s*>/.test(line)) {
      inQuote = true
      continue
    }
    if (/^-{3,}$/.test(line)) continue
    out.push(line)
  }
  if (!title) throw new Error('문서 제목(# …)이 없다')
  if (/[[\]`]/.test(title)) throw new Error(`제목에 태그 · 백틱이 남았다: ${title}`)
  let body = out.join('\n')
  // 메모를 지운 자리의 앞 공백 정리(문장 끝 «. ` [..]`» → «.»)
  body = body.replace(/[ \t]+\n/g, '\n').replace(/(?<=\S)[ \t]{2,}(?=\S)/g, ' ')
  body = body.replace(/`([^`\n]*)`/g, '$1')
  body = body.replace(/\n{3,}/g, '\n\n').trim() + '\n'
  return { title, ...finish(applyEdits(body, rules.edits), rules) }
}

/** 게시 수정 적용 — 해시가 같은 줄이 정확히 1개 · 그 줄에 바꿀 글자가 정확히 한 번일 때만. 아니면 정본이 바뀐 것이니 멈춘다(사람이 다시 정한다) */
export function applyEdits(body: string, edits: readonly PostingEdit[] = []): string {
  const lines = body.split('\n')
  edits.forEach((edit, i) => {
    const at = lines.flatMap((l, n) => (sha256(l) === edit.line ? [n] : []))
    if (at.length !== 1)
      throw new Error(`게시 수정 ${i + 1}: 고칠 줄이 ${at.length}개다(정확히 1개여야 한다 — 정본이 바뀌었다): sha256 ${edit.line.slice(0, 12)}…`)
    const line = lines[at[0]!]!
    if (!edit.from || line.split(edit.from).length !== 2)
      throw new Error(`게시 수정 ${i + 1}: 바꿀 글자가 그 줄에 정확히 한 번 있어야 한다(정본이 바뀌었다)`)
    lines[at[0]!] = line.replace(edit.from, () => edit.to)
  })
  return lines.join('\n')
}

export interface BlockPosting {
  lines: Record<string, string>
  pendingCount: number
}

/** 정본 한 절의 코드 블록 → 고른 줄(값 자리는 PENDING_MARK · 링크 표시는 [글자](주소)) */
export function toBlock(source: string, rules: BlockRules): BlockPosting {
  const text = normalize(source)
  const lines = text.split('\n')
  const start = lines.findIndex((l) => l.startsWith(rules.section))
  if (start < 0) throw new Error(`절을 찾지 못했다: ${rules.section}`)
  const end = lines.findIndex((l, i) => i > start && /^## /.test(l))
  const sectionLines = lines.slice(start + 1, end < 0 ? undefined : end)
  const open = sectionLines.findIndex((l) => l.startsWith('```'))
  const close = sectionLines.findIndex((l, i) => i > open && l.startsWith('```'))
  if (open < 0 || close < 0) throw new Error(`${rules.section} 절에 코드 블록이 없다`)
  // 코드 블록 안 태그는 백틱이 없다 — 대괄호 태그 그대로
  const code = applyTags(sectionLines.slice(open + 1, close).join('\n'), rules, /\[[^\]\n]*\]/g)
  const picked: Record<string, string> = {}
  for (const p of rules.pick) {
    const hit = code.split('\n').filter((l) => l.startsWith(p.startsWith))
    if (hit.length !== 1)
      throw new Error(`«${p.startsWith}» 로 시작하는 줄이 ${hit.length}개다(1개여야 한다 — 정본이 바뀌었다)`)
    let line = hit[0]!.trim()
    if (p.strip && line.startsWith(p.strip)) line = line.slice(p.strip.length)
    // 이미 [글자](주소) 로 쓰인 것은 그대로 — 주소가 두 번 붙지 않게
    for (const [label, href] of Object.entries(rules.links))
      line = line.replace(
        new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?!\\()', 'g'),
        `${label}(${href})`,
      )
    picked[p.key] = line
  }
  const { body, pendingCount } = finish(Object.values(picked).join('\n') + '\n', rules)
  const out = body.trimEnd().split('\n')
  return {
    lines: Object.fromEntries(rules.pick.map((p, i) => [p.key, out[i]!])),
    pendingCount,
  }
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

/**
 * 렌더러(app/utils/legal-markdown.ts)가 지원하지 않는 문법 — 조용히 깨져 그려지는 것들. 줄 번호 · 이유 목록(없으면 []).
 * 지원: `##` · `###` · 한 줄 굵게 · 문단 · `1.` / `-` 목록(2단 · 같은 들여쓰기에 한 종류 · 첫 항목보다 얕지 않게) ·
 * 표(앞뒤 `|` · 둘째 줄 = 구분행 · 칸 수 = 머리행) · 굵게 `**` · [글자](https 또는 /경로)
 */
export function unsupportedIn(body: string): string[] {
  const out: string[] = []
  let levels: { indent: number; ordered: boolean }[] | null = null
  let tableRow = -1
  let cols = 0
  let prevBlank = false
  body.split('\n').forEach((line, i) => {
    const n = i + 1
    const bad = (why: string) => out.push(`${n}: ${why}`)
    if (/^\s*#{1,6}\s/.test(line) && !/^#{2,3}\s/.test(line)) bad('제목은 줄 맨 앞 ## · ### 만')
    if (/^#{1,6}\s*$/.test(line)) bad('내용 없는 제목(메모를 걷어 낸 자리?)')
    if (prevBlank && /^\s{2,}\S/.test(line)) bad('빈 줄 뒤 들여쓴 줄 — 하위 목록 · 둘째 문단은 빈 줄 없이')
    if (/^#{2,3}\s.*\s#+\s*$/.test(line)) bad('닫는 # 이 붙은 제목')
    if (/^\s*(?:={3,}|-{3,}|\*{3,}|_{3,})\s*$/.test(line)) bad('구분선 · 밑줄식 제목')
    if (/^\s*>/.test(line)) bad('인용')
    if (/<\/?[a-zA-Z!][^>]*>|&[a-zA-Z]+;|&#\d+;/.test(line)) bad('HTML 태그 · 개체')
    if (/!\[/.test(line)) bad('이미지')
    if (/\\[\\`*_{}[\]()#+\-.!|>]/.test(line)) bad('백슬래시 이스케이프')
    if (/\]\([^)\s]*\(/.test(line)) bad('링크 주소 안의 괄호')
    if (/__/.test(line)) bad('밑줄 굵게(__)')
    // 굵게는 ** 짝으로만 — 홀수면 기호가 화면에 남는다 · 남은 별표 하나는 기울임(지원 안 함)
    const body2 = line.replace(/^\s*[-*]\s+/, '')
    if ((body2.match(/\*\*/g) ?? []).length % 2) bad('짝 없는 **')
    if (/\*/.test(body2.replace(/\*\*/g, ''))) bad('별표 하나(기울임)')
    if (/^\s*(?:\+\s|\d+\)\s)/.test(line)) bad('목록 기호는 «1.» · «-» 만')
    if (/^\s+\|/.test(line)) bad('들여쓴 표')
    if (line.startsWith('|')) {
      const cells = splitRow(line)
      tableRow = tableRow < 0 ? 0 : tableRow + 1
      if (tableRow === 0) cols = cells.length
      else if (cells.length !== cols) bad(`표 칸 수 ${cells.length} ≠ 머리행 ${cols}`)
      const isSep = cells.every((c) => /^:?-+:?$/.test(c))
      if (tableRow === 1 && !isSep) bad('표 둘째 줄이 구분행이 아니다')
      if (tableRow !== 1 && isSep) bad('표 구분행이 둘째 줄이 아니다')
      if (!/\|\s*$/.test(line)) bad('표 줄이 | 로 끝나지 않는다')
      if (cells.some((c) => (c.match(/\*\*/g) ?? []).length % 2)) bad('표 칸 경계를 넘는 굵게')
    } else tableRow = -1
    const m = /^(\s*)(?:(\d+)\.|[-*])(\s+|$)(.*)$/.exec(line)
    if (m) {
      const indent = m[1]!.length
      const ordered = m[2] !== undefined
      if (!m[4]!.trim()) bad('내용 없는 목록 항목(메모를 걷어 낸 자리?)')
      if (ordered && Number(m[2]) > 99) bad(`줄 머리 «${m[2]}.» 가 번호 목록으로 읽힌다`)
      levels ??= []
      if (levels.length && indent < levels[0]!.indent) bad('목록 항목이 첫 항목보다 얕게 들여쓰였다')
      const lvl = levels.find((l) => l.indent === indent)
      if (!lvl) {
        levels.push({ indent, ordered })
        if (levels.length > 2) bad('목록 3단')
      } else if (lvl.ordered !== ordered) bad('같은 들여쓰기에 번호 · 글머리가 섞였다')
    } else if (!line.trim() || !/^\s{2,}\S/.test(line)) levels = null
    else if (/^\s{2,}#/.test(line)) bad('목록 안의 제목')
    prevBlank = !line.trim()
  })
  return out
}

export function forbiddenIn(text: string): string[] {
  const hits: string[] = []
  text.split('\n').forEach((line, i) => {
    for (const re of FORBIDDEN)
      if (re.test(line)) hits.push(`${i + 1}: ${re} — ${line.slice(0, 80)}`)
    if (line.includes('`')) hits.push(`${i + 1}: 백틱 — ${line.slice(0, 80)}`)
  })
  return hits
}

export const bodyHash = (body: string) => sha256(body)

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const tpl = (s: string, pendingIdent: string) =>
  '`' +
  s
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$\{/g, '\\${')
    .split(PENDING_MARK)
    .join('${' + pendingIdent + '}') +
  '`'

const HEADER = (sourceLabel: string, hash: string) => `// 생성물 — scripts/legal-import.mjs 가 legal-pages 정본에서 게시 규칙(08 D절)을 적용해 만든다.
// 손으로 고치지 말 것 — 정본을 고친 뒤 \`yarn workspace nomacom-client legal:import --from <정본 폴더>\` 로 다시 만든다.
// 정본: ${sourceLabel}
// sha256(본문): ${hash}
`

/** 생성 모듈 원문. pendingIdent = 자리표시자 상수 이름(부르는 쪽이 넘긴다 — 이 파일에 이름을 쓰지 않으려고) */
export function moduleSource(
  key: DocKey,
  posting: Posting,
  sourceLabel: string,
  pendingIdent: string,
): string {
  const rules = DOC_RULES[key]
  const imports = posting.pendingCount ? `import { ${pendingIdent} } from '../pending'\n` : ''
  const edits = rules.edits?.length
    ? `// 게시 수정 ${rules.edits.length}건 — 정본과 다른 글자(규칙 scripts/legal-posting.ts 의 edits · spec 결정)\n`
    : ''
  return `${HEADER(sourceLabel, bodyHash(posting.body))}${edits}${imports}import type { LegalMarkdownDoc } from '../../utils/legal-markdown'

export const ${rules.exportName}: LegalMarkdownDoc = {
  slug: '${key}',
  title: ${q(posting.title)},
  markdown: ${tpl(posting.body, pendingIdent)},
}
`
}

/** 블록 본문 해시 — 고른 줄을 키 순서대로 한 줄씩 */
export const blockHash = (lines: Record<string, string>) =>
  sha256(Object.values(lines).join('\n') + '\n')

export function blockModuleSource(
  key: BlockKey,
  posting: BlockPosting,
  sourceLabel: string,
  pendingIdent: string,
): string {
  const rules = BLOCK_RULES[key]
  const imports = posting.pendingCount ? `import { ${pendingIdent} } from '../pending'\n\n` : ''
  const entries = Object.entries(posting.lines)
    .map(([k, v]) => `  ${k}: ${v.includes(PENDING_MARK) ? tpl(v, pendingIdent) : q(v)},`)
    .join('\n')
  return `${HEADER(sourceLabel, blockHash(posting.lines))}${imports}export const ${rules.exportName} = {
${entries}
} as const
`
}
