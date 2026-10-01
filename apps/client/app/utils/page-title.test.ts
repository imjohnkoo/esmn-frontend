import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TERMS_DOC } from '../content/legal/terms'
import { PRIVACY_DOC } from '../content/legal/privacy'
import { REFUND_DOC } from '../content/legal/refund'
import { SITE_NAME, pageTitle } from './page-title'

describe('pageTitle — 브랜드는 한 번만', () => {
  it('보통 페이지는 «페이지 · 이심마니» · 제목 없음은 브랜드만', () => {
    expect(pageTitle('마이')).toBe('마이 · 이심마니')
    expect(pageTitle(REFUND_DOC.title)).toBe('취소·환불 정책 · 이심마니')
    expect(pageTitle()).toBe(SITE_NAME)
    expect(pageTitle('')).toBe(SITE_NAME)
  })
  it('정본 제목이 브랜드로 시작하면 그대로(약관 · 방침) · 가운데에 있을 뿐이면 붙인다', () => {
    expect(pageTitle(TERMS_DOC.title)).toBe('이심마니 서비스 이용약관')
    expect(pageTitle(PRIVACY_DOC.title)).toBe('이심마니 개인정보처리방침')
    expect(pageTitle('고객센터 이심마니 안내')).toBe('고객센터 이심마니 안내 · 이심마니')
  })
  it('app.vue 의 제목 템플릿이 이 함수다(배선)', () => {
    const app = readFileSync(fileURLToPath(new URL('../app.vue', import.meta.url)), 'utf8')
    expect(app).toContain("import { pageTitle } from '~/utils/page-title'")
    expect(app).toMatch(/\n {2}titleTemplate: \(title\?: string\) => pageTitle\(title\),\n/)
    expect(app.match(/titleTemplate/g)).toHaveLength(1)
  })
})
