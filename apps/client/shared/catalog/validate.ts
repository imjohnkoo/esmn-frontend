/**
 * 카탈로그 검증기 — spec F-1. 하나라도 걸리면 throw 한다(빌드 · 서버 기동 실패).
 *
 * 웹은 «있으면 판다» — 판매 중 · 전시 중 · 판매 가능한 옵션만 싣는다. export(W1-1)가 이미 거르더라도
 * 여기서 한 번 더 확인한다(export 규칙이 바뀌어도 판매 중지 상품이 웹에 나가지 않게).
 */
import { adaptCatalog, type AdaptedCatalog } from './adapter'
import type { CatalogView, ZoneView } from './types'

export class CatalogValidationError extends Error {
  constructor(readonly issues: string[]) {
    super(`catalog.json 검증 실패 ${issues.length}건:\n- ${issues.slice(0, 30).join('\n- ')}`)
    this.name = 'CatalogValidationError'
  }
}

const ZONE_RE = /^[A-Z0-9]{5}$/
const ISO3_RE = /^[A-Z]{3}$/
const ISO2_RE = /^[A-Z]{2}$/
const DAILY_DAYS = Array.from({ length: 30 }, (_, i) => i + 1)
/** 무제한 판매 기간 — 1~30일 · 60 · 90일(D-3) */
const DAILY_ALLOWED = new Set([...DAILY_DAYS, 60, 90])
const QUOTA_DAYS = 30
/** K1 스키마 이름 — export 가 `meta.schema` 에 적는다(H-002). 바뀌면 어댑터를 먼저 맞춘다 */
const SCHEMA = 'k1-v1'
/** ISO 8601 날짜 · 시각(시간대 필수) — sitemap lastmod 가 앞 10자를 쓴다 */
const ISO_DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/
/** 옵션 코드 `{SKU}{cap}D{dd}V2` — 레지스트리는 cap 2~3자리지만 지금은 2자리만 지원한다(H-002 검증기 계약) */
const CODE_RE = /^(?<sku>[A-Z0-9]{5}[UL])(?<cap>\d+)D(?<days>\d+)V2$/

export function expectedNaverUrl(channelProductNo: number, sku: string): string {
  return `https://smartstore.naver.com/esimmany/products/${channelProductNo}?nt_source=esimmany-web&nt_medium=detail&nt_detail=${sku}`
}

function checkAssetPath(path: string, expected: string, at: string, issues: string[]) {
  if (/pstatic\.net|shop-phinf/i.test(path))
    issues.push(`${at}: 네이버 CDN 경로(${path}) — 자사 자산만(A6)`)
  else if (path !== expected) issues.push(`${at}: ${expected} 가 아니다(${path})`)
}

function checkCode(
  o: { code: string; cap: number; days: number },
  sku: string,
  at: string,
  issues: string[],
) {
  const m = CODE_RE.exec(o.code)?.groups
  if (!m || m.sku !== sku) {
    issues.push(`${at}: 옵션 코드가 ${sku}{cap}D{dd}V2 모양이 아니다(${o.code})`)
    return
  }
  if (m.cap!.length !== 2)
    issues.push(
      `${at}: 용량 ${m.cap!.length}자리 코드는 아직 지원하지 않는다 — 검증기 · export 를 함께 고친다`,
    )
  else if (m.days!.length !== 2 || Number(m.cap) !== o.cap || Number(m.days) !== o.days)
    issues.push(`${at}: 코드(${o.code})와 용량 ${o.cap} · ${o.days}일이 어긋난다`)
}

/** 달력에 있는 날짜인가 — `Date.parse` 는 2월 30일을 3월 2일로 넘겨 계산한다 */
function isCalendarDate(iso: string): boolean {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number]
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d
}

function check(c: AdaptedCatalog, issues: string[]) {
  const zones = new Set<string>()
  const skus = new Set<string>()
  /** iso3 → 처음 본 «iso2 이름» — zone 마다 같아야 한다(검색 · 국가 페이지가 서로 다른 zone 값을 쓴다) */
  const countryOf = new Map<string, string>()
  const channelNos = new Map<number, string>()
  if (
    !ISO_DATETIME_RE.test(c.generatedAt) ||
    Number.isNaN(Date.parse(c.generatedAt)) ||
    !isCalendarDate(c.generatedAt)
  )
    issues.push(`meta.generatedAt: ISO 8601 날짜 · 시각이 아니다(${c.generatedAt})`)
  if (c.schema !== SCHEMA)
    issues.push(`meta.schema: ${SCHEMA} 가 아니다(${c.schema ?? '키 없음'}) — 어댑터를 먼저 맞춘다`)
  const actual = {
    zoneCount: c.zones.length,
    skuCount: c.zones.reduce((n, z) => n + z.products.length, 0),
    cellCount: c.zones.reduce(
      (n, z) => n + z.products.reduce((m, p) => m + p.options.length, 0),
      0,
    ),
  }
  for (const key of ['zoneCount', 'skuCount', 'cellCount'] as const) {
    const said = c.counts[key]
    if (said === undefined)
      issues.push(`meta.${key}: 숫자가 없다 — export 가 적는 개수로 잘린 파일을 막는다`)
    else if (said !== actual[key])
      issues.push(`meta.${key}: export 는 ${said} 인데 실제는 ${actual[key]} — 잘린 export 인가`)
  }
  if (c.zones.length === 0) issues.push('zones: 비어 있다')
  for (const z of c.zones) {
    const at = `zone ${z.zone || '?'}`
    if (!ZONE_RE.test(z.zone)) issues.push(`${at}: zone 코드 모양이 아니다`)
    if (zones.has(z.zone)) issues.push(`${at}: zone 중복`)
    zones.add(z.zone)
    if (z.label.trim() === '') issues.push(`${at}: 라벨이 비었다`)
    if (z.countries.length === 0) issues.push(`${at}: 나라가 없다`)
    const inZone = new Set<string>()
    for (const k of z.countries) {
      if (!ISO3_RE.test(k.iso3)) issues.push(`${at}: iso3 모양이 아니다(${k.iso3})`)
      if (!ISO2_RE.test(k.iso2)) issues.push(`${at}: ${k.iso3} iso2 가 없다`)
      if (k.nameKr.trim() === '') issues.push(`${at}: ${k.iso3} 이름이 없다`)
      if (inZone.has(k.iso3)) issues.push(`${at}: 나라 ${k.iso3} 중복`)
      inZone.add(k.iso3)
      const id = `${k.iso2} ${k.nameKr}`
      const seen = countryOf.get(k.iso3)
      if (seen === undefined) countryOf.set(k.iso3, id)
      else if (seen !== id) issues.push(`${at}: ${k.iso3} 가 다른 zone 과 다르다(${id} ≠ ${seen})`)
    }
    checkAssetPath(z.map.src, `/catalog/maps/${z.zone}.svg`, `${at}.map`, issues)
    for (const pin of z.map.pins)
      if (!(pin.x >= 0 && pin.x <= 100 && pin.y >= 0 && pin.y <= 100))
        issues.push(`${at}: 핀 ${pin.name} 좌표가 0~100% 밖(${pin.x}, ${pin.y})`)
    if (z.products.length === 0) issues.push(`${at}: 상품이 없다`)
    const kinds = new Set<string>()
    for (const p of z.products) {
      const pat = `${p.sku || '?'}`
      if (p.sku !== `${z.zone}${p.kind}`)
        issues.push(`${pat}: SKU 가 zone+kind(${z.zone}${p.kind})가 아니다`)
      if (skus.has(p.sku)) issues.push(`${pat}: SKU 중복`)
      skus.add(p.sku)
      if (kinds.has(p.kind)) issues.push(`${at}: kind ${p.kind} 상품이 둘 이상`)
      kinds.add(p.kind)
      if (p.saleStatus !== 'SALE' || p.displayStatus !== 'ON')
        issues.push(`${pat}: 판매 ${p.saleStatus} · 전시 ${p.displayStatus} — SALE/ON 만 싣는다`)
      if (!Number.isInteger(p.channelProductNo) || p.channelProductNo <= 0)
        issues.push(`${pat}: 채널상품번호가 없다`)
      else {
        const other = channelNos.get(p.channelProductNo)
        if (other)
          issues.push(
            `${pat}: 채널상품번호 ${p.channelProductNo} 를 ${other} 도 쓴다 — 구매하기가 다른 상품으로 간다`,
          )
        channelNos.set(p.channelProductNo, p.sku)
        if (p.naverUrl !== expectedNaverUrl(p.channelProductNo, p.sku))
          issues.push(`${pat}: naverUrl 이 K2 모양이 아니다(${p.naverUrl})`)
      }
      checkAssetPath(p.thumb, `/catalog/thumbs/${p.sku}.webp`, `${pat}.thumb`, issues)
      if (p.options.length === 0) issues.push(`${pat}: 옵션이 없다`)
      const cells = new Set<string>()
      for (const o of p.options) {
        const oat = `${pat} ${o.code || o.id}`
        const key = `${o.cap}/${o.days}`
        if (cells.has(key)) issues.push(`${oat}: (용량 ${o.cap} · ${o.days}일) 중복`)
        cells.add(key)
        if (!Number.isInteger(o.finalWon) || o.finalWon <= 0)
          issues.push(`${oat}: 최종가가 0 이하이거나 정수가 아니다(${o.finalWon})`)
        else if (o.finalWon !== p.salePriceWon - p.immediateDiscountWon + o.optionPriceWon)
          issues.push(
            `${oat}: 최종가 ${o.finalWon} ≠ 판매가 ${p.salePriceWon} − 즉시할인 ${p.immediateDiscountWon} + 옵션가 ${o.optionPriceWon}`,
          )
        if (!(o.cap > 0)) issues.push(`${oat}: 용량이 0 이하`)
        if (!Number.isInteger(o.days) || o.days <= 0) issues.push(`${oat}: 일수가 0 이하`)
        if (o.usable !== true) issues.push(`${oat}: 판매 가능(usable)이 true 가 아니다`)
        checkCode(o, p.sku, oat, issues)
        if (p.kind === 'L' && o.days !== QUOTA_DAYS)
          issues.push(`${oat}: 종량제 일수가 ${QUOTA_DAYS}일이 아니다(${o.days})`)
        if (p.kind === 'U' && !DAILY_ALLOWED.has(o.days))
          issues.push(`${oat}: 무제한 기간이 1~30 · 60 · 90일 밖(${o.days})`)
      }
      if (p.kind === 'U') {
        const daysByCap = new Map<number, string>()
        for (const cap of new Set(p.options.map((o) => o.cap))) {
          const missing = DAILY_DAYS.filter((d) => !cells.has(`${cap}/${d}`))
          if (missing.length > 0)
            issues.push(
              `${pat}: 매일 ${cap}GB 에 ${missing.join(',')}일이 없다 — 1~30일은 하루 단위`,
            )
          const days = p.options.filter((o) => o.cap === cap).map((o) => o.days)
          daysByCap.set(cap, [...days].sort((a, b) => a - b).join(','))
        }
        // 용량마다 기간 목록이 같아야 드롭다운의 어느 기간을 골라도 용량 카드가 다 나온다
        if (new Set(daysByCap.values()).size > 1) issues.push(`${pat}: 용량마다 기간 목록이 다르다`)
      }
    }
  }
}

/** K1 을 검증하고 화면 모델로 바꾼다. 검증 전용 필드(판매 상태 · usable)는 버린다 */
export function parseCatalog(raw: unknown): CatalogView {
  const issues: string[] = []
  const adapted = adaptCatalog(raw, issues)
  check(adapted, issues)
  if (issues.length > 0) throw new CatalogValidationError(issues)
  return {
    generatedAt: adapted.generatedAt,
    fixture: adapted.fixture,
    zones: adapted.zones.map(
      (z): ZoneView => ({
        ...z,
        products: z.products.map(
          ({
            saleStatus: _s,
            displayStatus: _d,
            salePriceWon: _p,
            immediateDiscountWon: _i,
            options,
            ...p
          }) => ({
            ...p,
            options: options.map(({ usable: _u, optionPriceWon: _o, ...o }) => o),
          }),
        ),
      }),
    ),
  }
}
