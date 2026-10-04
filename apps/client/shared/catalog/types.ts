/**
 * 카탈로그 화면 모델 — K1(catalog.json) 필드명과 분리한다(spec F-1 · plan §2.1).
 *
 * K1 필드명은 W1-1 export(H-002 README)가 정한다. 이름이 바뀌어도 고칠 곳은 `adapter.ts` 한 곳이다.
 * 판매가 · 즉시할인은 화면 모델에 넣지 않는다 — 화면에는 최종가만 낸다(spec 불변식 2 · D-2).
 */

export type Kind = 'U' | 'L'

export interface OptionView {
  id: number
  code: string
  /** GB — 무제한은 하루 용량, 종량제는 총 용량 */
  cap: number
  days: number
  /** 스토어 옵션명 첫 칸(«매일 2GB + 소진후 512kbps 무제한») */
  name1: string
  /** 스토어 옵션명 둘째 칸(«7일») */
  name2: string
  finalWon: number
}

export interface ProductView {
  sku: string
  kind: Kind
  channelProductNo: number
  /** K2 이동 링크 — K1 값 그대로(옵션 사전선택 파라미터 없음) */
  naverUrl: string
  /** 논리 경로(`/catalog/thumbs/{SKU}.webp`) — 실제 파일은 자산 매니페스트로 푼다(D-14) */
  thumb: string
  /** cap · days 오름차순 */
  options: OptionView[]
}

export interface CountryView {
  iso3: string
  iso2: string
  nameKr: string
  /** 첫 도시 = 대표 */
  cities: string[]
  /** 미확정이면 null(K1 이 null 로 명시한다 — 키가 없으면 검증 실패) */
  operators: string[] | null
  /** «4G/LTE · 5G» — 미확정이면 null */
  network: string | null
}

export interface PinView {
  name: string
  /** 지도 폭 대비 % */
  x: number
  /** 지도 높이 대비 % */
  y: number
  big: boolean
  /** 라벨을 점 왼쪽에 둔다 */
  labelLeft: boolean
  /** 라벨을 점보다 한 줄 아래 · 위로 — 이웃 핀과 겹침 보정(2609 labelStyle). 없으면 null */
  labelShift: 'up' | 'down' | null
}

export interface ZoneView {
  zone: string
  /** «체코» · «동유럽 3개국» */
  label: string
  /** 썸네일 아랫줄 «프라하·체스키크룸로프 등 전지역» — 없으면 '' */
  subtitle: string
  countries: CountryView[]
  map: { src: string; pins: PinView[] }
  /** 무제한 먼저 */
  products: ProductView[]
}

export interface CatalogView {
  generatedAt: string
  /** 표본 픽스처면 true — 머지 전 실 catalog.json 으로 바뀌어야 한다(spec DoD 4) */
  fixture: boolean
  zones: ZoneView[]
}
