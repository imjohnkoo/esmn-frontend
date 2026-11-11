// D-17 — 가입 동의 글자 ↔ 판 · 해시(글자를 바꾸면 textVersion 과 textHash 를 함께 올린다)
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { SIGNUP_CONSENT, SIGNUP_CONSENT_LINES } from './signup-consent'

describe('SIGNUP_CONSENT', () => {
  it('textHash = SHA-256(LINES 줄바꿈 연결)', () => {
    const hex = createHash('sha256').update(SIGNUP_CONSENT_LINES.join('\n'), 'utf8').digest('hex')
    expect(SIGNUP_CONSENT.textHash).toBe(hex)
  })
  it('판 · 종류 고정', () => {
    expect(SIGNUP_CONSENT).toMatchObject({ kind: 'signup-terms', textVersion: 'signup-v1' })
  })
})
