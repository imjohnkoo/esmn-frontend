import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

// DS-PIN-FIX W2 — 대화상자 제목 · 본문은 어절 단위로 줄바꿈한다(제안 2026-11-12-pin-dialog-fixes).
// keep-all 만 쓰면 긴 이메일 · URL 이 박스를 뚫는다. 본문이 flex(align-items: center) 항목이라 break-word 는 min-content 를
// 줄이지 못해 여전히 뚫는다(⑦ walk 실측 — 61자 이메일 제목 554px / 대화상자 280px) → anywhere.

const css = (name: string) =>
  readFileSync(`${process.cwd()}/src/components/${name}/${name}.vue`, 'utf8').split('<style>')[1]!
const rule = (src: string, sel: string) =>
  src.match(
    new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
  )?.[2] ?? ''
const decl = (src: string, sel: string, prop: string) =>
  [...rule(src, sel).matchAll(new RegExp(`(?:^|\\n)\\s*${prop}:\\s*([^;]+);`, 'g'))].at(-1)?.[1]

describe.each([
  ['NAlertDialog', '.n-alert-dialog__title', '.n-alert-dialog__description'],
  ['NConfirmDialog', '.n-confirm__title', '.n-confirm__message'],
  ['NLoaderDialog', '.n-loader-dialog__title', '.n-loader-dialog__desc'],
])('%s', (name, title, body) => {
  const src = css(name)

  it('제목 — keep-all · anywhere · text-wrap balance', () => {
    expect(decl(src, title, 'word-break')).toBe('keep-all')
    expect(decl(src, title, 'overflow-wrap')).toBe('anywhere')
    expect(decl(src, title, 'text-wrap')).toBe('balance')
  })

  it('본문 — keep-all · anywhere · text-wrap pretty', () => {
    expect(decl(src, body, 'word-break')).toBe('keep-all')
    expect(decl(src, body, 'overflow-wrap')).toBe('anywhere')
    expect(decl(src, body, 'text-wrap')).toBe('pretty')
  })
})
