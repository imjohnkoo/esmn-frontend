import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * 콘텐츠 게이트(client-shell spec D-17)는 `apps/client/**` 에서 자리표시자 이름 · 표기 상수 이름 · 표시 문구 앞부분을 «남은 확정 전 값» 으로 센다
 * (pending.ts · 테스트 · md 제외). 법정 문서를 그리는 코드가 그 글자를 쓰면 값을 다 채워도 게이트가 0 이 될 수 없다 —
 * 코드 파일에는 0 이어야 하고, 남는 곳은 생성물(app/content/legal/*.ts)의 실제 값 자리뿐이다.
 */
const GATE_WORDS = ['P9_4_PENDING', 'PENDING_LABEL', '(확정', '（확정']
const CODE = [
  './legal-markdown.ts',
  './legal-render.ts',
  '../components/legal/LegalMarkdown.vue',
  '../components/shell/SiteFooter.vue',
  '../pages/refund.vue',
  '../pages/checkout-preview.vue',
  './checkout-preview.ts',
  '../content/legal/checkout-notice.ts',
  './page-title.ts',
  '../content/legal/issue-notice.ts',
  '../pages/index.vue',
  '../pages/select-date/[orderId].vue',
  '../pages/supported-devices.vue',
  '../components/popup/ConfirmOrderModal.vue',
  '../pages/terms.vue',
  '../pages/privacy.vue',
  '../../scripts/legal-posting.ts',
  '../../scripts/legal-import.mjs',
]

describe('법정 문서 코드에 게이트가 세는 글자가 없다', () => {
  it.each(CODE)('%s', (file) => {
    const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
    for (const w of GATE_WORDS) expect(src.includes(w), w).toBe(false)
  })
})
