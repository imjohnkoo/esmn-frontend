import { describe, expect, it } from 'vitest'
import { BUSINESS_INFO } from './legal/business'
import { PRIVACY_DOC } from './legal/privacy'
import { REFUND_DOC } from './legal/refund'
import { P9_4_PENDING, PENDING_LABEL, displayValue, isPending } from './pending'
import {
  SMARTSTORE_URL,
  SUPPORT_CHANNELS,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  SUPPORT_KAKAO,
  SUPPORT_PHONE,
  supportRows,
  type SupportChannel,
  SUPPORT_KAKAO_URL,
} from './support'

/** client-shell spec S-3 · F-12 — 고객센터 채널. 값은 정본 생성물(04 1절 푸터 · 03 환불 · 02 방침)에 글자 그대로 있어야 한다 — 04 2절(`/business`)은 D-39 로 게시하지 않는다 */
describe('pending', () => {
  it('자리표시자는 «(확정 전)» 으로 보이고 확정값은 그대로', () => {
    expect(isPending(P9_4_PENDING)).toBe(true)
    expect(displayValue(P9_4_PENDING)).toBe(PENDING_LABEL)
    expect(displayValue('070-8064-5232')).toBe('070-8064-5232')
  })
})

describe('고객센터 값 = 정본(04) — 손으로 적은 값이 정본 밖으로 나가지 않는다', () => {
  const footer = Object.values(BUSINESS_INFO).join('\n')
  it.each([
    ['전화', SUPPORT_PHONE],
    ['이메일', SUPPORT_EMAIL],
    ['운영 시간', SUPPORT_HOURS],
  ])('%s — 04 1절 푸터 줄에 그대로(값 전체 — 잘리거나 빈 값이면 실패)', (_, value) => {
    expect(value.trim().length).toBeGreaterThan(5)
    expect(footer).toMatch(new RegExp(`(?:^|[\\s:(])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[\\s)|])`, 'm'))
  })
  it('카카오톡 채널명 — 03 환불 정책의 고객센터 안내에 그대로 · 네이버 톡톡 — 02 방침의 상담 경로에 그대로 · 채널 URL = D-54 결정 글자', () => {
    expect(SUPPORT_KAKAO).toMatch(/^@\S{2,}$/)
    expect(REFUND_DOC.markdown).toContain(`고객센터(카카오톡 채널 ${SUPPORT_KAKAO})`) // 3항 — 전화번호는 뺐다(D-41)
    expect(PRIVACY_DOC.markdown).toContain('고객센터(전화·카카오톡 채널·네이버 톡톡·전자우편)')
    expect(SUPPORT_CHANNELS.find((c) => c.key === 'naver')?.label).toBe('네이버 톡톡')
    expect(SMARTSTORE_URL).toBe('https://smartstore.naver.com/esimmany')
    expect(SUPPORT_KAKAO_URL).toBe('http://pf.kakao.com/_TjTCG') // 정본 밖 값 — John 결정(D-54 · 정본 rev 요청)
    expect(SUPPORT_CHANNELS.find((c) => c.key === 'kakao')?.href).toBe(SUPPORT_KAKAO_URL)
  })
})

describe('supportRows', () => {
  it('카카오톡 채널은 채널 URL 로 · 네이버 톡톡은 스토어로 · 전화는 tel 링크 · 이메일은 mailto · 운영 시간은 글자만', () => {
    const rows = Object.fromEntries(supportRows().map((row) => [row.key, row]))
    expect(rows.kakao).toMatchObject({ text: '@이심마니', href: 'http://pf.kakao.com/_TjTCG' })
    expect(rows.naver?.href).toBe(SMARTSTORE_URL)
    expect(rows.phone).toMatchObject({ text: '070-8064-5232', href: 'tel:070-8064-5232' })
    expect(rows.email).toMatchObject({ text: 'esimmany@naver.com', href: 'mailto:esimmany@naver.com' })
    expect(rows.hours).toMatchObject({ text: '평일 09:00–18:00, 주말·공휴일 휴무', href: null })
  })

  it('값 · 링크가 확정 전이면 글자만 (링크 없음)', () => {
    const channels: SupportChannel[] = [
      { key: 'kakao', label: '카카오톡 채널', value: '@이심마니', href: P9_4_PENDING },
      { key: 'email', label: '이메일', value: P9_4_PENDING },
      { key: 'hours', label: '운영 시간', value: P9_4_PENDING },
    ]
    const [kakao, email, hours] = supportRows(channels)
    expect(kakao).toMatchObject({ text: '@이심마니', href: null })
    expect(email).toMatchObject({ text: PENDING_LABEL, href: null })
    expect(hours).toMatchObject({ text: PENDING_LABEL, href: null })
  })

  it('확정되면 링크 — 이메일은 mailto', () => {
    const [kakao, email] = supportRows([
      { key: 'kakao', label: '카카오톡 채널', value: '@이심마니', href: 'https://pf.kakao.com/_x' },
      { key: 'email', label: '이메일', value: 'help@example.com' },
    ])
    expect(kakao?.href).toBe('https://pf.kakao.com/_x')
    expect(email?.href).toBe('mailto:help@example.com')
  })

  it('채널 5종 · 순서 = 04 3절 권장 배치(카카오톡 → 전화 → 이메일 → 네이버 톡톡) + 운영 시간', () => {
    expect(SUPPORT_CHANNELS.map((channel) => channel.key)).toEqual([
      'kakao',
      'phone',
      'email',
      'naver',
      'hours',
    ])
  })

  it('고객센터 번호는 휴대폰이 아니다 (PG 심사 — 유선전화 요건)', () => {
    expect(SUPPORT_PHONE).not.toMatch(/^01[016789]/)
  })
})
