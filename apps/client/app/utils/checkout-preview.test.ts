import { describe, expect, it, vi } from 'vitest'
import {
  PREVIEW_OPTION_CODE,
  checkoutEntryRedirect,
  checkoutPreviewFromCatalog,
  checkoutUrl,
} from '#shared/catalog/preview'
import { ACTIVE_CATALOG_FILE, activeRaw, fixtureRaw, setFinalWon } from '#shared/catalog/test-data'
import { parseCatalog } from '#shared/catalog/validate'
import {
  PAYMENT_ID_PATTERN,
  BEFORE_NOTICE,
  CONSENT_ITEMS,
  PRIVACY_NOTICE,
  canPayWith,
  createPaymentId,
  formatWon,
  initialConsent,
  formatApprovedAt,
  judgeSuccessReturn,
  readFailReason,
  readSuccessReturn,
  splitConsent,
  useCheckoutConsent,
} from './checkout-preview'
import { CHECKOUT_NOTICE } from '../content/legal/checkout-notice'

describe('createPaymentId', () => {
  it('pv-{ms}-{hex24} · 토스 규칙(6~64자 · [A-Za-z0-9_-]) 안', () => {
    const id = createPaymentId(1790105212345, new Uint8Array(12).fill(171))
    expect(id).toBe('pv-1790105212345-abababababababababababab')
    expect(id).toMatch(PAYMENT_ID_PATTERN)
    expect(id.length).toBeLessThanOrEqual(64)
  })

  it('바이트가 달라지면 ID 가 달라진다', () => {
    const a = createPaymentId(1, new Uint8Array([0, 1, 2]))
    const b = createPaymentId(1, new Uint8Array([0, 1, 3]))
    expect(a).not.toBe(b)
    expect(a).toBe('pv-1-000102')
  })
})

const PREVIEW_ITEM = checkoutPreviewFromCatalog(parseCatalog(fixtureRaw()))
const PREVIEW_ORDER_NAME = PREVIEW_ITEM.orderName
const previewOption = (raw: ReturnType<typeof fixtureRaw>) =>
  raw.zones
    .flatMap((z: { products: { options: { code: string; finalWon: number }[] }[] }) => z.products)
    .flatMap((p: { options: { code: string; finalWon: number }[] }) => p.options)
    .find((o: { code: string }) => o.code === PREVIEW_OPTION_CODE)

describe('상품 값 (PG 심사 요건 · catalog F-12)', () => {
  it('K1 옵션 FRA00U01D07V2 에서 만든다 — 스냅샷 기준 4,900원 · 옵션명은 K1 두 칸 그대로', () => {
    expect(PREVIEW_ITEM).toEqual({
      productName: '프랑스 eSIM 무제한',
      optionName: '매일 1GB + 소진후 512kbps 무제한 · 7일',
      usage: '현지에서 처음 연결한 때부터 24시간 단위로 7일',
      quantity: 1,
      amount: 4900,
      optionCode: 'FRA00U01D07V2',
      orderName: '프랑스 eSIM 무제한 · 매일 1GB · 7일',
    })
  })

  it('금액 · 옵션명은 카탈로그를 따라간다(값이 바뀌면 표시도 바뀐다 — 코드에 금액을 박지 않는다)', () => {
    const raw = fixtureRaw()
    setFinalWon(raw, PREVIEW_OPTION_CODE, 5200)
    const o = previewOption(raw)
    o.optionName1 = '매일 1GB + 소진후 512kbps 무제한(개정)'
    const item = checkoutPreviewFromCatalog(parseCatalog(raw))
    expect(item.amount).toBe(5200)
    expect(item.optionName).toBe('매일 1GB + 소진후 512kbps 무제한(개정) · 7일')
  })

  it(`지금 빌드가 쓰는 카탈로그(${ACTIVE_CATALOG_FILE})에 심사용 옵션이 있고 금액이 원본과 같다`, () => {
    const raw = activeRaw()
    expect(checkoutPreviewFromCatalog(parseCatalog(raw)).amount).toBe(previewOption(raw).finalWon)
  })

  it('종량제 옵션이면 «종량제» 상품명 · «총 NGB» 주문명 · 옵션명은 K1 두 칸', () => {
    const raw = fixtureRaw()
    const item = checkoutPreviewFromCatalog(parseCatalog(raw), 'CZE00L10D30V2')
    const o = raw.zones
      .flatMap((z: { products: { options: { code: string }[] }[] }) => z.products)
      .flatMap((p: { options: { code: string }[] }) => p.options)
      .find((x: { code: string }) => x.code === 'CZE00L10D30V2')
    expect(item).toMatchObject({
      productName: '체코 eSIM 종량제',
      orderName: '체코 eSIM 종량제 · 총 10GB · 30일',
      optionName: `${o.optionName1} · ${o.optionName2}`,
      usage: '현지에서 처음 연결한 때부터 24시간 단위로 30일',
      amount: o.finalWon,
    })
  })

  it('카탈로그에 심사용 옵션이 없으면 throw — 빌드가 멈춘다(가짜 금액으로 대신하지 않는다)', () => {
    expect(() => checkoutPreviewFromCatalog(parseCatalog(fixtureRaw()), 'XXX00U01D07V2')).toThrow(
      /심사용 옵션 XXX00U01D07V2 가 없다/,
    )
  })

  it('상품명에 TEST 가 없고 금액은 양수 · 주문명 100자 이하', () => {
    expect(`${PREVIEW_ITEM.productName} ${PREVIEW_ORDER_NAME}`.toUpperCase()).not.toContain('TEST')
    expect(PREVIEW_ITEM.amount).toBeGreaterThan(0)
    expect(PREVIEW_ORDER_NAME.length).toBeLessThanOrEqual(100)
  })

  it('사용 기간 카피는 «첫 연결부터 24시간 단위» (eSIM 카피 불변식)', () => {
    expect(PREVIEW_ITEM.usage).toContain('처음 연결한 때부터 24시간 단위')
    expect(PREVIEW_ITEM.usage).not.toContain('자정')
  })

  it('원 표기', () => {
    expect(formatWon(4900)).toBe('4,900원')
  })
})

const MINE = 'pv-1790105212345-abababababababababababab'

describe('readSuccessReturn — success 복귀 쿼리(spec F-19 · D-59)', () => {
  const q = (over: Record<string, unknown> = {}) => ({
    paymentKey: 'tgen_key',
    orderId: MINE,
    amount: '4900',
    ...over,
  })
  it('세 값이 형식에 맞으면 금액은 숫자로', () => {
    expect(readSuccessReturn(q())).toEqual({ paymentKey: 'tgen_key', orderId: MINE, amount: 4900 })
  })
  it('배열 쿼리는 첫 값만', () => {
    expect(readSuccessReturn(q({ orderId: [MINE, 'pv-2-00'] }))?.orderId).toBe(MINE)
  })
  it.each([
    ['paymentKey 없음', { paymentKey: undefined }],
    ['paymentKey 200자 초과', { paymentKey: 'k'.repeat(201) }],
    ['orderId 규칙 밖', { orderId: 'pv 1<b>' }],
    ['orderId 너무 짧음', { orderId: 'pv-1' }],
  ])('%s → null', (_n, over) => {
    expect(readSuccessReturn(q(over))).toBeNull()
  })
  it.each([
    ['amount 없음', { amount: undefined }],
    ['amount 숫자 아님', { amount: '4900원' }],
    ['amount 음수', { amount: '-4900' }],
    ['amount 소수', { amount: '4900.5' }],
  ])('%s → 금액 NaN(판정이 «금액 다름» 으로 — spec F-19 Number(amount) 대조)', (_n, over) => {
    const ret = readSuccessReturn(q(over))
    expect(ret?.amount).toBeNaN()
    expect(judgeSuccessReturn(ret, MINE, 4900)).toBe('amount')
  })
})

describe('judgeSuccessReturn — confirm 을 부를지(spec F-19)', () => {
  const ret = { paymentKey: 'k', orderId: MINE, amount: 4900 }
  it('이 탭이 만든 주문번호 ∧ 금액 일치 → confirm', () => {
    expect(judgeSuccessReturn(ret, MINE, 4900)).toBe('confirm')
  })
  it('주문번호가 다르거나 · 이 탭에 없거나 · 쿼리가 형식 밖이면 foreign(금액보다 먼저)', () => {
    expect(judgeSuccessReturn(ret, 'pv-2-000000', 4900)).toBe('foreign')
    expect(judgeSuccessReturn(ret, null, 4900)).toBe('foreign')
    expect(judgeSuccessReturn(null, MINE, 4900)).toBe('foreign')
    expect(judgeSuccessReturn({ ...ret, amount: 1 }, null, 4900)).toBe('foreign')
  })
  it('금액이 다르면 amount', () => {
    expect(judgeSuccessReturn({ ...ret, amount: 4800 }, MINE, 4900)).toBe('amount')
  })
})

describe('readFailReason — fail 복귀 · confirm 오류 사유', () => {
  it('message · code 80자까지 · message 가 없으면 한국어 대체 문장(영문 코드가 첫 줄이 되지 않게) · code 가 없으면 UNKNOWN', () => {
    expect(readFailReason({ code: 'C', message: '사유' }, '대체')).toEqual({
      code: 'C',
      message: '사유',
    })
    expect(readFailReason({ code: 'C' }, '대체')).toEqual({ code: 'C', message: '대체' })
    expect(readFailReason({}, '대체')).toEqual({ code: 'UNKNOWN', message: '대체' })
    expect(readFailReason({ code: 'C', message: '가'.repeat(200) }, '대체').message).toBe(
      '가'.repeat(80),
    )
    expect(readFailReason({ code: 'X'.repeat(200) }, '대체').code).toBe('X'.repeat(80))
  })
})

describe('formatApprovedAt — 승인 시각은 Asia/Seoul', () => {
  it('ISO → 한국 시각 · 읽을 수 없으면 그대로', () => {
    expect(formatApprovedAt('2026-11-04T07:05:00Z')).toBe('2026. 11. 04 16:05')
    expect(formatApprovedAt('2026-12-31T15:30:00Z')).toBe('2027. 01. 01 00:30')
    expect(formatApprovedAt('not-a-date')).toBe('not-a-date')
  })
})

describe('splitConsent — 05-B 동의 · 안내 문구에서 링크 떼기(F-22)', () => {
  it('라벨은 글자만 · 링크는 차례대로', () => {
    expect(splitConsent('(필수) 이용약관에 동의합니다 [보기](/terms)')).toEqual({
      label: '(필수) 이용약관에 동의합니다',
      links: [{ text: '보기', href: '/terms' }],
    })
    expect(splitConsent('(필수) 만 14세 이상입니다')).toEqual({
      label: '(필수) 만 14세 이상입니다',
      links: [],
    })
  })
})

describe('05-B 동의 모델(F-22) — 화면이 그리는 것은 이것뿐', () => {
  it('항목 3 — 순서 · 문구(정본 05 B절 그대로) · 필수 2 + 선택 1 · 링크 · 알릴 사항', () => {
    expect(CONSENT_ITEMS.map((i) => [i.key, i.required, i.label])).toEqual([
      ['terms', true, '(필수) 이용약관에 동의합니다'],
      ['age', true, '(필수) 만 14세 이상입니다'],
      ['marketing', false, '(선택) 혜택·이벤트 알림 수신 (카카오톡·이메일)'],
    ])
    expect(CONSENT_ITEMS.map((i) => i.links)).toEqual([[{ text: '보기', href: '/terms' }], [], []])
    expect(CONSENT_ITEMS.map((i) => i.info)).toEqual([
      null,
      null,
      '수집 항목: 이메일 주소, 휴대전화번호 · 목적: 신상품·혜택 안내 · 보유: 동의 철회 시까지 · 동의하지 않아도 구매할 수 있습니다',
    ])
  })

  it('처음 값은 모두 해제(PG 심사 요건) · 부를 때마다 새 객체 · 저장소 · 쿠키를 읽지 않는다(값이 있어도)', () => {
    expect(initialConsent()).toEqual({ terms: false, age: false, marketing: false })
    const stored = { getItem: () => 'true', key: () => 'terms', length: 3 }
    vi.stubGlobal('sessionStorage', stored)
    vi.stubGlobal('localStorage', stored)
    vi.stubGlobal('document', { cookie: 'terms=true; age=true; marketing=true' })
    try {
      expect(initialConsent()).toEqual({ terms: false, age: false, marketing: false })
    } finally {
      vi.unstubAllGlobals()
    }
    const a = initialConsent()
    a.terms = true
    expect(initialConsent().terms).toBe(false)
  })

  it('useCheckoutConsent — 처음엔 결제 불가 · 필수 2개를 체크해야 켜지고 · 선택은 무관 · 하나라도 풀면 다시 꺼진다 · 부를 때마다 새 상태', () => {
    const c = useCheckoutConsent()
    expect(c.items).toBe(CONSENT_ITEMS)
    expect({ ...c.agreed }).toEqual({ terms: false, age: false, marketing: false })
    expect(c.canPay.value).toBe(false)
    c.agreed.marketing = true
    expect(c.canPay.value).toBe(false)
    c.agreed.terms = true
    expect(c.canPay.value).toBe(false)
    c.agreed.age = true
    expect(c.canPay.value).toBe(true)
    c.agreed.marketing = false
    expect(c.canPay.value).toBe(true)
    c.agreed.terms = false
    expect(c.canPay.value).toBe(false)
    const fresh = useCheckoutConsent()
    expect({ ...fresh.agreed }).toEqual({ terms: false, age: false, marketing: false })
    expect(fresh.canPay.value).toBe(false)
  })

  it('개인정보 안내 · 결제 전 안내도 얼어 있다 — 실행 중에 문구 · 링크 · 줄을 바꿀 수 없다', () => {
    expect([
      Object.isFrozen(PRIVACY_NOTICE),
      Object.isFrozen(PRIVACY_NOTICE.links),
      ...PRIVACY_NOTICE.links.map(Object.isFrozen),
    ]).toEqual([true, true, true])
    expect([Object.isFrozen(BEFORE_NOTICE), Object.isFrozen(BEFORE_NOTICE.lines)]).toEqual([
      true,
      true,
    ])
    expect(() => {
      ;(BEFORE_NOTICE.lines as unknown as string[]).length = 1
    }).toThrow(TypeError)
    expect(BEFORE_NOTICE.lines).toHaveLength(3)
  })

  it('항목은 얼어 있다 — 실행 중에 필수 여부 · 문구 · 링크를 바꿀 수 없다', () => {
    expect(Object.isFrozen(CONSENT_ITEMS)).toBe(true)
    for (const item of CONSENT_ITEMS) {
      expect(Object.isFrozen(item)).toBe(true)
      expect(Object.isFrozen(item.links)).toBe(true)
      for (const link of item.links) expect(Object.isFrozen(link)).toBe(true)
    }
    expect(() => {
      ;(CONSENT_ITEMS[0] as { required: boolean }).required = false
    }).toThrow(TypeError)
    expect(CONSENT_ITEMS[0]!.required).toBe(true)
  })

  it('결제 조건 = 필수 2개 모두 · 선택은 무관(8가지 전부)', () => {
    for (const terms of [false, true])
      for (const age of [false, true])
        for (const marketing of [false, true])
          expect(
            canPayWith({ terms, age, marketing }),
            JSON.stringify({ terms, age, marketing }),
          ).toBe(terms && age)
  })

  it('개인정보 «안내»(체크 없음) · 결제 전 안내 3줄', () => {
    expect(PRIVACY_NOTICE).toEqual({
      label: '개인정보 수집·이용 안내',
      links: [{ text: '개인정보처리방침 보기', href: '/privacy' }],
      info: CHECKOUT_NOTICE.privacyInfo,
    })
    expect(BEFORE_NOTICE.title).toBe('결제 전 안내')
    expect(BEFORE_NOTICE.lines).toEqual([
      CHECKOUT_NOTICE.beforeRefund,
      CHECKOUT_NOTICE.beforeMinor,
      CHECKOUT_NOTICE.beforeNotify,
    ])
  })

  // 정본 → 생성물: 가져오기가 05 B절 코드 블록 줄을 전부 고르거나(pick) 해시로 건너뛴다(skip) — 줄이 늘면 가져오기가 멈춘다.
  // 생성물 → 모델: 이 테스트 — 생성물에 키가 늘면 여기서 막힌다
  it('05-B 생성물의 줄은 하나도 빠짐없이 모델에 있다', () => {
    const shown = new Set<string>([
      ...CONSENT_ITEMS.flatMap((i) => [i.label, i.info ?? '']),
      PRIVACY_NOTICE.label,
      PRIVACY_NOTICE.info,
      BEFORE_NOTICE.title,
      ...BEFORE_NOTICE.lines,
    ])
    for (const [key, line] of Object.entries(CHECKOUT_NOTICE))
      expect(shown.has(line) || shown.has(splitConsent(line).label), key).toBe(true)
  })
})

describe('결제 주소 · 진입 판정 (shell D-60)', () => {
  const LOOKUP = { item: PREVIEW_ITEM, zone: 'FRA00' }

  it('checkoutUrl — 코드가 있으면 쿼리 · 없으면 심사 품목 주소 · 금액은 싣지 않는다', () => {
    expect(checkoutUrl('CZE00U02D07V2')).toBe('/checkout-preview?option=CZE00U02D07V2')
    expect(checkoutUrl()).toBe('/checkout-preview')
  })

  it.each([
    ['test_gck_x', true, null],
    ['test_gck_x', false, null],
    ['', false, null],
    ['', true, '/products/fra00'],
    ['live_gck_x', true, '/products/fra00'],
    ['live_gck_x', false, '/products/fra00'],
  ])('키 %j · 쿼리 %s → %s', (key, hasOption, target) => {
    expect(checkoutEntryRedirect(LOOKUP, key, hasOption)).toBe(target)
  })

  it('모르는 코드는 키와 상관없이 홈', () => {
    expect(checkoutEntryRedirect(null, 'test_gck_x', true)).toBe('/')
  })
})
