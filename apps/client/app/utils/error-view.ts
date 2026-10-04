/**
 * 오류 화면 갈래 판정(catalog spec S-7 · F-13) — 상태 · 경로 → 문안 · 국기 · 칩. `app/error.vue` 가 부른다.
 * 준비 중 나라 목록은 검색과 같은 `catalog-upcoming.json`(새 데이터 없음). 상태 코드는 바꾸지 않는다(D-22).
 * 구간 이름(`/countries` · `/products`)은 라우터 · 탭 판정(`activeTabOf`)처럼 대소문자를 가리고, 나라 코드만 가리지 않는다.
 */
import { shallowReactive, watch } from 'vue'
import {
  pickChips as pickChipsFrom,
  type ErrorChip,
  type ErrorChipSets,
  type ErrorChipsKind,
} from '#shared/catalog/chips'
import type { SearchEntry, UpcomingCountry } from '#shared/catalog/search'
import upcoming from '~/content/catalog-upcoming.json'
import {
  ERROR_ASIA_COUNTRIES,
  ERROR_COPY,
  upcomingCopy,
  type ErrorCopy,
  type ErrorKind,
} from '~/content/error-page'
import { POPULAR_COUNTRIES } from '~/content/popular'

export type { ErrorChip, ErrorChipSets, ErrorChipsKind }

export interface ErrorView {
  kind: ErrorKind
  copy: ErrorCopy
  /** 준비 중 나라면 국기 · 이름 */
  country: { iso2: string; nameKr: string } | null
  chips: ErrorChipsKind | null
}

/** NuxtError → 상태 코드. 없거나 4xx · 5xx 가 아니면 500(잠시 오류) */
export function errorStatus(
  error: { status?: number | string; statusCode?: number | string } | null | undefined,
): number {
  const status = Number(error?.status ?? error?.statusCode)
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500
}

export function errorView(
  status: number,
  path: string,
  list: readonly UpcomingCountry[] = upcoming.countries,
): ErrorView {
  if (status !== 404) return { kind: 'error', copy: ERROR_COPY.error, country: null, chips: null }
  const m = path.match(/^\/countries\/([a-zA-Z]{3})\/?$/)
  const soon = m ? list.find((c) => c.iso3 === m[1]!.toUpperCase()) : undefined
  if (soon)
    return {
      kind: 'upcoming',
      copy: upcomingCopy(soon.nameKr),
      country: { iso2: soon.iso2, nameKr: soon.nameKr },
      chips: 'asia',
    }
  if (path.startsWith('/products/'))
    return { kind: 'product', copy: ERROR_COPY.product, country: null, chips: 'popular' }
  return { kind: 'page', copy: ERROR_COPY.page, country: null, chips: 'popular' }
}

/** 검색 색인 → 칩(인기 국가 = `POPULAR_COUNTRIES` 앞 8 · 아시아 = `ERROR_ASIA_COUNTRIES`) — 검색 빈 화면 · 빌드 주입이 같은 함수 */
export function pickChips(
  index: readonly SearchEntry[],
  popular: readonly string[] = POPULAR_COUNTRIES,
  asia: readonly string[] = ERROR_ASIA_COUNTRIES,
): ErrorChipSets {
  return pickChipsFrom(index, popular, asia)
}

/**
 * 그 오류가 난 주소의 라우트 — 오류가 바뀌는 순간에만 지금 라우트를 옮겨 담는다.
 * `useRoute()` 는 오류에서 갱신되지 않고(페이지가 없다), 라우터의 현재 라우트는 오류 화면을 떠나는 동안(새 페이지 로딩)
 * 도착 주소로 먼저 바뀐다 — 둘 다 오류 화면 본문 · 틀과 어긋난다(catalog S-7).
 */
export function errorRouteOf<R extends object>(error: () => unknown, current: () => R): R {
  const route = shallowReactive({ ...current() }) as R
  watch(
    error,
    () => {
      const next = current()
      for (const key of Object.keys(route))
        if (!(key in next)) delete (route as Record<string, unknown>)[key]
      Object.assign(route, next)
    },
    { flush: 'sync' },
  )
  return route
}

/** 오류 화면의 머리 — app.vue 대신 그려지므로 lang · 제목 템플릿(app.vue 와 같은 « · 이심마니») · noindex 를 여기서 */
export function errorHead(view: ErrorView) {
  return {
    htmlAttrs: { lang: 'ko' },
    title: view.copy.title,
    titleTemplate: (title?: string) => (title ? `${title} · 이심마니` : '이심마니'),
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }
}

/** 그 갈래가 그릴 칩 — 칩이 없는 갈래(잠시 오류)는 늘 [] */
export function errorChips(view: ErrorView, sets: ErrorChipSets): ErrorChip[] {
  return view.chips ? sets[view.chips] : []
}
