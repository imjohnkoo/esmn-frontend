/**
 * 고객센터 채널(client-shell spec S-3 · F-12) — 마이(/my#cs) · 검색 화면이 읽는다.
 * 값은 legal-pages 정본 그대로 — support.test.ts 가 생성물(content/legal/business · refund · privacy) 글자와 대조한다(정본 밖 값 0).
 * 순서는 04 3절 권장 배치(카카오톡 채널 → 전화 → 이메일 → 네이버 톡톡) + 운영 시간.
 * 카카오톡 채널 URL 만 확정 전(spec D-29③): 링크 없이 채널명만 보인다.
 */
import { P9_4_PENDING, displayValue, isPending, type ContentValue } from './pending'

export const SMARTSTORE_URL = 'https://smartstore.naver.com/esimmany'
export const SUPPORT_PHONE = '070-8064-5232'
export const SUPPORT_EMAIL = 'esimmany@naver.com'
export const SUPPORT_HOURS = '평일 09:00–18:00, 주말·공휴일 휴무'
export const SUPPORT_KAKAO = '@이심마니'

export interface SupportChannel {
  key: 'kakao' | 'naver' | 'phone' | 'email' | 'hours'
  label: string
  value: ContentValue
  /** 링크 — 확정 전이거나 없으면 글자만 보인다 */
  href?: ContentValue
}

export const SUPPORT_CHANNELS: readonly SupportChannel[] = [
  { key: 'kakao', label: '카카오톡 채널', value: SUPPORT_KAKAO, href: P9_4_PENDING },
  { key: 'phone', label: '전화', value: SUPPORT_PHONE, href: `tel:${SUPPORT_PHONE}` },
  { key: 'email', label: '이메일', value: SUPPORT_EMAIL },
  { key: 'naver', label: '네이버 톡톡', value: '스마트스토어 채팅 문의', href: SMARTSTORE_URL },
  { key: 'hours', label: '운영 시간', value: SUPPORT_HOURS },
]

export interface SupportRow {
  key: SupportChannel['key']
  label: string
  text: string
  href: string | null
}

/** 화면용 — 확정 전 값은 대기 표시 문구로(pending.ts displayValue), 링크는 확정된 것만 */
export function supportRows(channels: readonly SupportChannel[] = SUPPORT_CHANNELS): SupportRow[] {
  return channels.map((channel) => {
    const linkable = !isPending(channel.value) && channel.href && !isPending(channel.href)
    const mail = channel.key === 'email' && !isPending(channel.value) ? `mailto:${channel.value}` : null
    return {
      key: channel.key,
      label: channel.label,
      text: displayValue(channel.value),
      href: linkable ? (channel.href as string) : mail,
    }
  })
}
