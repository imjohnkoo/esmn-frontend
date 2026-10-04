/**
 * 테스트 체크아웃 `/checkout-preview` 의 상품 값(shell D-13 · F-19 · catalog F-12) — PG 심사는 «표시 금액 = 라이브 판매가» 를 본다.
 * K1 의 `PREVIEW_OPTION_CODE` 옵션(프랑스 무제한 매일 1GB · 7일)에서 **빌드 때** 계산해 앱 설정으로 주입한다
 * (`modules/catalog.ts` — 페이지는 서버를 부르지 않는다 · 링크 0 · noindex 불변식 유지).
 * 옵션명은 K1 두 칸 그대로(« · »). 카탈로그에 그 옵션이 없으면 throw — 빌드가 멈춘다(가짜 금액으로 대신하지 않는다).
 * 상품명에 «TEST» 금지 · 0원 금지 — PortOne / 토스 심사 요건.
 */
import { optionLabel } from './derive'
import type { CatalogView, Kind, OptionView } from './types'

export const PREVIEW_OPTION_CODE = 'FRA00U01D07V2'

export interface PreviewItem {
  productName: string
  optionName: string
  usage: string
  quantity: 1
  amount: number
  /** PortOne orderName — 100자 이하 */
  orderName: string
}

export function previewItemFrom(zoneLabel: string, kind: Kind, option: OptionView): PreviewItem {
  const productName = `${zoneLabel} eSIM ${kind === 'U' ? '무제한' : '종량제'}`
  const cap = kind === 'U' ? `매일 ${option.cap}GB` : `총 ${option.cap}GB`
  return {
    productName,
    optionName: optionLabel(option),
    usage: `현지에서 처음 연결한 때부터 24시간 단위로 ${option.days}일`,
    quantity: 1,
    amount: option.finalWon,
    orderName: `${productName} · ${cap} · ${option.days}일`,
  }
}

export function checkoutPreviewFromCatalog(
  catalog: CatalogView,
  code: string = PREVIEW_OPTION_CODE,
): PreviewItem {
  for (const z of catalog.zones)
    for (const p of z.products) {
      const option = p.options.find((o) => o.code === code)
      if (option) return previewItemFrom(z.label, p.kind, option)
    }
  throw new Error(
    `카탈로그에 심사용 옵션 ${code} 가 없다 — /checkout-preview 금액을 만들 수 없다(catalog F-12)`,
  )
}
