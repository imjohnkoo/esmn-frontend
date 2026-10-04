import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildSearchIndex, type SearchEntry } from '#shared/catalog/search'
import { activeCatalog } from '#shared/catalog/test-data'
import { bannedIn } from '#shared/catalog/test-copy'
import { elementAttrs, readSource } from '#shared/catalog/test-source'
import { COUNTRY_ALIASES } from '~/content/catalog-search'
import upcomingJson from '~/content/catalog-upcoming.json'
import * as copy from '~/content/error-page'
import { POPULAR_COUNTRIES } from '~/content/popular'
import { effectScope, nextTick, shallowRef } from 'vue'
import {
  errorChips,
  errorHead,
  errorRouteOf,
  errorStatus,
  errorView,
  pickChips,
} from './error-view'

/** catalog spec S-7 · F-13 · D-22 — 오류 화면 갈래 · 문안 · 칩 */
const upcoming = upcomingJson.countries
const en = new Intl.DisplayNames('en', { type: 'region' })
const index = buildSearchIndex(
  activeCatalog(),
  upcoming,
  COUNTRY_ALIASES,
  (iso2) => en.of(iso2) ?? iso2,
)

describe('errorStatus — NuxtError → 상태 코드', () => {
  it.each([
    [{ status: 404 }, 404],
    [{ statusCode: 404 }, 404],
    [{ status: 502, statusCode: 404 }, 502],
    [{ statusCode: '404' }, 404],
    [{ status: 500 }, 500],
    [{}, 500],
    [null, 500],
    [undefined, 500],
    [{ status: 200 }, 500],
    [{ status: 302 }, 500],
    [{ status: 404.5 }, 500],
    [{ status: 'abc' }, 500],
  ] as const)('%j → %i', (error, want) => {
    expect(errorStatus(error)).toBe(want)
  })
})

describe('errorView — 갈래(S-7 표)', () => {
  it.each([
    [404, '/abc', 'page'],
    [404, '/', 'page'],
    [404, '/countries/xxx', 'page'],
    [404, '/countries/fra', 'page'],
    [404, '/countries/fr', 'page'],
    [404, '/countries/jpn/x', 'page'],
    [404, '/countriesjpn', 'page'],
    [404, '/products', 'page'],
    [404, '/products/xxx00', 'product'],
    [404, '/products/XXX00/', 'product'],
    // 구간 이름은 라우터 · 탭 판정처럼 대소문자를 가린다 — 나라 코드만 가리지 않는다
    [404, '/Products/jpn00', 'page'],
    [404, '/COUNTRIES/jpn', 'page'],
    [404, '/countries/Jpn', 'upcoming'],
    [404, '/countries/jpn', 'upcoming'],
    [404, '/countries/JPN', 'upcoming'],
    [404, '/countries/jpn/', 'upcoming'],
    [500, '/countries/jpn', 'error'],
    [500, '/abc', 'error'],
    [502, '/products/xxx00', 'error'],
    [403, '/abc', 'error'],
  ] as const)('%i %s → %s', (status, path, kind) => {
    expect(errorView(status, path).kind).toBe(kind)
  })

  it('준비 중 7개국 전부 — 나라 이름 제목 · 국기 · 아시아 칩 · 고객센터', () => {
    expect(upcoming).toHaveLength(7)
    for (const c of upcoming) {
      const v = errorView(404, `/countries/${c.iso3.toLowerCase()}`)
      expect(v, c.iso3).toEqual({
        kind: 'upcoming',
        copy: {
          title: `${c.nameKr} eSIM은 아직 준비 중이에요`,
          lines: ['지금은 판매하지 않는 나라예요.', '궁금한 점은 고객센터로 물어봐 주세요.'],
          primary: { label: '다른 나라 찾기', to: '/search' },
          secondary: { label: '고객센터', to: '/my#cs' },
        },
        country: { iso2: c.iso2, nameKr: c.nameKr },
        chips: 'asia',
      })
    }
  })

  it('없는 주소 · 없는 상품 · 잠시 오류 — 문안 · 버튼 · 칩 = spec S-7 표', () => {
    expect(errorView(404, '/abc')).toEqual({
      kind: 'page',
      copy: {
        title: '찾는 페이지가 없어요',
        lines: ['주소가 바뀌었거나 없어진 페이지예요.', '가려던 나라를 다시 찾아보세요.'],
        primary: { label: '나라 찾기', to: '/search' },
        secondary: { label: '홈으로', to: '/' },
      },
      country: null,
      chips: 'popular',
    })
    expect(errorView(404, '/products/xxx00')).toEqual({
      kind: 'product',
      copy: {
        title: '찾는 상품이 없어요',
        lines: ['상품 구성이 바뀌었을 수 있어요.', '가려는 나라로 다시 찾아보세요.'],
        primary: { label: '나라 찾기', to: '/search' },
        secondary: { label: '홈으로', to: '/' },
      },
      country: null,
      chips: 'popular',
    })
    expect(errorView(500, '/countries/fra')).toEqual({
      kind: 'error',
      copy: {
        title: '잠시 문제가 생겼어요',
        lines: ['잠시 뒤에 다시 시도해 주세요.', '계속되면 고객센터로 알려 주세요.'],
        primary: { label: '다시 시도' },
        secondary: { label: '홈으로', to: '/' },
      },
      country: null,
      chips: null,
    })
  })
})

describe('pickChips — 실 카탈로그 검색 색인', () => {
  it('인기 국가 = 검색 빈 화면 목록(POPULAR_COUNTRIES 앞 8 · 전부 판매 중)', () => {
    const { popular } = pickChips(index)
    expect(popular.map((c) => c.iso3)).toEqual(POPULAR_COUNTRIES.slice(0, 8))
    for (const c of popular) {
      const e = index.find((x) => x.iso3 === c.iso3)!
      expect(c).toEqual({ iso3: e.iso3, iso2: e.iso2, ko: e.ko })
    }
  })

  it('아시아 칩 5 — 코드가 전부 카탈로그에서 판매 중(빠지면 여기서 실패)', () => {
    const { asia } = pickChips(index)
    expect(asia.map((c) => c.iso3)).toEqual([...copy.ERROR_ASIA_COUNTRIES])
    expect(asia.map((c) => c.ko)).toEqual(['베트남', '태국', '싱가포르', '인도네시아', '홍콩'])
  })

  it('준비 중 · 색인에 없는 코드는 건너뛴다 · 빈 색인이면 빈 칩', () => {
    const e = (iso3: string, upcomingFlag = false): SearchEntry => ({
      iso3,
      iso2: iso3.slice(0, 2),
      ko: iso3,
      en: iso3,
      cities: [],
      aliases: [],
      zoneCount: upcomingFlag ? 0 : 1,
      upcoming: upcomingFlag,
    })
    expect(pickChips([e('AAA'), e('BBB', true)], ['BBB', 'ZZZ', 'AAA'], ['AAA', 'BBB'])).toEqual({
      popular: [{ iso3: 'AAA', iso2: 'AA', ko: 'AAA' }],
      asia: [{ iso3: 'AAA', iso2: 'AA', ko: 'AAA' }],
    })
    expect(pickChips([])).toEqual({ popular: [], asia: [] })
  })
})

describe('오류 화면 문안 — 금지어 · 약속 · 내부 정보', () => {
  const texts = [
    ...Object.values(copy.ERROR_COPY).flatMap((c) => [
      c.title,
      ...c.lines,
      c.primary.label,
      c.secondary.label,
    ]),
    ...upcoming.flatMap((c) => {
      const u = copy.upcomingCopy(c.nameKr)
      return [u.title, ...u.lines, u.primary.label, u.secondary.label]
    }),
    copy.UPCOMING_BADGE,
    copy.POPULAR_CHIPS_LABEL,
    copy.ASIA_CHIPS_LABEL,
  ]

  it('금지어 0(카피 규칙 공용 목록)', () => {
    expect(texts.flatMap(bannedIn)).toEqual([])
  })

  it('출시 알림 약속 없음(D-22 Q6) · 상태 코드 숫자 없음(Q8) · «판매 종료» 단정 없음', () => {
    for (const t of texts) {
      expect(t).not.toMatch(/알림|알려 ?드릴|출시되면|열리면|오픈/)
      expect(t).not.toMatch(/\d{3}|오류 코드|error/i)
      expect(t).not.toMatch(/판매 종료|판매를 마쳤|단종/)
    }
  })
})

describe('app/error.vue 결선 — 틀 · 판정 · 머리 · 칩', () => {
  const FILE = fileURLToPath(new URL('../error.vue', import.meta.url))
  const { template, script } = readSource(FILE)
  const code = script.map((t) => t.text).join(' ')

  it('사이트 틀(app.vue 와 같은 프레임) 안에 기본 레이아웃으로 패널을 그린다', () => {
    expect(template).toMatch(
      /<div class="app-bg">\s*<div class="app-frame">\s*<NuxtLayout name="default">\s*<ErrorPanel/,
    )
    expect(elementAttrs(FILE, 'NuxtLayout')).toEqual([[{ name: 'name', value: 'default' }]])
    expect(elementAttrs(FILE, 'ErrorPanel')).toEqual([
      [
        { name: ':view', value: 'view' },
        { name: ':chips', value: 'chips' },
        { name: '@retry', value: 'retry' },
      ],
    ])
  })

  it('갈래 · 틀은 그 오류가 난 주소로 — errorRouteOf 를 아래로 내려 주고, useRoute() 는 쓰지 않는다', () => {
    expect(code).toContain('const router = useRouter ( )')
    expect(code).toContain(
      'const errorRoute = errorRouteOf ( ( ) => props . error , ( ) => router . currentRoute . value , )',
    )
    expect(code).toContain('provide ( ERROR_ROUTE_KEY , errorRoute )')
    expect(code).toContain(
      'const view = computed ( ( ) => errorView ( errorStatus ( props . error ) , errorRoute . path ) )',
    )
    expect(script.map((t) => t.text)).not.toContain('useRoute')
  })

  it('머리 = errorHead(view) · 칩 = errorChips(view, 빌드 때 앱 설정) · 다시 시도 = 같은 주소 다시 불러오기', () => {
    expect(code).toContain('useHead ( ( ) => errorHead ( view . value ) )')
    expect(code).toContain(
      'const chipSets : ErrorChipSets = ( useAppConfig ( ) as { errorChips ? : ErrorChipSets } ) . errorChips ?? { popular : [ ] , asia : [ ] , }',
    )
    expect(code).toContain(
      'const chips = computed ( ( ) => errorChips ( view . value , chipSets ) )',
    )
    expect(code).toContain('function retry ( ) { window . location . reload ( ) }')
  })

  it('서버를 부르지 않고(칩은 빌드 때) 다시 던지지 않는다', () => {
    expect(code).not.toMatch(/useFetch|useAsyncData|\$fetch|useLazyFetch/)
    expect(script.map((t) => t.text)).not.toContain('throw')
    expect(code).not.toMatch(/createError|showError/)
  })
})

describe('errorHead — 오류 화면 머리(app.vue 대신)', () => {
  it.each([
    [404, '/abc'],
    [404, '/countries/jpn'],
    [500, '/abc'],
  ] as const)('%i %s — lang · 제목 «{제목} · 이심마니» · noindex', (status, path) => {
    const view = errorView(status, path)
    const head = errorHead(view)
    expect(head.htmlAttrs).toEqual({ lang: 'ko' })
    expect(head.title).toBe(view.copy.title)
    expect(head.titleTemplate(head.title)).toBe(`${view.copy.title} · 이심마니`)
    expect(head.titleTemplate(undefined)).toBe('이심마니')
    expect(head.meta).toEqual([{ name: 'robots', content: 'noindex, nofollow' }])
  })
})

describe('errorChips — 갈래가 그릴 칩', () => {
  const sets = pickChips(index)
  it('없는 주소 · 없는 상품 = 인기 국가 · 준비 중 = 아시아 · 잠시 오류 = 없음', () => {
    expect(errorChips(errorView(404, '/abc'), sets)).toBe(sets.popular)
    expect(errorChips(errorView(404, '/products/xxx00'), sets)).toBe(sets.popular)
    for (const c of upcoming)
      expect(errorChips(errorView(404, `/countries/${c.iso3.toLowerCase()}`), sets), c.iso3).toBe(
        sets.asia,
      )
    expect(errorChips(errorView(500, '/abc'), sets)).toEqual([])
  })
})

describe('검색 빈 화면의 인기 칩 = 오류 화면과 같은 함수의 인기 목록(S-2 · S-7)', () => {
  it('search.vue 는 pickChips(색인).popular 를 쓴다', () => {
    const FILE = fileURLToPath(new URL('../pages/search.vue', import.meta.url))
    const code = readSource(FILE)
      .script.map((t) => t.text)
      .join(' ')
    expect(code).toContain(
      'const popular = computed ( ( ) => pickChips ( entries . value ) . popular )',
    )
  })
})

describe('errorRouteOf — 그 오류가 난 주소(S-7)', () => {
  const setup = () => {
    const error = shallowRef<object>({ status: 404 })
    const current = shallowRef({ path: '/abc', fullPath: '/abc?x=1', hash: '' })
    const scope = effectScope()
    const route = scope.run(() =>
      errorRouteOf(
        () => error.value,
        () => current.value,
      ),
    )!
    return { error, current, route, scope }
  }

  it('처음 = 지금 라우트 · 오류 화면을 떠나는 동안(라우트만 바뀜)에는 그대로', async () => {
    const { current, route, scope } = setup()
    expect(route.path).toBe('/abc')
    expect(route.fullPath).toBe('/abc?x=1')
    current.value = { path: '/countries/nld', fullPath: '/countries/nld', hash: '' }
    await nextTick()
    expect(route.path).toBe('/abc')
    scope.stop()
  })

  it('오류가 바뀌면(오류 → 오류) 그때의 라우트로 — 없어진 키는 지운다', async () => {
    const { error, current, route, scope } = setup()
    current.value = { path: '/countries/jpn', fullPath: '/countries/jpn' } as typeof current.value
    error.value = { status: 404 }
    expect(route.path).toBe('/countries/jpn')
    expect(route.fullPath).toBe('/countries/jpn')
    expect('hash' in route).toBe(false)
    // 다시 떠나는 동안은 그대로
    current.value = { path: '/', fullPath: '/', hash: '' }
    await nextTick()
    expect(route.path).toBe('/countries/jpn')
    scope.stop()
  })
})

describe('셸(하단 탭 · 헤더)은 useShellRoute — 오류 화면이 내려 준 주소를 본다', () => {
  it.each(['app/components/shell/BottomTabBar.vue', 'app/components/shell/ShellHeader.vue'])(
    '%s',
    (file) => {
      const FILE = fileURLToPath(new URL(`../../${file}`, import.meta.url))
      const tokens = readSource(FILE).script.map((t) => t.text)
      expect(tokens.join(' ')).toContain('const route = useShellRoute ( )')
      expect(tokens).not.toContain('useRoute')
    },
  )
})
