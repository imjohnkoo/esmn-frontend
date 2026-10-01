import { describe, expect, it } from 'vitest'
import {
  PAYMENT_ID_PATTERN,
  PREVIEW_ITEM,
  PREVIEW_ORDER_NAME,
  buildReturnQuery,
  createPaymentId,
  formatWon,
  readPaymentResult,
  splitConsent,
} from './checkout-preview'

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
