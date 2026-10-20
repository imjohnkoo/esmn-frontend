import { describe, expect, it } from 'vitest'
import type { Order } from '../types/order'
import {
  orderCapacity,
  orderDays,
  orderLabel,
  qrFileName,
  sortOrdersForDisplay,
} from './order-display'

const ORDER_ID = 2026102000000101

// 브리프 H-015 시나리오 — 같은 주문 · 같은 상품 이름 · 같은 용량에 일수만 7 / 8(문구는 plan-type V2 그대로)
const order = (over: Partial<Order> = {}): Order =>
  ({
    orderId: ORDER_ID,
    productOrderId: ORDER_ID + 1,
    planNameKr: '동유럽3개국',
    planDataTypeKr: '무제한 데이터',
    planDataLimitKr: '매일 2기가 + 무제한 500Kbps',
    planDataDuration: 7,
    quantity: 1,
    esims: [],
    ...over,
  }) as Order

const day7 = order({ productOrderId: ORDER_ID + 1, planDataDuration: 7 })
const day8 = order({ productOrderId: ORDER_ID + 2, planDataDuration: 8 })
const ids = (orders: readonly Order[]) => orders.map((o) => o.productOrderId)

describe('sortOrdersForDisplay — ② 카드 순서(화면에서만)', () => {
  it('일수 오름차순 — 응답이 8일권 먼저여도 7일권이 위', () => {
    expect(ids(sortOrdersForDisplay([day8, day7]))).toEqual([
      day7.productOrderId,
      day8.productOrderId,
    ])
  })

  it('같은 일수면 상품주문번호 오름차순', () => {
    const a = order({ productOrderId: ORDER_ID + 5, planDataDuration: 7 })
    const b = order({ productOrderId: ORDER_ID + 3, planDataDuration: 7 })
    expect(ids(sortOrdersForDisplay([a, day8, b]))).toEqual([
      ORDER_ID + 3,
      ORDER_ID + 5,
      day8.productOrderId,
    ])
  })

  it('입력 배열은 그대로 둔다(store 순서 = 응답 순서)', () => {
    const input = [day8, day7]
    sortOrdersForDisplay(input)
    expect(ids(input)).toEqual([day8.productOrderId, day7.productOrderId])
  })

  it('빈 목록', () => {
    expect(sortOrdersForDisplay([])).toEqual([])
  })
})

describe('orderDays · orderCapacity', () => {
  it('일수 «8일» — plan-type 이 없어 0 이면 빈 글자', () => {
    expect(orderDays(day8)).toBe('8일')
    expect(orderDays(order({ planDataDuration: 0 }))).toBe('')
  })

  it('용량 = 표시 문구의 « + » 앞부분(소진 뒤 속도 글자는 싣지 않는다) · 종량제는 그대로', () => {
    expect(orderCapacity(order())).toBe('매일 2기가')
    expect(orderCapacity(order({ planDataLimitKr: '10기가 종량제' }))).toBe('10기가 종량제')
    expect(orderCapacity(order({ planDataLimitKr: '' }))).toBe('')
  })
})

describe('orderLabel — ③ · ④ 상품 칩', () => {
  it('이름 · 일수 · 용량', () => {
    expect(orderLabel(day8)).toBe('동유럽3개국 · 8일 · 매일 2기가')
  })

  it('7일권 · 8일권이 다르게 보인다', () => {
    expect(orderLabel(day7)).not.toBe(orderLabel(day8))
  })

  it('같은 일수 · 다른 용량(매일 1기가 / 2기가)도 다르게 보인다', () => {
    const daily1 = order({ planDataLimitKr: '매일 1기가 + 무제한 500Kbps' })
    expect(orderLabel(daily1)).toBe('동유럽3개국 · 7일 · 매일 1기가')
    expect(orderLabel(daily1)).not.toBe(orderLabel(day7))
  })

  it('종량제', () => {
    expect(orderLabel(order({ planDataDuration: 30, planDataLimitKr: '10기가 종량제' }))).toBe(
      '동유럽3개국 · 30일 · 10기가 종량제',
    )
  })

  it('빈 조각은 빼고 잇는다(plan-type 이 없는 주문)', () => {
    expect(orderLabel(order({ planDataDuration: 0, planDataLimitKr: '' }))).toBe('동유럽3개국')
  })
})

describe('qrFileName — ④ QR 다운로드 파일 이름', () => {
  it('이심마니 + 칩 글자(띄어쓰기 없앰) + 상품주문번호 + eSIM 번호', () => {
    expect(qrFileName(day8, 0)).toBe(
      `이심마니_동유럽3개국_8일_매일2기가_${day8.productOrderId}_1.png`,
    )
  })

  it('7일권 · 8일권 파일 이름이 겹치지 않는다(지금은 둘 다 qr-code-1.png)', () => {
    expect(qrFileName(day7, 0)).not.toBe(qrFileName(day8, 0))
  })

  it('같은 옵션을 다른 상품주문으로 사도 겹치지 않는다', () => {
    const twin = order({ productOrderId: ORDER_ID + 9, planDataDuration: 7 })
    expect(qrFileName(twin, 0)).not.toBe(qrFileName(day7, 0))
  })

  it('수량 2개 — 끝 번호가 아코디언 «eSIM 1 · 2» 와 같다', () => {
    expect([qrFileName(day8, 0), qrFileName(day8, 1)]).toEqual([
      `이심마니_동유럽3개국_8일_매일2기가_${day8.productOrderId}_1.png`,
      `이심마니_동유럽3개국_8일_매일2기가_${day8.productOrderId}_2.png`,
    ])
  })

  it('파일 이름에 못 쓰는 글자는 «-» · 빈 조각은 뺀다', () => {
    const odd = order({
      planNameKr: '영국/프랑스 \\:*?"<>|',
      planDataDuration: 0,
      planDataLimitKr: '',
    })
    expect(qrFileName(odd, 0)).toBe(`이심마니_영국-프랑스--------_${odd.productOrderId}_1.png`)
  })
})
