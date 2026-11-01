// @vitest-environment happy-dom
// 발급 동의 판 · 해시(client-consent-log spec I-4 · D-2) — 고객이 본 글자를 해시한 값이 상수와 같아야 한다.
// 이 테스트가 깨지면 글자가 바뀐 것이다: ISSUE_CONSENT.textVersion 과 textHash 를 함께 올린다(상수만 고치지 않는다).
import { createHash } from 'node:crypto'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ISSUE_CONSENT } from '#shared/consent/issue-consent'
import IssueConsentLabel from './IssueConsentLabel.vue'

const normalize = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim()

describe('IssueConsentLabel 글자 해시', () => {
  it('렌더한 글자(정규화) 의 SHA-256 = ISSUE_CONSENT.textHash', () => {
    const shown = normalize(mount(IssueConsentLabel).element.textContent ?? '')
    expect(shown).toBe(
      '(필수) 이용약관과 취소·환불 정책을 확인했으며 QR 발급 후 환불 시 환불 비용이 발생하는 것에 동의합니다.',
    )
    expect(createHash('sha256').update(shown, 'utf8').digest('hex')).toBe(ISSUE_CONSENT.textHash)
  })

  it('판 이름은 consent_log.text_version(VARCHAR 32) 안', () => {
    expect(ISSUE_CONSENT.textVersion.length).toBeLessThanOrEqual(32)
    expect(ISSUE_CONSENT.textHash).toMatch(/^[0-9a-f]{64}$/)
  })
})
