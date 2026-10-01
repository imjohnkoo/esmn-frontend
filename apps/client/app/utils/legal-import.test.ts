import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 가져오기 CLI(client-shell spec F-12 · F-20) — 실제로 node 로 돌려 본다. 쓰기는 임시 폴더로만(LEGAL_IMPORT_OUT_DIR) —
 * 정본(legal-pages)은 CI 에 없으므로 규칙과 맞지 않는 가짜 정본으로 «전부 통과해야만 쓴다» · 경로 해석 · 종료 코드를 본다.
 */
const CLI = fileURLToPath(new URL('../../scripts/legal-import.mjs', import.meta.url))
const tmp = (name: string) => mkdtempSync(join(tmpdir(), `legal-${name}-`))
const run = (args: string[], env: Record<string, string>) =>
  spawnSync(
    process.execPath,
    ['--experimental-strip-types', '--no-warnings=ExperimentalWarning', CLI, ...args],
    { encoding: 'utf8', env: { ...process.env, ...env } },
  )

describe('legal-import CLI', () => {
  it('정본이 규칙과 맞지 않으면(메모 · 값 자리를 못 찾음) exit 1 · 아무 파일도 쓰지 않는다', () => {
    const from = tmp('src')
    const out = tmp('out')
    writeFileSync(join(from, '01_이용약관.md'), '# 이용약관\n본문\n')
    writeFileSync(join(from, '02_개인정보처리방침.md'), '# 방침\n본문\n')
    const r = run(['--from', from, '--docs', 'terms,privacy'], { LEGAL_IMPORT_OUT_DIR: out })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/찾지 못했다/)
    expect(r.stderr).toContain('아무 파일도 쓰지 않았다')
    expect(readdirSync(out)).toEqual([])
  })

  it('상대 경로 --from 은 명령을 친 곳(INIT_CWD) 기준으로 푼다 — yarn workspace 가 cwd 를 바꿔도', () => {
    const base = tmp('cwd')
    mkdirSync(join(base, 'src'))
    writeFileSync(join(base, 'src', '01_이용약관.md'), '# 이용약관\n본문\n')
    const r = run(['--from', 'src', '--docs', 'terms'], {
      LEGAL_IMPORT_OUT_DIR: tmp('out'),
      INIT_CWD: base,
    })
    expect(r.stderr).not.toMatch(/ENOENT/)
    expect(r.stderr).toMatch(/찾지 못했다/)
  })

  // 05 는 메모 · 값 자리 규칙이 비어 있어 가짜 정본으로 성공 경로를 걸을 수 있다
  const FAKE_05 = [
    '# 고지',
    '## A. 발급 화면',
    '```',
    '발급 전에 확인해 주세요',
    '• eSIM 발급은 상품 제공을 가짜 안내.',
    '• 발급 후 설치 전에는 가짜 안내.',
    '• 이용 기간은 가짜 안내.',
    '• eSIM을 설치할 기기가 가짜 안내. [지원 기기 확인]',
    '• eSIM에 문제가 있으면 가짜 안내.',
    '☐ (필수) 가짜 동의.',
    // 건너뛰는 줄(규칙 skip — 해시 고정) — 정본 05-A 의 버튼 · 링크 줄 글자 그대로
    '[이용약관 보기]   [취소·환불 정책 보기]                  [eSIM 발급하기]',
    '```',
    '',
  ].join('\n')

  it('성공하면 지정한 출력 폴더에만 쓴다(LEGAL_IMPORT_OUT_DIR)', () => {
    const from = tmp('src')
    const out = tmp('out')
    writeFileSync(join(from, '05_고지문구-동의체크-FAQ.md'), FAKE_05)
    const r = run(['--from', from, '--docs', 'issue-notice'], { LEGAL_IMPORT_OUT_DIR: out })
    expect(r.status).toBe(0)
    expect(readdirSync(out)).toEqual(['issue-notice.ts'])
    expect(readFileSync(join(out, 'issue-notice.ts'), 'utf8')).toContain("refund: '발급 후 설치 전에는 가짜 안내.'")
  })

  it('정본 코드 블록에 고르지도 건너뛰지도 않는 줄이 생기면 실패 · 아무것도 쓰지 않는다', () => {
    const from = tmp('src')
    const out = tmp('out')
    writeFileSync(join(from, '05_고지문구-동의체크-FAQ.md'), FAKE_05.replace('☐ (필수) 가짜 동의.', '☐ (필수) 가짜 동의.\n• 새로 생긴 안내 한 줄.'))
    const r = run(['--from', from, '--docs', 'issue-notice'], { LEGAL_IMPORT_OUT_DIR: out })
    expect(r.status).toBe(1)
    expect(r.stderr).toMatch(/고르지도 건너뛰지도 않았다/)
    expect(readdirSync(out)).toEqual([])
  })

  it('하나라도 실패하면 통과한 문서도 쓰지 않는다(전부 아니면 0)', () => {
    const from = tmp('src')
    const out = tmp('out')
    writeFileSync(join(from, '05_고지문구-동의체크-FAQ.md'), FAKE_05)
    writeFileSync(join(from, '01_이용약관.md'), '# 이용약관\n본문\n')
    const r = run(['--from', from, '--docs', 'issue-notice,terms'], { LEGAL_IMPORT_OUT_DIR: out })
    expect(r.status).toBe(1)
    expect(readdirSync(out)).toEqual([])
  })

  it('모르는 문서 이름 · --from 없음은 실패', () => {
    expect(run(['--from', tmp('src'), '--docs', 'nope'], {}).status).not.toBe(0)
    const r = run([], {})
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('사용:')
  })
})
