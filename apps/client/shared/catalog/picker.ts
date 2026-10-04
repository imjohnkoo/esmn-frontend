/**
 * 상세 선택기 상태(catalog spec D-3 · D-16 · F-6) — 유심사 배치: 종류 탭 → 기간 드롭다운 → 용량 가격 카드.
 * 상태는 `{ kind, cap, days }` 하나. 화면은 이 함수들만 부른다(순수 · 테스트).
 */
import {
  capsOf,
  daysOf,
  defaultSelection,
  optionFor,
  optionLabel,
  perDayWon,
  perGbWon,
  productOf,
} from './derive'
import { formatWon } from './format'
import type { Kind, OptionView, ZoneView } from './types'

export interface Selection {
  kind: Kind
  cap: number
  days: number
}

export interface PlanCardData {
  cap: number
  option: OptionView
  /** 무제한 = 하루 약 N원, 종량제 = 1GB당 약 N원(D-2) */
  unitWon: number
  selected: boolean
}

export const initialSelection = defaultSelection

/** 종류를 바꾸면 그 종류의 기본값으로(무제한 7일 · 매일 1GB / 종량제 30일 · 가장 작은 용량) */
export function withKind(zone: ZoneView, sel: Selection, kind: Kind): Selection {
  if (kind === sel.kind || !productOf(zone, kind)) return sel
  const p = productOf(zone, kind)!
  if (kind === 'U') {
    const days = daysOf(p).includes(7) ? 7 : daysOf(p)[0]!
    return { kind, cap: Math.min(...capsOf(p)), days }
  }
  return { kind, cap: Math.min(...capsOf(p)), days: daysOf(p)[0]! }
}

/** 기간을 바꿔도 고른 용량은 유지 — 그 기간에 없는 용량이면 가장 작은 용량 */
export function withDays(zone: ZoneView, sel: Selection, days: number): Selection {
  if (!optionFor(zone, sel.kind, sel.cap, days)) {
    const caps = productOf(zone, sel.kind)!
      .options.filter((o) => o.days === days)
      .map((o) => o.cap)
    if (caps.length === 0) return sel
    return { ...sel, days, cap: Math.min(...caps) }
  }
  return { ...sel, days }
}

export function withCap(zone: ZoneView, sel: Selection, cap: number): Selection {
  return optionFor(zone, sel.kind, cap, sel.days) ? { ...sel, cap } : sel
}

/** 드롭다운 기간 목록 — 종량제는 한 칸(30일, 잠금) */
export function periodOptions(zone: ZoneView, kind: Kind): number[] {
  const p = productOf(zone, kind)
  return p ? daysOf(p) : []
}

/** 고른 기간의 용량 카드 — 큰 용량부터 */
export function planCards(zone: ZoneView, sel: Selection): PlanCardData[] {
  const p = productOf(zone, sel.kind)
  if (!p) return []
  return capsOf(p)
    .map((cap) => optionFor(zone, sel.kind, cap, sel.days))
    .filter((o): o is OptionView => !!o)
    .map((option) => ({
      cap: option.cap,
      option,
      unitWon: sel.kind === 'U' ? perDayWon(option) : perGbWon(option),
      selected: option.cap === sel.cap,
    }))
}

export function selectedOption(zone: ZoneView, sel: Selection): OptionView | undefined {
  return optionFor(zone, sel.kind, sel.cap, sel.days)
}

/** 요약 한 줄 «체코 · 매일 2GB · 7일» / «체코 · 총 10GB · 30일» */
export function selectionLabel(zone: ZoneView, sel: Selection): string {
  return `${zone.label} · ${sel.kind === 'U' ? '매일' : '총'} ${sel.cap}GB · ${sel.days}일`
}

export interface PurchaseSheetProps {
  summary: string
  /** 고른 옵션의 K1 최종가 «9,100원» */
  price: string
  /** 스토어 옵션명 두 칸 « · » */
  optionName: string
  naverUrl: string
}

/** 구매 시트에 넘길 값(S-5 · F-8) — 고른 옵션이 없으면 null(시트를 그리지 않는다) */
export function purchaseSheetProps(zone: ZoneView, sel: Selection): PurchaseSheetProps | null {
  const option = selectedOption(zone, sel)
  const product = zone.products.find((p) => p.kind === sel.kind)
  if (!option || !product) return null
  return {
    summary: selectionLabel(zone, sel),
    price: formatWon(option.finalWon),
    optionName: optionLabel(option),
    naverUrl: product.naverUrl,
  }
}
