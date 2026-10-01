/**
 * 법정 문서 게시용 마크다운 → 블록(client-shell spec F-12 · F-20). `app/content/legal/*.ts`(legal-import 생성물)를 읽는다.
 *
 * 부분집합만: `##` 장 · `###` 또는 한 줄 전체 굵게(조 제목) · 문단 · `1.` 번호 항 · `-` 글머리(2단) · 표 ·
 * 인라인 `**굵게**` · `[글자](https://… 또는 /경로)` · 확정 전 값(pending.ts 의 자리표시자 — 판정 · 표기는 isPending · displayValue 만).
 * HTML 은 해석하지 않는다 — 모든 글자는 텍스트 노드로 그린다(legal-render.ts).
 * ⚠️ 이 파일에 자리표시자 이름 · 화면 표기를 직접 쓰지 않는다 — 콘텐츠 게이트(D-17)가 «남은 확정 전 값» 으로 센다.
 */
import { displayValue, isPending } from '../content/pending'

export interface LegalMarkdownDoc {
  slug: 'terms' | 'privacy' | 'refund'
  title: string
  markdown: string
}

export type Inline =
  | { t: 'text'; text: string }
  | { t: 'b'; children: Inline[] }
  | { t: 'a'; href: string; children: Inline[] }
  | { t: 'pending'; token: string }

export interface ListItem {
  text: Inline[]
  children: LegalBlock[]
}

export type LegalBlock =
  | { t: 'h2'; text: Inline[] }
  | { t: 'h3'; text: Inline[] }
  | { t: 'p'; text: Inline[] }
  | { t: 'list'; ordered: boolean; start: number; items: ListItem[] }
  | { t: 'table'; head: Inline[][]; rows: Inline[][][] }

/** 링크는 https · 사이트 안 경로만(`//` · `/\` 처럼 다른 호스트로 풀리는 것 금지) — 그 밖은 글자로 둔다 */
const SAFE_HREF = /^(https:\/\/|\/(?![/\\]))/

/** 대문자 · 숫자 · 밑줄 토큰 — 자리표시자 후보(판정은 isPending) */
const TOKEN = /[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/g

/** run 의 i 번째 글자에서 시작하는 가장 긴 자리표시자(없으면 null) */
function pendingAt(run: string, i: number): string | null {
  for (let j = run.length; j > i; j--) if (isPending(run.slice(i, j))) return run.slice(i, j)
  return null
}

function plain(src: string): Inline[] {
  const out: Inline[] = []
  let last = 0
  // 토큰은 붙은 영대문자 · 숫자 · 밑줄까지 한 덩어리로 잡힌다(«AWS» 바로 뒤의 자리표시자) — 덩어리 안에서 자리표시자를 찾는다
  for (const m of src.matchAll(TOKEN)) {
    const run = m[0]
    let i = 0
    while (i < run.length) {
      const token = pendingAt(run, i)
      if (!token) {
        i++
        continue
      }
      const at = m.index! + i
      if (at > last) out.push({ t: 'text', text: src.slice(last, at) })
      out.push({ t: 'pending', token })
      last = at + token.length
      i += token.length
    }
  }
  if (last < src.length) out.push({ t: 'text', text: src.slice(last) })
  return out
}

/** `**굵게**` · `[글자](주소)` 를 찾고, 그 안팎의 글자에서 자리표시자를 가른다(굵게 안 링크 · 링크 안 굵게 1단) */
export function parseInline(src: string, depth = 0): Inline[] {
  const out: Inline[] = []
  const re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g
  let last = 0
  const inner = (s: string) => (depth < 1 ? parseInline(s, depth + 1) : plain(s))
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m.index > last) out.push(...plain(src.slice(last, m.index)))
    if (m[1] !== undefined) out.push({ t: 'b', children: inner(m[1]) })
    else if (SAFE_HREF.test(m[3]!)) out.push({ t: 'a', href: m[3]!, children: inner(m[2]!) })
    else out.push(...plain(m[0]))
    last = re.lastIndex
  }
  if (last < src.length) out.push(...plain(src.slice(last)))
  return out
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

const LIST_RE = /^(\s*)(?:(\d+)\.|[-*])\s+(.*)$/
const BOLD_LINE_RE = /^\*\*([^*]+)\*\*$/
const HEADING_RE = /^(#{2,3})\s+(.*)$/

export function parseLegalMarkdown(markdown: string): LegalBlock[] {
  // 줄 끝은 \n 만이 아니다 — \r · U+2028 · U+2029 도 줄 끝(정규식 `.` 가 못 넘어 판정이 갈리지 않게)
  const lines = markdown.split(/\r\n|[\n\r\u2028\u2029]/)
  const blocks: LegalBlock[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!line.trim()) {
      i++
      continue
    }
    const h = HEADING_RE.exec(line)
    if (h) {
      blocks.push({ t: h[1] === '##' ? 'h2' : 'h3', text: parseInline(h[2]!.trim()) })
      i++
      continue
    }
    const bold = BOLD_LINE_RE.exec(line.trim())
    if (bold) {
      blocks.push({ t: 'h3', text: parseInline(bold[1]!) })
      i++
      continue
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = []
      // 구분행은 둘째 줄 하나 — 칸마다 `-` 1개 이상(앞뒤 `:` 허용 · GFM). 다른 줄의 `---` 칸은 본문이다
      for (let k = 0; i < lines.length && lines[i]!.trim().startsWith('|'); k++, i++) {
        const cells = splitRow(lines[i]!)
        if (!(k === 1 && cells.every((c) => /^:?-+:?$/.test(c)))) rows.push(cells)
      }
      const [head = [], ...body] = rows
      blocks.push({
        t: 'table',
        head: head.map((c) => parseInline(c)),
        rows: body.map((r) => r.map((c) => parseInline(c))),
      })
      continue
    }
    if (LIST_RE.test(line)) {
      const start = i
      while (
        i < lines.length &&
        lines[i]!.trim() &&
        (LIST_RE.test(lines[i]!) || /^\s{2,}\S/.test(lines[i]!))
      )
        i++
      blocks.push(parseList(lines.slice(start, i), 0))
      continue
    }
    // 문단 — 첫 줄은 무조건 먹는다(어떤 줄에서도 반복이 앞으로 간다)
    const para: string[] = [line.trim()]
    i++
    while (
      i < lines.length &&
      lines[i]!.trim() &&
      !HEADING_RE.test(lines[i]!) &&
      !lines[i]!.trim().startsWith('|') &&
      !LIST_RE.test(lines[i]!) &&
      !BOLD_LINE_RE.test(lines[i]!.trim())
    ) {
      para.push(lines[i]!.trim())
      i++
    }
    blocks.push({ t: 'p', text: parseInline(para.join(' ')) })
  }
  return blocks
}

/** 같은 들여쓰기의 항목을 모으고, 더 깊이 들여쓴 줄은 직전 항목의 하위 목록(최대 2단) · 이어지는 글자로 */
function parseList(lines: string[], depth: number): Extract<LegalBlock, { t: 'list' }> {
  const indentOf = (l: string) => /^(\s*)/.exec(l)![1]!.length
  const base = indentOf(lines[0]!)
  const first = LIST_RE.exec(lines[0]!)!
  const ordered = first[2] !== undefined
  const items: { item: ListItem; nested: string[] }[] = []
  for (const line of lines) {
    const m = LIST_RE.exec(line)
    if (m && indentOf(line) === base) {
      items.push({ item: { text: parseInline(m[3]!), children: [] }, nested: [] })
      continue
    }
    const cur = items[items.length - 1]
    if (!cur) continue
    if (m && indentOf(line) > base) cur.nested.push(line)
    else if (cur.nested.length) cur.nested.push(line)
    else cur.item.text.push(...parseInline(' ' + line.trim()))
  }
  for (const { item, nested } of items) {
    if (!nested.length) continue
    if (depth < 1 && LIST_RE.test(nested[0]!)) item.children.push(parseList(nested, depth + 1))
    else item.text.push(...parseInline(' ' + nested.map((l) => l.trim()).join(' ')))
  }
  return {
    t: 'list',
    ordered,
    start: ordered ? Number(first[2]) : 1,
    items: items.map((x) => x.item),
  }
}

/** 인라인 → 화면 글자 — 값이 아직 없는 자리는 pending.ts 의 표기로 */
export function inlineText(xs: Inline[]): string {
  return xs
    .map((x) =>
      x.t === 'text' ? x.text : x.t === 'pending' ? displayValue(x.token) : inlineText(x.children),
    )
    .join('')
}

/** 화면에 보이는 글자만(테스트 · 메타 설명용) */
export function blocksText(blocks: LegalBlock[]): string {
  const walk = (b: LegalBlock): string[] => {
    if (b.t === 'list')
      return b.items.flatMap((it) => [inlineText(it.text), ...it.children.flatMap(walk)])
    if (b.t === 'table')
      return [
        b.head.map(inlineText).join(' | '),
        ...b.rows.map((r) => r.map(inlineText).join(' | ')),
      ]
    return [inlineText(b.text)]
  }
  return blocks.flatMap(walk).join('\n')
}
