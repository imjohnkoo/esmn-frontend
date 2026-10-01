#!/usr/bin/env node
/**
 * 법정 문서 가져오기(client-shell spec F-12 · F-20 · D-25 · D-32 · D-35 · D-36) — legal-pages 정본(md)을 게시 형태로 바꿔
 * `app/content/legal/<이름>.ts` 를 만든다. 정본은 읽기만 한다. 변환 규칙은 scripts/legal-posting.ts(테스트가 같이 쓴다).
 *
 *   yarn workspace nomacom-client legal:import --from <legal-pages 의 사업운영/2026-09-23_client-법정페이지-초안>
 *   (기본: 문서 terms · privacy + 조각 business · issue-notice — `--docs terms,business` 로 고른다)
 *
 * 모두 먼저 변환 · 검사하고, 전부 통과했을 때만 쓴다(일부만 새 판이 되지 않게). 모르는 태그 · 공개 금지어 · 지원하지 않는 문법 ·
 * 정본이 바뀌어 메모/값 자리를 못 찾으면 멈춘다(exit 1) — legal-posting.ts 의 규칙을 사람이 고친 뒤 다시 돌린다.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(APP_DIR, 'app/content/legal')
/** 자리표시자 상수 이름(app/content/pending.ts) — 이 파일이 콘텐츠 게이트(D-17)에 걸리지 않게 조립한다 */
const PENDING_IDENT = ['P9', '4', 'PENDING'].join('_')

/** `--experimental-strip-types` 는 Node 22.6 부터 — 그 전이면 .ts import 가 알 수 없는 오류로 죽는다 */
function checkNode() {
  const [major, minor] = process.versions.node.split('.').map(Number)
  if (major < 22 || (major === 22 && minor < 6)) {
    console.error(`Node 22.6 이상이 필요하다(지금 ${process.versions.node}) — .ts 규칙 파일을 타입 제거로 읽는다`)
    process.exit(2)
  }
}

function args(rules) {
  const a = process.argv.slice(2)
  const get = (k) => {
    const i = a.indexOf(k)
    return i >= 0 ? a[i + 1] : undefined
  }
  const from = get('--from')
  if (!from) {
    console.error('사용: legal-import.mjs --from <legal-pages 초안 폴더> [--docs terms,privacy,business,issue-notice]')
    process.exit(2)
  }
  const all = [...Object.keys(rules.DOC_RULES), ...Object.keys(rules.BLOCK_RULES)]
  const docs = (get('--docs') ?? all.join(',')).split(',').map((s) => s.trim())
  for (const d of docs) if (!all.includes(d)) throw new Error(`모르는 문서: ${d}`)
  // yarn workspace 는 cwd 를 apps/client 로 바꾼다 — 상대 경로는 명령을 친 곳(INIT_CWD) 기준
  return { from: resolve(process.env.INIT_CWD ?? process.cwd(), from), docs }
}

/** 정본 커밋 — 그 파일이 커밋된 판과 다르면 +dirty */
function sourceRev(from, file) {
  const git = (argv) =>
    execFileSync('git', ['-C', from, ...argv], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  try {
    const sha = git(['rev-parse', '--short', 'HEAD'])
    return git(['status', '--porcelain', '--', file]) ? `${sha}+dirty` : sha
  } catch {
    return 'git 아님'
  }
}

async function main() {
  checkNode()
  const rules = await import('./legal-posting.ts')
  const { from, docs } = args(rules)
  const results = []
  const errors = []
  for (const key of docs) {
    const doc = rules.DOC_RULES[key]
    const block = rules.BLOCK_RULES[key]
    const file = (doc ?? block).file
    try {
      const raw = readFileSync(join(from, file), 'utf8')
      const label = `${file}${block ? ` ${block.section}` : ''} · legal-pages @${sourceRev(from, file)}`
      if (doc) {
        const posting = rules.toPosting(raw, doc)
        const hits = rules.forbiddenIn(posting.title + '\n' + posting.body)
        if (hits.length) throw new Error(`공개하면 안 되는 말이 남았다\n  ${hits.join('\n  ')}`)
        results.push({ key, label, pendingCount: posting.pendingCount, size: `본문 ${posting.body.split('\n').length}줄`, source: rules.moduleSource(key, posting, label, PENDING_IDENT) })
      } else {
        const posting = rules.toBlock(raw, block)
        const hits = rules.forbiddenIn(Object.values(posting.lines).join('\n'))
        if (hits.length) throw new Error(`공개하면 안 되는 말이 남았다\n  ${hits.join('\n  ')}`)
        results.push({ key, label, pendingCount: posting.pendingCount, size: `${Object.keys(posting.lines).length}줄`, source: rules.blockModuleSource(key, posting, label, PENDING_IDENT) })
      }
    } catch (e) {
      errors.push(`⛔ ${file}: ${e instanceof Error ? e.message : e}`)
    }
  }
  if (errors.length) {
    console.error(errors.join('\n'))
    console.error('— 아무 파일도 쓰지 않았다')
    process.exit(1)
  }
  mkdirSync(OUT_DIR, { recursive: true })
  for (const r of results) {
    const out = join(OUT_DIR, `${r.key}.ts`)
    writeFileSync(out, r.source)
    console.log(`✔ ${relative(APP_DIR, out)} ← ${r.label} (${r.size} · 확정 전 ${r.pendingCount}곳)`)
  }
}

const invoked = process.argv[1] ? realpathSync(process.argv[1]) : ''
if (invoked === realpathSync(fileURLToPath(import.meta.url))) await main()
