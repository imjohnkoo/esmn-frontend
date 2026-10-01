import { describe, expect, it, vi } from 'vitest'
import {
  PAYMENT_ID_PATTERN,
  PREVIEW_ITEM,
  PREVIEW_ORDER_NAME,
  BEFORE_NOTICE,
  CONSENT_ITEMS,
  PRIVACY_NOTICE,
  buildReturnQuery,
  canPayWith,
  createPaymentId,
  formatWon,
  initialConsent,
  readPaymentResult,
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

describe('상품 값 (PG 심사 요건)', () => {
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

describe('readPaymentResult', () => {
  const MINE = 'pv-1790105212345-abababababababababababab'

  it('쿼리가 없거나 이 탭의 결제 ID 가 없으면 none', () => {
    expect(readPaymentResult({}, MINE)).toEqual({ status: 'none' })
    expect(readPaymentResult({ paymentId: MINE }, null)).toEqual({ status: 'none' })
  })

  it('링크로 만든 임의 쿼리는 그리지 않는다 — ID 불일치 · 형식 밖 (반사 텍스트 차단)', () => {
    expect(
      readPaymentResult(
        { paymentId: '입금확인요망', code: 'X', message: '010-0000-0000 으로 연락' },
        MINE,
      ),
    ).toEqual({ status: 'none' })
    expect(readPaymentResult({ paymentId: 'pv-1-00', code: 'X', message: '가짜' }, MINE)).toEqual({
      status: 'none',
    })
  })

  it('형식 밖 ID 는 이 탭의 값과 같아도 그리지 않는다 (형식 검사 단독)', () => {
    for (const bad of ['pv 1', 'pv-1-<b>', 'x'.repeat(65), 'abc']) {
      expect(readPaymentResult({ paymentId: bad }, bad)).toEqual({ status: 'none' })
    }
  })

  it('이 탭의 ID + code 없음 → success', () => {
    expect(readPaymentResult({ paymentId: MINE }, MINE)).toEqual({
      status: 'success',
      paymentId: MINE,
    })
  })

  it('이 탭의 ID + code → failed · message 우선 → pgMessage → code · 80자 상한', () => {
    expect(
      readPaymentResult(
        { paymentId: MINE, code: 'FAILURE_TYPE_PG', message: '사용자가 결제를 취소했습니다' },
        MINE,
      ),
    ).toEqual({ status: 'failed', paymentId: MINE, message: '사용자가 결제를 취소했습니다' })
    expect(
      readPaymentResult({ paymentId: MINE, code: 'X', pgMessage: 'PG 사유' }, MINE),
    ).toMatchObject({
      message: 'PG 사유',
    })
    expect(readPaymentResult({ paymentId: MINE, code: 'X' }, MINE)).toMatchObject({ message: 'X' })
    const long = readPaymentResult({ paymentId: MINE, code: 'X', message: '가'.repeat(200) }, MINE)
    expect(long.status === 'failed' ? long.message.length : -1).toBe(80)
  })

  it('배열 쿼리는 첫 값', () => {
    expect(readPaymentResult({ paymentId: [MINE, 'pv-2-00'] }, MINE)).toEqual({
      status: 'success',
      paymentId: MINE,
    })
  })
})

describe('buildReturnQuery (창 없이 끝난 응답 — spec F-19)', () => {
  const LOCAL = 'pv-1790105212345-abababababababababababab'

  it('5필드를 그대로 싣는다', () => {
    expect(
      buildReturnQuery(
        { paymentId: LOCAL, code: 'C', message: 'M', pgCode: 'PC', pgMessage: 'PM' },
        LOCAL,
      ),
    ).toEqual({ paymentId: LOCAL, code: 'C', message: 'M', pgCode: 'PC', pgMessage: 'PM' })
  })

  it('응답에 결제 ID 가 없거나 비면 이 탭의 ID — 결과 줄이 사라지지 않는다', () => {
    expect(buildReturnQuery({ code: 'C' }, LOCAL).paymentId).toBe(LOCAL)
    expect(buildReturnQuery({ paymentId: '', code: 'C' }, LOCAL).paymentId).toBe(LOCAL)
  })

  it('readPaymentResult 와 이어진다 — 창 전 오류는 실패 줄 · pgMessage 대체', () => {
    const query = buildReturnQuery({ code: 'FAILURE', pgMessage: 'PG 사유' }, LOCAL)
    expect(readPaymentResult(query, LOCAL)).toEqual({
      status: 'failed',
      paymentId: LOCAL,
      message: 'PG 사유',
    })
  })
})

describe('splitConsent — 05-B 동의 · 안내 문구에서 링크 떼기(F-22)', () => {
  it('라벨은 글자만 · 링크는 차례대로', () => {
    expect(splitConsent('(필수) 이용약관에 동의합니다 [보기](/terms)')).toEqual({
      label: '(필수) 이용약관에 동의합니다',
      links: [{ text: '보기', href: '/terms' }],
    })
    expect(splitConsent('(필수) 만 14세 이상입니다')).toEqual({ label: '(필수) 만 14세 이상입니다', links: [] })
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
    expect([Object.isFrozen(PRIVACY_NOTICE), Object.isFrozen(PRIVACY_NOTICE.links), ...PRIVACY_NOTICE.links.map(Object.isFrozen)]).toEqual([true, true, true])
    expect([Object.isFrozen(BEFORE_NOTICE), Object.isFrozen(BEFORE_NOTICE.lines)]).toEqual([true, true])
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
          expect(canPayWith({ terms, age, marketing }), JSON.stringify({ terms, age, marketing })).toBe(terms && age)
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

