/**
 * K1(catalog.json) → 화면 모델 어댑터 — **K1 필드명은 이 파일에만 적는다**(plan §2.1).
 *
 * 필드명은 W1-1 export 의 README(H-002)가 정한다. 이름이 바뀌면 이 파일만 고친다
 * (자주 쓰는 이름은 `K` 표, 옵션 · 나라 · 핀의 잎 필드는 각 함수 안).
 * 모양이 틀린 값은 버리지 않고 `issues` 에 적는다 — 판정(빌드 실패)은 `validate.ts` 가 한다.
 * 키가 없으면 기본값으로 채우지 않고 issue 로 적는다(export 가 필드 이름을 바꾸면 빌드가 멈춰야 한다 — spec F-1).
 * null 을 허용하는 것은 미확정 통신사 · 망뿐이다.
 */
import type { CountryView, Kind, OptionView, PinView, ProductView, ZoneView } from './types'

/** K1 필드명 표 — H-002 출력 스키마(2026-09-23 · 9957231) */
const K = {
  meta: 'meta',
  generatedAt: 'generatedAt',
  fixture: 'fixture',
  zones: 'zones',
  zone: 'zone',
  zoneLabel: 'nameKr',
  zoneSubtitle: 'subtitle',
  countries: 'countries',
  map: 'map',
  mapSvg: 'svg',
  pins: 'pins',
  products: 'products',
  sku: 'sku',
  kind: 'kind',
  channelProductNo: 'channelProductNo',
  naverUrl: 'naverUrl',
  saleStatus: 'saleStatus',
  displayStatus: 'displayStatus',
  images: 'images',
  thumb: 'thumb',
  options: 'options',
} as const

/** 검증에만 쓰는 값을 화면 모델 옆에 붙여 둔다(검증 뒤 버린다) */
export interface AdaptedOption extends OptionView {
  usable: boolean | undefined
  /** 옵션 추가금 — 최종가 산식 대조용(판매가 − 즉시할인 + 옵션가) */
  optionPriceWon: number
}
export interface AdaptedProduct extends Omit<ProductView, 'options'> {
  saleStatus: string
  displayStatus: string
  /** 최종가 산식 대조용 — 화면 모델에는 싣지 않는다(D-2) */
  salePriceWon: number
  immediateDiscountWon: number
  options: AdaptedOption[]
}
export interface AdaptedZone extends Omit<ZoneView, 'products'> {
  products: AdaptedProduct[]
}
export interface AdaptedCatalog {
  generatedAt: string
  fixture: boolean
  /** export 가 적은 스키마 · 개수 — 있으면 실제와 대조한다(잘린 export 를 막는다) */
  schema: string | null
  counts: { skuCount?: number; zoneCount?: number; cellCount?: number }
  zones: AdaptedZone[]
}

type Rec = Record<string, unknown>

function isRec(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

class Reader {
  constructor(readonly issues: string[]) {}

  rec(v: unknown, at: string): Rec {
    if (isRec(v)) return v
    this.issues.push(`${at}: 객체가 아니다`)
    return {}
  }

  arr(o: Rec, key: string, at: string): unknown[] {
    const v = o[key]
    if (Array.isArray(v)) return v
    this.issues.push(`${at}.${key}: 배열이 없다`)
    return []
  }

  /** 키가 반드시 있어야 한다 — `allowEmpty` 는 빈 문자열만 허용한다(키 누락 · null 은 여전히 실패) */
  str(o: Rec, key: string, at: string, { allowEmpty = false } = {}): string {
    const v = o[key]
    if (typeof v === 'string' && (allowEmpty || v.trim() !== '')) return v
    this.issues.push(`${at}.${key}: 문자열이 없다`)
    return ''
  }

  /** 키가 반드시 있어야 하고 값은 문자열 또는 null(미확정) */
  strOrNull(o: Rec, key: string, at: string): string | null {
    const v = o[key]
    if (v === null) return null
    if (typeof v === 'string' && v.trim() !== '') return v
    this.issues.push(`${at}.${key}: 문자열 또는 null 이 아니다(키 누락 포함)`)
    return null
  }

  /** 키가 반드시 있어야 하고 값은 빈 칸 없는 문자열 배열 */
  strs(o: Rec, key: string, at: string): string[] {
    const v = o[key]
    if (Array.isArray(v) && v.every((x) => typeof x === 'string' && x.trim() !== ''))
      return v as string[]
    this.issues.push(`${at}.${key}: 문자열 배열이 아니다(키 누락 포함)`)
    return []
  }

  /** 정해진 어휘 중 하나 */
  oneOf<T extends string>(o: Rec, key: string, at: string, words: readonly T[]): T {
    const v = o[key]
    if (typeof v === 'string' && (words as readonly string[]).includes(v)) return v as T
    this.issues.push(`${at}.${key}: ${words.join(' · ')} 중 하나가 아니다(${String(v)})`)
    return words[0]!
  }

  num(o: Rec, key: string, at: string): number {
    const v = o[key]
    if (typeof v === 'number' && Number.isFinite(v)) return v
    this.issues.push(`${at}.${key}: 숫자가 없다`)
    return Number.NaN
  }
}

function adaptOption(r: Reader, raw: unknown, at: string): AdaptedOption {
  const o = r.rec(raw, at)
  return {
    id: r.num(o, 'id', at),
    code: r.str(o, 'code', at),
    cap: r.num(o, 'cap', at),
    days: r.num(o, 'days', at),
    name1: r.str(o, 'optionName1', at),
    name2: r.str(o, 'optionName2', at),
    finalWon: r.num(o, 'finalWon', at),
    optionPriceWon: r.num(o, 'optionPriceWon', at),
    usable: typeof o.usable === 'boolean' ? o.usable : undefined,
  }
}

function adaptProduct(r: Reader, raw: unknown, at: string): AdaptedProduct {
  const p = r.rec(raw, at)
  const kind = p[K.kind]
  if (kind !== 'U' && kind !== 'L')
    r.issues.push(`${at}.${K.kind}: U · L 이 아니다(${String(kind)})`)
  const images = r.rec(p[K.images], `${at}.${K.images}`)
  const options = r.arr(p, K.options, at).map((o, i) => adaptOption(r, o, `${at}.options[${i}]`))
  options.sort((a, b) => a.cap - b.cap || a.days - b.days)
  return {
    sku: r.str(p, K.sku, at),
    kind: kind as Kind,
    channelProductNo: r.num(p, K.channelProductNo, at),
    naverUrl: r.str(p, K.naverUrl, at),
    thumb: r.str(images, K.thumb, `${at}.${K.images}`),
    saleStatus: r.str(p, K.saleStatus, at),
    displayStatus: r.str(p, K.displayStatus, at),
    salePriceWon: r.num(p, 'salePriceWon', at),
    immediateDiscountWon: r.num(p, 'immediateDiscountWon', at),
    options,
  }
}

function adaptCountry(r: Reader, raw: unknown, at: string): CountryView {
  const c = r.rec(raw, at)
  const operators = c.operators === null ? null : r.strs(c, 'operators', at)
  return {
    iso3: r.str(c, 'iso3', at),
    iso2: r.str(c, 'iso2', at),
    nameKr: r.str(c, 'nameKr', at),
    cities: r.strs(c, 'cities', at),
    // 빈 배열은 «미확정» 과 같다 — 화면은 대체 문구를 쓴다
    operators: operators && operators.length > 0 ? operators : null,
    network: r.strOrNull(c, 'network', at),
  }
}

function adaptPin(r: Reader, raw: unknown, at: string): PinView {
  const p = r.rec(raw, at)
  return {
    name: r.str(p, 'name', at),
    x: r.num(p, 'x', at),
    y: r.num(p, 'y', at),
    big: r.oneOf(p, 'size', at, ['big', 'normal'] as const) === 'big',
    // labelDir 는 2609 클래스 그대로다(H-002 README): `cv-pin--right` → "right" = 점이 라벨 오른쪽 → 라벨은 점 **왼쪽**
    labelLeft: r.oneOf(p, 'labelDir', at, ['left', 'right'] as const) === 'right',
    // 보정이 없는 핀은 키가 없다(H-002)
    labelShift:
      p.labelShift === undefined || p.labelShift === null
        ? null
        : r.oneOf(p, 'labelShift', at, ['up', 'down'] as const),
  }
}

function adaptZone(r: Reader, raw: unknown, at: string): AdaptedZone {
  const z = r.rec(raw, at)
  const map = r.rec(z[K.map], `${at}.${K.map}`)
  const products = r
    .arr(z, K.products, at)
    .map((p, i) => adaptProduct(r, p, `${at}.products[${i}]`))
  products.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'U' ? -1 : 1))
  return {
    zone: r.str(z, K.zone, at),
    label: r.str(z, K.zoneLabel, at),
    subtitle: r.str(z, K.zoneSubtitle, at, { allowEmpty: true }),
    countries: r.arr(z, K.countries, at).map((c, i) => adaptCountry(r, c, `${at}.countries[${i}]`)),
    map: {
      src: r.str(map, K.mapSvg, `${at}.${K.map}`),
      pins: r
        .arr(map, K.pins, `${at}.${K.map}`)
        .map((p, i) => adaptPin(r, p, `${at}.map.pins[${i}]`)),
    },
    products,
  }
}

export function adaptCatalog(raw: unknown, issues: string[]): AdaptedCatalog {
  const r = new Reader(issues)
  const root = r.rec(raw, 'catalog')
  const meta = r.rec(root[K.meta], `catalog.${K.meta}`)
  const fixture = meta[K.fixture]
  const count = (key: string) => (typeof meta[key] === 'number' ? (meta[key] as number) : undefined)
  return {
    generatedAt: r.str(meta, K.generatedAt, 'catalog.meta'),
    // 표본 표시 — 설명 문자열(비어 있지 않음)이나 true 면 표본이다(경고 · 머지 게이트가 이 값을 본다)
    fixture: fixture === true || (typeof fixture === 'string' && fixture.trim() !== ''),
    // 글자만 스키마로 본다 — 그 밖의 값은 종류를 적어 진단이 원인을 가리키게(숫자 1 → «(number) 1» · 배열 → «(array) …»)
    schema:
      typeof meta.schema === 'string'
        ? meta.schema
        : meta.schema === undefined || meta.schema === null
          ? null
          : `(${Array.isArray(meta.schema) ? 'array' : typeof meta.schema}) ${JSON.stringify(meta.schema)}`,
    counts: {
      skuCount: count('skuCount'),
      zoneCount: count('zoneCount'),
      cellCount: count('cellCount'),
    },
    zones: r.arr(root, K.zones, 'catalog').map((z, i) => adaptZone(r, z, `zones[${i}]`)),
  }
}
