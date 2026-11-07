/**
 * 결제 페이지 `/checkout-preview` 의 상품 값(shell D-13 · D-60 · F-19) — 표시 금액 = 판매가.
 * 고른 옵션 코드로 **서버 카탈로그**에서 찾는다(`server/api/v1/checkout-preview/item.get.ts` · confirm 라우트). 코드가 없으면
 * `PREVIEW_OPTION_CODE`(프랑스 무제한 매일 1GB · 7일 — 토스 심사 URL). 그 옵션이 카탈로그에 없으면 빌드가 멈춘다(`modules/catalog.ts`).
 * 옵션명은 K1 두 칸 그대로(« · »). 상품명에 «TEST» 금지 · 0원 금지 — 토스 심사 요건.
 */
import { optionLabel } from './derive'
import type { CatalogView, Kind, OptionView } from './types'

export const PREVIEW_OPTION_CODE = 'FRA00U01D07V2'

/**
 * 결제 주문번호 `pv-{ms}-{hex 24}`(createPaymentId) 규칙 — 토스 orderId(6~64자 · 영숫자 · `-` `_` `=`) 안.
 * 페이지 · 복귀 화면 · confirm 라우트가 같이 쓴다 — confirm 이 이 페이지가 만든 주문번호 꼴만 받게(같은 상점 키의 다른 결제 흐름 차단) 좁게 둔다
 */
export const PAYMENT_ID_PATTERN = /^pv-\d{1,16}-[0-9a-f]{24}$/

export const CHECKOUT_TEST_KEY_ROUTE = '/api/v1/checkout-preview/test-key'
export const CHECKOUT_ITEM_ROUTE = '/api/v1/checkout-preview/item'
/** 미들웨어가 받은 상품 값을 페이지로 넘기는 useState 키 */
export const CHECKOUT_ITEM_STATE = 'checkout-preview-item'

/** 토스 클라이언트 키가 테스트 키인가 — 빈 값 · `live_*` 는 아니다. test-key 라우트 · 진입 판정 · success 화면이 같이 쓴다(shell D-60) */
export function isTestClientKey(key: string): boolean {
  return key.startsWith('test_')
}

/** 고른 옵션의 결제 주소 — 금액은 싣지 않는다. 코드를 모르면(복귀 화면이 새 탭) 심사 품목 주소 */
export function checkoutUrl(optionCode?: string): string {
  return optionCode
    ? `/checkout-preview?option=${encodeURIComponent(optionCode)}`
    : '/checkout-preview'
}

export interface PreviewItem {
  productName: string
  optionName: string
  usage: string
  quantity: 1
  amount: number
  /** K1 옵션 코드 — 복귀 · confirm 이 이 코드로 금액을 다시 찾는다 */
  optionCode: string
  /** 토스 requestPayment orderName — 100자 이하 */
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
    optionCode: option.code,
    orderName: `${productName} · ${cap} · ${option.days}일`,
  }
}

export interface PreviewLookup {
  item: PreviewItem
  /** 상품 페이지로 돌려보낼 때 쓰는 zone */
  zone: string
}

/** 옵션 코드 → 상품 값 · zone. 카탈로그에 없으면 null */
export function previewLookup(catalog: CatalogView, code: string): PreviewLookup | null {
  for (const z of catalog.zones)
    for (const p of z.products) {
      const option = p.options.find((o) => o.code === code)
      if (option) return { item: previewItemFrom(z.label, p.kind, option), zone: z.zone }
    }
  return null
}

/**
 * 결제 페이지 진입 판정(shell D-60) — 돌려보낼 주소, 들어가도 되면 null. 모르는 코드는 홈.
 * 키가 test_ 가 아니면 그 상품 화면(구매 시트 · 스토어 동선)으로 — 발급이 없어 실청구가 나면 안 된다.
 * 빈 키 + 쿼리 없음만 예외다: 심사 URL 의 기존 «결제 설정을 준비하고 있어요» 화면.
 */
export function checkoutEntryRedirect(
  lookup: PreviewLookup | null,
  clientKey: string,
  hasOption: boolean,
): string | null {
  if (!lookup) return '/'
  if (isTestClientKey(clientKey) || (!clientKey && !hasOption)) return null
  return `/products/${lookup.zone.toLowerCase()}`
}

export function checkoutPreviewFromCatalog(
  catalog: CatalogView,
  code: string = PREVIEW_OPTION_CODE,
): PreviewItem {
  const lookup = previewLookup(catalog, code)
  if (lookup) return lookup.item
  throw new Error(
    `카탈로그에 심사용 옵션 ${code} 가 없다 — /checkout-preview 금액을 만들 수 없다(catalog F-12)`,
  )
}
