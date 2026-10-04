import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  capsOf,
  countriesOf,
  daysOf,
  defaultSelection,
  kindsOf,
  lowestWon,
  optionFor,
  optionLabel,
  perDayWon,
  perGbWon,
  zoneByCode,
  zonesOfCountry,
} from './derive'
import {
  ACTIVE_CATALOG_FILE,
  APP_DIR,
  FIXTURE_CATALOG_FILE,
  activeRaw,
  addSynthZone,
  fixtureRaw,
  setFinalWon,
} from './test-data'
import { CatalogValidationError, expectedNaverUrl, parseCatalog } from './validate'

// 표본 픽스처 = 스냅샷 2026-09-22 추출(5 zone · 7 SKU). 아래 가격 기대값은 그 스냅샷 값이다.
const fresh = fixtureRaw
const zoneRaw = (raw: any, code: string) => raw.zones.find((z: any) => z.zone === code)
const renameKey = (o: any, from: string, to: string) => {
  o[to] = o[from]
  delete o[from]
}
const productRaw = (raw: any, sku: string) =>
  raw.zones.flatMap((z: any) => z.products).find((p: any) => p.sku === sku)

describe('parseCatalog — 표본 픽스처', () => {
  const cat = parseCatalog(fresh())

  it('5 zone 을 읽고 픽스처임을 표시한다', () => {
    expect(cat.zones.map((z) => z.zone)).toEqual(['CZE00', 'FRA00', 'EU340', 'NA022', 'THA00'])
    expect(cat.fixture).toBe(true)
  })

  it('무제한이 먼저, 옵션은 용량 · 일수 오름차순', () => {
    const cze = zoneByCode(cat, 'CZE00')!
    expect(kindsOf(cze)).toEqual(['U', 'L'])
    const days = cze.products[0]!.options.map((o) => `${o.cap}/${o.days}`)
    expect(days.slice(0, 3)).toEqual(['1/1', '1/2', '1/3'])
  })

  it('화면 모델에 판매가 · 즉시할인 · 판매 상태 · usable 이 남지 않는다(최종가만 — D-2)', () => {
    const json = JSON.stringify(cat)
    for (const key of [
      'salePriceWon',
      'immediateDiscountWon',
      'saleStatus',
      'displayStatus',
      'usable',
      'naverName',
      'optionPriceWon',
      'baseWon',
    ])
      expect(json).not.toContain(`"${key}"`)
  })

  it('이미지 경로에 네이버 CDN 이 없다', () => {
    expect(JSON.stringify(cat)).not.toMatch(/pstatic|shop-phinf/)
  })

  it.each([
    ['표본', FIXTURE_CATALOG_FILE],
    ['지금 빌드가 쓰는 카탈로그', ACTIVE_CATALOG_FILE],
  ])('%s 원문(K1 전체 필드)에 네이버 CDN URL 이 없다(불변식 4)', (_n, file) => {
    // 호스트 글자 자체를 본다 — 스킴 없는 //… · 이스케이프된 https:\/\/… 도 걸린다
    const text = readFileSync(`${APP_DIR}${file}`, 'utf8')
    expect(text.match(/pstatic|shop-phinf/i)?.[0] ?? null).toBeNull()
  })
})

describe('parseCatalog — 깨진 입력은 빌드를 멈춘다', () => {
  const cases: [string, (raw: any) => void, RegExp][] = [
    ['판매중지 상품', (r) => (productRaw(r, 'FRA00U').saleStatus = 'SUSPENSION'), /SALE\/ON/],
    ['미전시 상품', (r) => (productRaw(r, 'FRA00U').displayStatus = 'SUSPENSION'), /SALE\/ON/],
    ['판매 불가 옵션', (r) => (productRaw(r, 'FRA00U').options[3].usable = false), /usable/],
    ['usable 없음', (r) => delete productRaw(r, 'FRA00U').options[3].usable, /usable/],
    ['최종가 0', (r) => (productRaw(r, 'CZE00U').options[0].finalWon = 0), /최종가/],
    [
      '같은 칸 중복',
      (r) => productRaw(r, 'CZE00U').options.push({ ...productRaw(r, 'CZE00U').options[0] }),
      /중복/,
    ],
    [
      '무제한 1~30일 빈칸',
      (r) => {
        const p = productRaw(r, 'CZE00U')
        p.options = p.options.filter((o: any) => !(o.cap === 2 && o.days === 13))
      },
      /매일 2GB 에 13일이 없다/,
    ],
    ['상품 0 zone', (r) => (zoneRaw(r, 'THA00').products = []), /상품이 없다/],
    [
      '네이버 CDN 썸네일',
      (r) => (productRaw(r, 'THA00U').images.thumb = 'https://shop-phinf.pstatic.net/a.png'),
      /네이버 CDN/,
    ],
    ['지도 경로 밖', (r) => (zoneRaw(r, 'THA00').map.svg = '/maps/THA00.svg'), /\/catalog\/maps\//],
    ['종량제 29일', (r) => (productRaw(r, 'CZE00L').options[0].days = 29), /30일이 아니다/],
    ['zone 라벨 없음', (r) => (zoneRaw(r, 'FRA00').nameKr = ''), /nameKr/],
    ['iso2 없음', (r) => delete zoneRaw(r, 'FRA00').countries[0].iso2, /iso2/],
    [
      'naverUrl 에 옵션 파라미터',
      (r) => (productRaw(r, 'FRA00U').naverUrl += '&option=1'),
      /K2 모양/,
    ],
    ['SKU 가 zone 과 다름', (r) => (productRaw(r, 'FRA00U').sku = 'FRA01U'), /zone\+kind/],
    ['kind 가 U · L 이 아님', (r) => (productRaw(r, 'FRA00U').kind = 'X'), /U · L/],
    ['zones 없음', (r) => delete r.zones, /zones/],
    ['zones 빈 배열', (r) => (r.zones = []), /비어 있다/],
    // 필드 이름이 바뀌면(키 누락) 기본값으로 채우지 않고 멈춘다(F-1)
    [
      '도시 키 이름이 바뀜',
      (r) => renameKey(zoneRaw(r, 'FRA00').countries[0], 'cities', 'cityNames'),
      /cities/,
    ],
    ['통신사 키 누락', (r) => delete zoneRaw(r, 'FRA00').countries[0].operators, /operators/],
    [
      '통신사가 객체 배열',
      (r) => (zoneRaw(r, 'FRA00').countries[0].operators = [{ name: 'Orange' }]),
      /operators/,
    ],
    ['망 키 누락', (r) => delete zoneRaw(r, 'FRA00').countries[0].network, /network/],
    ['핀 키 누락', (r) => delete zoneRaw(r, 'EU340').map.pins, /pins/],
    ['핀 크기 어휘 밖', (r) => (zoneRaw(r, 'EU340').map.pins[0].size = 'large'), /size/],
    ['핀 좌우 어휘 밖', (r) => (zoneRaw(r, 'EU340').map.pins[0].labelDir = 'top'), /labelDir/],
    [
      '핀 위아래 어휘 밖',
      (r) => (zoneRaw(r, 'EU340').map.pins[0].labelShift = 'left'),
      /labelShift/,
    ],
    ['핀 좌표 100% 밖', (r) => (zoneRaw(r, 'EU340').map.pins[0].x = 101), /0~100%/],
    ['부제 키 누락', (r) => delete zoneRaw(r, 'FRA00').subtitle, /subtitle/],
    // 경로 정확 일치 — 다른 SKU · zone 의 이미지를 조용히 쓰지 않는다
    [
      '다른 SKU 썸네일',
      (r) => (productRaw(r, 'CZE00L').images.thumb = '/catalog/thumbs/CZE00U.webp'),
      /\/catalog\/thumbs\/CZE00L\.webp 가 아니다/,
    ],
    [
      'png 썸네일',
      (r) => (productRaw(r, 'CZE00L').images.thumb = '/catalog/thumbs/CZE00L.png'),
      /가 아니다/,
    ],
    [
      '다른 zone 지도',
      (r) => (zoneRaw(r, 'CZE00').map.svg = '/catalog/maps/FRA00.svg'),
      /CZE00\.svg 가 아니다/,
    ],
    [
      'pstatic.net 만 있는 CDN',
      (r) => (productRaw(r, 'THA00U').images.thumb = 'https://pstatic.net/a.webp'),
      /네이버 CDN/,
    ],
    // 옵션 코드 ↔ 용량 · 일수 — export 가 코드를 잘못 파싱하면 다른 칸 가격이 뜬다
    // 칸이 겹치지 않게 맞바꾼다 — 코드 대조만 잡을 수 있는 경우(중복 · 빈칸 검사로는 안 걸린다)
    [
      '두 옵션의 용량을 맞바꿈(1GB 9일 ↔ 2GB 9일)',
      (r) => {
        const opts = productRaw(r, 'CZE00U').options
        const a = opts.find((o: any) => o.code === 'CZE00U01D09V2')
        const b = opts.find((o: any) => o.code === 'CZE00U02D09V2')
        ;[a.cap, b.cap] = [b.cap, a.cap]
      },
      /CZE00U01D09V2\)와 용량 2 · 9일이 어긋난다/,
    ],
    [
      '두 옵션의 일수를 맞바꿈(1GB 8일 ↔ 1GB 9일)',
      (r) => {
        const opts = productRaw(r, 'CZE00U').options
        const a = opts.find((o: any) => o.code === 'CZE00U01D08V2')
        const b = opts.find((o: any) => o.code === 'CZE00U01D09V2')
        ;[a.days, b.days] = [b.days, a.days]
      },
      /CZE00U01D08V2\)와 용량 1 · 9일이 어긋난다/,
    ],
    [
      '일수 한 자리 코드',
      (r) =>
        (productRaw(r, 'CZE00U').options.find((o: any) => o.code === 'CZE00U01D07V2').code =
          'CZE00U01D7V2'),
      /CZE00U01D7V2\)와 용량 1 · 7일이 어긋난다/,
    ],
    [
      '코드가 다른 SKU',
      (r) => (productRaw(r, 'CZE00U').options[0].code = 'FRA00U01D01V2'),
      /모양이 아니다/,
    ],
    [
      '용량 세 자리 코드(미지원)',
      (r) => (productRaw(r, 'CZE00L').options[0].code = 'CZE00L001D30V2'),
      /3자리 코드는 아직 지원하지 않는다/,
    ],
    // 나라
    [
      'zone 안 나라 중복',
      (r) => zoneRaw(r, 'NA022').countries.push({ ...zoneRaw(r, 'NA022').countries[0] }),
      /USA 중복/,
    ],
    [
      '같은 나라 이름이 zone 마다 다름',
      (r) =>
        (zoneRaw(r, 'EU340').countries.find((c: any) => c.iso3 === 'FRA').nameKr = '프랑스공화국'),
      /FRA 가 다른 zone 과 다르다/,
    ],
    ['나라 0', (r) => (zoneRaw(r, 'THA00').countries = []), /나라가 없다/],
    ['iso3 모양', (r) => (zoneRaw(r, 'THA00').countries[0].iso3 = 'TH'), /iso3 모양/],
    [
      '나라 이름 없음',
      (r) => (zoneRaw(r, 'THA00').countries[0].nameKr = ' '),
      /nameKr|이름이 없다/,
    ],
    ['generatedAt 이 날짜가 아님', (r) => (r.meta.generatedAt = '어제'), /ISO 8601/],
    ['generatedAt 시간대 없음', (r) => (r.meta.generatedAt = '2026-09-23T00:00:00'), /ISO 8601/],
    // zone · SKU · kind
    ['zone 코드 모양', (r) => (zoneRaw(r, 'THA00').zone = 'THA0'), /zone 코드 모양/],
    ['zone 중복', (r) => r.zones.push(structuredClone(zoneRaw(r, 'THA00'))), /zone 중복/],
    [
      '같은 kind 상품 둘',
      (r) => zoneRaw(r, 'FRA00').products.push(structuredClone(productRaw(r, 'FRA00U'))),
      /둘 이상|SKU 중복/,
    ],
    ['채널상품번호 0', (r) => (productRaw(r, 'FRA00U').channelProductNo = 0), /채널상품번호/],
    ['옵션 0', (r) => (productRaw(r, 'FRA00U').options = []), /옵션이 없다/],
    ['최종가 소수', (r) => (productRaw(r, 'CZE00U').options[0].finalWon = 900.5), /정수가 아니다/],
    [
      '용량 0(코드도 00 — 코드 대조로는 안 걸린다)',
      (r) => {
        const o = productRaw(r, 'CZE00L').options[0]
        o.cap = 0
        o.code = 'CZE00L00D30V2'
      },
      /용량이 0 이하/,
    ],
    // 최종가 산식 · 채널상품번호 · meta
    [
      '최종가가 산식과 다름(즉시할인 누락)',
      (r) => (productRaw(r, 'CZE00U').options[6].finalWon += 119000),
      /≠ 판매가 119900 − 즉시할인 119000 \+ 옵션가/,
    ],
    [
      '채널상품번호를 다른 SKU 와 같이 씀',
      (r) => {
        const fra = productRaw(r, 'FRA00U')
        fra.channelProductNo = productRaw(r, 'CZE00U').channelProductNo
        fra.naverUrl = expectedNaverUrl(fra.channelProductNo, 'FRA00U')
      },
      /채널상품번호 \d+ 를 CZE00U 도 쓴다/,
    ],
    [
      'zone 하나가 빠진 export(개수 불일치)',
      (r) => r.zones.pop(),
      /meta\.zoneCount: export 는 5 인데 실제는 4/,
    ],
    ['schema 가 k1-v1 이 아님', (r) => (r.meta.schema = 'k1-v2'), /k1-v1 가 아니다/],
    ['schema 키 없음', (r) => delete r.meta.schema, /k1-v1 가 아니다\(키 없음\)/],
    ['schema 가 숫자', (r) => (r.meta.schema = 1), /k1-v1 가 아니다\(\(number\) 1\)/],
    ['schema 가 배열', (r) => (r.meta.schema = ['k1-v1']), /k1-v1 가 아니다\(\(array\)/],
    ['cellCount 키 없음', (r) => delete r.meta.cellCount, /meta\.cellCount: 숫자가 없다/],
    ['skuCount 가 문자열', (r) => (r.meta.skuCount = '7'), /meta\.skuCount: 숫자가 없다/],
    [
      '옵션 칸이 빠진 export(cellCount 불일치 — 60 · 90일 절단)',
      (r) => {
        const p = productRaw(r, 'CZE00U')
        p.options = p.options.filter((o: any) => o.days <= 30)
      },
      /meta\.cellCount: export 는 494 인데 실제는 488/,
    ],
    [
      '상품이 빠진 export(skuCount 불일치)',
      (r) => (zoneRaw(r, 'CZE00').products = zoneRaw(r, 'CZE00').products.slice(0, 1)),
      /meta\.skuCount: export 는 7 인데 실제는 6/,
    ],
    [
      '최종가가 산식보다 작음(옵션가 누락)',
      (r) => (productRaw(r, 'CZE00U').options[6].finalWon -= 100),
      /≠ 판매가 119900 − 즉시할인 119000 \+ 옵션가/,
    ],
    [
      '판매가 키 누락',
      (r) => delete productRaw(r, 'CZE00U').salePriceWon,
      /salePriceWon: 숫자가 없다/,
    ],
    [
      '즉시할인 키 누락',
      (r) => delete productRaw(r, 'CZE00U').immediateDiscountWon,
      /immediateDiscountWon: 숫자가 없다/,
    ],
    [
      '옵션가 키 누락',
      (r) => delete productRaw(r, 'CZE00U').options[0].optionPriceWon,
      /optionPriceWon: 숫자가 없다/,
    ],
    ['없는 날짜(2월 30일)', (r) => (r.meta.generatedAt = '2026-02-30T00:00:00+09:00'), /ISO 8601/],
    // 나라 · 코드 모양 · 핀 범위
    [
      '같은 나라 iso2 가 zone 마다 다름',
      (r) => (zoneRaw(r, 'EU340').countries.find((c: any) => c.iso3 === 'FRA').iso2 = 'FX'),
      /FRA 가 다른 zone 과 다르다/,
    ],
    ['iso2 소문자', (r) => (zoneRaw(r, 'THA00').countries[0].iso2 = 'th'), /THA iso2/],
    ['zone 코드 소문자', (r) => (zoneRaw(r, 'THA00').zone = 'tha00'), /zone 코드 모양/],
    ['핀 y 100% 밖', (r) => (zoneRaw(r, 'EU340').map.pins[0].y = 100.5), /0~100%/],
    ['핀 x 음수', (r) => (zoneRaw(r, 'EU340').map.pins[0].x = -0.1), /0~100%/],
    // 무제한 기간 — 1~30 · 60 · 90 만, 용량마다 같게
    [
      '무제한 30일 빈칸(1~29 만)',
      (r) => {
        const p = productRaw(r, 'FRA00U')
        p.options = p.options.filter((o: any) => !(o.cap === 1 && o.days === 30))
      },
      /매일 1GB 에 30일이 없다/,
    ],
    [
      '무제한 45일',
      (r) => {
        const o = productRaw(r, 'FRA00U').options.find((x: any) => x.cap === 1 && x.days === 60)
        o.days = 45
        o.code = 'FRA00U01D45V2'
      },
      /1~30 · 60 · 90일 밖/,
    ],
    [
      '한 용량만 60일이 빠짐',
      (r) => {
        const p = productRaw(r, 'FRA00U')
        p.options = p.options.filter((o: any) => !(o.cap === 3 && o.days === 60))
      },
      /용량마다 기간 목록이 다르다/,
    ],
  ]

  it.each(cases)('%s', (_name, mutate, pattern) => {
    const raw = fresh()
    mutate(raw)
    expect(() => parseCatalog(raw)).toThrow(CatalogValidationError)
    try {
      parseCatalog(raw)
    } catch (e) {
      expect((e as CatalogValidationError).issues.join('\n')).toMatch(pattern)
    }
  })
})

describe('parseCatalog — 어댑터(K1 → 화면 모델)', () => {
  it('섞여 들어온 옵션 · 상품도 용량 · 일수 오름차순 · 무제한 먼저로 정렬한다', () => {
    const raw = fresh()
    const z = zoneRaw(raw, 'CZE00')
    z.products.reverse()
    z.products[1].options.reverse()
    const cze = zoneByCode(parseCatalog(raw), 'CZE00')!
    expect(kindsOf(cze)).toEqual(['U', 'L'])
    const u = cze.products[0]!.options.map((o) => `${o.cap}/${o.days}`)
    expect(u.slice(0, 2)).toEqual(['1/1', '1/2'])
    expect(u.at(-1)).toBe('3/90')
  })

  it('meta.fixture 가 없으면 실 카탈로그 · 설명 문자열이나 true 면 표본', () => {
    const raw = fresh()
    delete raw.meta.fixture
    expect(parseCatalog(raw).fixture).toBe(false)
    raw.meta.fixture = true
    expect(parseCatalog(raw).fixture).toBe(true)
    raw.meta.fixture = '  '
    expect(parseCatalog(raw).fixture).toBe(false)
  })

  it(`지금 빌드가 쓰는 카탈로그(${ACTIVE_CATALOG_FILE})는 표본이 아니다 — 표본으로는 머지 불가(spec DoD 4)`, () => {
    const cat = parseCatalog(activeRaw())
    expect(cat.fixture).toBe(false)
    expect(ACTIVE_CATALOG_FILE).toBe('server/data/catalog.json')
  })

  it('핀 — labelDir 는 2609 클래스 그대로(right = 라벨이 점 왼쪽) · size · labelShift(없으면 null)', () => {
    const raw = fresh()
    const pins = zoneRaw(raw, 'EU340').map.pins
    pins[0] = { name: '가', x: 10, y: 20, size: 'big', labelDir: 'right', labelShift: 'down' }
    pins[1] = { name: '나', x: 30, y: 40, size: 'normal', labelDir: 'left' }
    pins[2] = { name: '다', x: 50, y: 60, size: 'normal', labelDir: 'left', labelShift: 'up' }
    const got = zoneByCode(parseCatalog(raw), 'EU340')!.map.pins.slice(0, 3)
    expect(got).toEqual([
      { name: '가', x: 10, y: 20, big: true, labelLeft: true, labelShift: 'down' },
      { name: '나', x: 30, y: 40, big: false, labelLeft: false, labelShift: null },
      { name: '다', x: 50, y: 60, big: false, labelLeft: false, labelShift: 'up' },
    ])
  })

  it.each([
    ['표본', fresh],
    ['지금 빌드가 쓰는 카탈로그', activeRaw],
  ])(
    '%s — 2609 에서 cv-pin--right 인 런던은 라벨이 왼쪽, 클래스 없는 파리는 오른쪽',
    (_n, load) => {
      const pins = zoneByCode(parseCatalog(load()), 'EU340')!.map.pins
      expect(pins.find((p) => p.name === '런던')).toMatchObject({
        labelLeft: true,
        labelShift: 'down',
      })
      expect(pins.find((p) => p.name === '파리')).toMatchObject({ labelLeft: false })
    },
  )

  it('통신사 null(미확정)은 null, 빈 배열도 null, 값이 있으면 그대로', () => {
    const raw = fresh()
    const [usa, can] = zoneRaw(raw, 'NA022').countries
    usa.operators = null
    can.operators = []
    const na = zoneByCode(parseCatalog(raw), 'NA022')!
    expect(na.countries.map((c) => c.operators)).toEqual([null, null])
    const fra = zoneByCode(parseCatalog(fresh()), 'FRA00')!
    expect(fra.countries[0]!.operators).toEqual(['Bouygues Telecom', 'Free', 'Orange'])
    expect(fra.countries[0]!.network).toBe('4G/LTE · 5G')
  })
})

describe('파생값', () => {
  const cat = parseCatalog(fresh())
  const cze = zoneByCode(cat, 'CZE00')!

  it('optionFor — 체코 매일 2GB · 7일 = 9,100원(CZE00U02D07V2)', () => {
    const o = optionFor(cze, 'U', 2, 7)!
    expect(o.code).toBe('CZE00U02D07V2')
    expect(o.finalWon).toBe(9100)
    expect(optionFor(cze, 'U', 2, 31)).toBeUndefined()
  })

  it('보조 단가는 내림 — 하루 약 1,300원 · 1GB당 약 2,200원', () => {
    expect(perDayWon(optionFor(cze, 'U', 2, 7)!)).toBe(1300)
    expect(perDayWon(optionFor(cze, 'U', 3, 7)!)).toBe(1814) // 12,700 / 7 = 1,814.28…
    expect(perGbWon(optionFor(cze, 'L', 10, 30)!)).toBe(2200)
    // 반올림과 결과가 갈리는 칸(.5 이상) — 내림이어야 한다
    expect(perDayWon(optionFor(cze, 'U', 2, 6)!)).toBe(1316) // 7,900 / 6 = 1,316.67
    expect(perDayWon(optionFor(cze, 'U', 1, 30)!)).toBe(756) // 22,700 / 30 = 756.67
    expect(perGbWon(optionFor(cze, 'L', 3, 30)!)).toBe(2866) // 8,600 / 3 = 2,866.67
  })

  it('용량은 큰 것부터, 기간은 1~30 · 60 · 90 오름차순', () => {
    expect(capsOf(cze.products[0]!)).toEqual([3, 2, 1])
    expect(capsOf(cze.products[1]!)).toEqual([30, 20, 10, 7, 5, 3, 1])
    const days = daysOf(cze.products[0]!)
    expect(days).toHaveLength(32)
    expect(days.slice(-3)).toEqual([30, 60, 90])
  })

  it('옵션명은 스토어 두 칸을 « · » 로 잇는다', () => {
    expect(optionLabel(optionFor(cze, 'U', 2, 7)!)).toBe('매일 2GB + 소진후 512kbps 무제한 · 7일')
  })

  it('기본 선택 = 무제한 · 매일 1GB · 7일 (D-16) · 종량제만 있으면 가장 작은 용량 · 30일', () => {
    expect(defaultSelection(cze)).toEqual({ kind: 'U', cap: 1, days: 7 })
    const lOnly = { ...cze, products: cze.products.filter((p) => p.kind === 'L') }
    expect(defaultSelection(lOnly)).toEqual({ kind: 'L', cap: 1, days: 30 })
  })

  it('최저가 — 태국 700원 · 유럽 34개국 1,300원(무제한 1일 1GB)', () => {
    expect(lowestWon(zoneByCode(cat, 'THA00')!)).toBe(700)
    expect(lowestWon(zoneByCode(cat, 'EU340')!)).toBe(1300)
  })

  it('나라가 들어간 zone — 단일국 먼저 · 국가 수 오름차순 (D-11)', () => {
    expect(zonesOfCountry(cat, 'CZE').map((z) => z.zone)).toEqual(['CZE00', 'EU340'])
    expect(zonesOfCountry(cat, 'CAN').map((z) => z.zone)).toEqual(['NA022'])
    expect(zonesOfCountry(cat, 'JPN')).toEqual([])
  })

  it('D-11 순서 — 국가 수가 가격보다 먼저, 같은 국가 수는 최저가 → zone 코드', () => {
    // 단일국(900원)보다 싼 2개국 zone 을 만들어도 단일국이 먼저다
    const raw = fresh()
    // 코드 역순으로 넣는다 — 같은 국가 수 · 같은 최저가의 zone 코드 순서를 안정 정렬에 기대지 않고 확인
    addSynthZone(raw, { zone: 'EU023', iso3s: ['CZE', 'FRA'], lowestWon: 500 })
    addSynthZone(raw, { zone: 'EU022', iso3s: ['CZE', 'FRA'], lowestWon: 600 })
    addSynthZone(raw, { zone: 'EU021', iso3s: ['CZE', 'FRA'], lowestWon: 500 })
    addSynthZone(raw, { zone: 'EU031', iso3s: ['CZE', 'FRA', 'THA'], lowestWon: 100 })
    expect(zonesOfCountry(parseCatalog(raw), 'CZE').map((z) => z.zone)).toEqual([
      'CZE00',
      'EU021',
      'EU023',
      'EU022',
      'EU031',
      'EU340',
    ])
  })

  it('최저가 = 무제한 · 종량제 전 옵션의 최솟값(D-11)', () => {
    const raw = fresh()
    setFinalWon(raw, 'CZE00L01D30V2', 300) // 종량제 1GB 를 무제한 1일보다 싸게
    expect(lowestWon(zoneByCode(parseCatalog(raw), 'CZE00')!)).toBe(300)
  })

  it('판매 중인 나라 = zone 나라의 합집합(중복 없음)', () => {
    const iso = countriesOf(cat).map((c) => c.iso3)
    expect(new Set(iso).size).toBe(iso.length)
    expect(iso).toHaveLength(37) // EU340 34(체코 · 프랑스 포함) + 미국 · 캐나다 + 태국
  })

  it('K2 이동 링크 모양', () => {
    expect(expectedNaverUrl(9382876791, 'CZE00U')).toBe(
      'https://smartstore.naver.com/esimmany/products/9382876791?nt_source=esimmany-web&nt_medium=detail&nt_detail=CZE00U',
    )
    expect(cze.products[0]!.naverUrl).toBe(expectedNaverUrl(9382876791, 'CZE00U'))
  })
})
