/**
 * 나라 칩 — 검색 빈 화면의 «인기 국가»(S-2)와 오류 화면(S-7)이 같은 함수 · 같은 목록을 쓴다.
 * 오류 화면 칩은 **빌드 때** `modules/catalog.ts` 가 K1 에서 골라 앱 설정(`errorChips`)으로 넣는다 — 오류 화면은 서버를 부르지 않는다.
 * 앱 콘텐츠(인기 · 아시아 목록)는 부르는 쪽이 넘긴다(이 모듈은 nuxt 설정 시점에도 읽힌다).
 */
import { buildSearchIndex, type SearchEntry, type UpcomingCountry } from './search'
import type { CatalogView } from './types'

export type ErrorChipsKind = 'popular' | 'asia'

export interface ErrorChip {
  iso3: string
  iso2: string
  ko: string
}

export type ErrorChipSets = Record<ErrorChipsKind, ErrorChip[]>

/** 인기 국가 칩 수 — 검색 빈 화면 · 오류 화면 */
export const POPULAR_CHIP_COUNT = 8

/** 색인 → 칩(목록 순서 그대로). 준비 중 · 색인에 없는 코드는 건너뛰고, 인기 국가는 앞 8개 */
export function pickChips(
  index: readonly SearchEntry[],
  popular: readonly string[],
  asia: readonly string[],
): ErrorChipSets {
  const pick = (codes: readonly string[]) =>
    codes
      .map((iso3) => index.find((e) => e.iso3 === iso3 && !e.upcoming))
      .filter((e): e is SearchEntry => !!e)
      .map(({ iso3, iso2, ko }) => ({ iso3, iso2, ko }))
  return { popular: pick(popular).slice(0, POPULAR_CHIP_COUNT), asia: pick(asia) }
}

/**
 * 빌드 때 오류 화면 칩 — 검색 색인과 같은 길로 만든 뒤 고른다. 인기 8 · 아시아 목록 전부가 판매 중이 아니면 throw(빌드가 멈춘다).
 * `strict: false`(표본 픽스처 — 개발)면 멈추지 않고 있는 나라만 쓴다.
 * 영문 이름은 칩에 쓰지 않으므로 코드 그대로 둔다.
 */
export function errorChipsFromCatalog(
  catalog: CatalogView,
  upcoming: UpcomingCountry[],
  aliases: Record<string, string[]>,
  popular: readonly string[],
  asia: readonly string[],
  { strict = true }: { strict?: boolean } = {},
): ErrorChipSets {
  const sets = pickChips(
    buildSearchIndex(catalog, upcoming, aliases, (iso2) => iso2),
    popular,
    asia,
  )
  if (!strict) return sets
  if (sets.popular.length !== POPULAR_CHIP_COUNT)
    throw new Error(
      `오류 화면 인기 국가 칩이 ${sets.popular.length}개다 — ${POPULAR_CHIP_COUNT}개가 판매 중이어야 한다(catalog S-7)`,
    )
  const missing = asia.filter((iso3) => !sets.asia.some((c) => c.iso3 === iso3))
  if (missing.length)
    throw new Error(`오류 화면 아시아 칩 ${missing.join(' · ')} 가 카탈로그에 없다(catalog S-7)`)
  return sets
}
