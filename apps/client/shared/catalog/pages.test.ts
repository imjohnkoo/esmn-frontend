import { describe, expect, it } from 'vitest'
import { formatWon } from './format'
import { countryPageData, zonePageData } from './pages'
import { addSynthZone, fixtureCatalog, fixtureRaw } from './test-data'
import { parseCatalog } from './validate'

const catalog = fixtureCatalog()

describe('formatWon', () => {
  it.each([
    [900, '900원'],
    [9100, '9,100원'],
    [113000, '113,000원'],
    [1234567, '1,234,567원'],
  ])('%d → %s', (n, s) => {
    expect(formatWon(n)).toBe(s)
  })
})

describe('countryPageData (catalog spec S-3 · E2E-12)', () => {
  it('체코 — 단일국 «체코» 먼저, 여러 나라 «유럽 34개국»', () => {
    const d = countryPageData(catalog, 'CZE')!
    expect(d.country).toEqual({ iso3: 'CZE', iso2: 'CZ', nameKr: '체코' })
    expect(d.single.map((c) => c.zone)).toEqual(['CZE00'])
    expect(d.multi.map((c) => c.zone)).toEqual(['EU340'])
    expect(d.single[0]).toMatchObject({
      to: '/products/cze00',
      label: '체코',
      sub: '프라하·체스키크룸로프 등 전지역',
      kinds: ['U', 'L'],
      lowestWon: 900,
      countryCount: 1,
      thumb: '/catalog/thumbs/CZE00U.webp',
    })
  })

  it('5개국 이상 zone 은 나라 나열 대신 썸네일 아랫줄', () => {
    const eu = countryPageData(catalog, 'FRA')!.multi.find((c) => c.zone === 'EU340')!
    expect(eu.sub).toBe('영국·스위스·튀르키예 포함')
    expect(eu.countryCount).toBe(34)
  })

  it('2~4개국 zone 은 나라 이름을 « · » 로 · 5개국부터 썸네일 아랫줄(경계)', () => {
    const raw = fixtureRaw()
    addSynthZone(raw, {
      zone: 'EU041',
      iso3s: ['CZE', 'DEU', 'AUT', 'POL'],
      lowestWon: 3000,
      label: '중부 4개국',
    })
    addSynthZone(raw, {
      zone: 'EU051',
      iso3s: ['CZE', 'DEU', 'AUT', 'POL', 'HUN'],
      lowestWon: 3000,
      label: '중부 5개국',
    })
    const multi = countryPageData(parseCatalog(raw), 'CZE')!.multi
    expect(multi.find((c) => c.zone === 'EU041')!.sub).toBe('체코 · 독일 · 오스트리아 · 폴란드')
    expect(multi.find((c) => c.zone === 'EU051')!.sub).toBe('합성 부제 EU051')
  })

  it('라벨이 이미 나라 나열(«미국·캐나다»)이면 부제는 되풀이 대신 썸네일 아랫줄', () => {
    expect(countryPageData(catalog, 'CAN')!.multi[0]!.sub).toBe('뉴욕·LA·밴쿠버·토론토 등 전지역')
  })

  it('칸 수가 나라 수와 다르면 나열이 아니다(나라 이름) · 같으면(«체코·독일 2개국») 나열(아랫줄)', () => {
    const raw = fixtureRaw()
    addSynthZone(raw, {
      zone: 'EU031',
      iso3s: ['GBR', 'FRA', 'DEU'],
      lowestWon: 3000,
      label: '영국·프랑스',
    })
    addSynthZone(raw, {
      zone: 'EU021',
      iso3s: ['CZE', 'DEU'],
      lowestWon: 3000,
      label: '체코·독일 2개국',
    })
    const cat = parseCatalog(raw)
    expect(countryPageData(cat, 'GBR')!.multi.find((c) => c.zone === 'EU031')!.sub).toBe(
      '영국 · 프랑스 · 독일',
    )
    expect(countryPageData(cat, 'CZE')!.multi.find((c) => c.zone === 'EU021')!.sub).toBe(
      '합성 부제 EU021',
    )
  })

  it('칸이 나라보다 많거나(«미국·캐나다·멕시코» 에 2개국) 적으면 나열이 아니다 · 구분자 «・» «,» 도 칸으로 센다', () => {
    const raw = fixtureRaw()
    addSynthZone(raw, {
      zone: 'NA024',
      iso3s: ['USA', 'CAN'],
      lowestWon: 3000,
      label: '미국·캐나다·멕시코',
    })
    addSynthZone(raw, {
      zone: 'NA025',
      iso3s: ['USA', 'CAN'],
      lowestWon: 3000,
      label: '미국・캐나다',
    })
    addSynthZone(raw, {
      zone: 'NA026',
      iso3s: ['USA', 'CAN'],
      lowestWon: 3000,
      label: '미국, 캐나다',
    })
    const cat = parseCatalog(raw)
    const sub = (z: string) => countryPageData(cat, 'USA')!.multi.find((c) => c.zone === z)!.sub
    expect(sub('NA024')).toBe('미국 · 캐나다')
    expect(sub('NA025')).toBe('합성 부제 NA025')
    expect(sub('NA026')).toBe('합성 부제 NA026')
  })

  it('나열 판정은 칸 수 = 나라 수 — 다른 표기(«터키») · 다른 순서(«캐나다·미국»)도 나열로 본다', () => {
    const raw = fixtureRaw()
    addSynthZone(raw, {
      zone: 'EU025',
      iso3s: ['TUR', 'GRC'],
      lowestWon: 3000,
      label: '터키·그리스',
    })
    addSynthZone(raw, {
      zone: 'NA023',
      iso3s: ['CAN', 'USA'],
      lowestWon: 3000,
      label: '미국·캐나다',
    })
    const cat = parseCatalog(raw)
    expect(countryPageData(cat, 'TUR')!.multi.find((c) => c.zone === 'EU025')!.sub).toBe(
      '합성 부제 EU025',
    )
    expect(countryPageData(cat, 'CAN')!.multi.find((c) => c.zone === 'NA023')!.sub).toBe(
      '합성 부제 NA023',
    )
  })

  it('단일국 zone 이 없는 나라는 single 이 비어 있고, 머리는 그 나라(첫 zone 의 첫 나라가 아니다)', () => {
    const d = countryPageData(catalog, 'DEU')!
    expect(d.country).toEqual({ iso3: 'DEU', iso2: 'DE', nameKr: '독일' })
    expect(d.single).toEqual([])
    expect(d.multi.map((c) => c.zone)).toEqual(['EU340'])
  })

  it('«{나라}만 가요» 묶음에는 단일국 zone 만, 여러 나라 묶음에는 여러 나라 zone 만', () => {
    for (const iso3 of ['CZE', 'FRA', 'USA', 'DEU']) {
      const d = countryPageData(catalog, iso3)!
      for (const c of d.single) expect(c.countryCount, `${iso3} ${c.zone}`).toBe(1)
      for (const c of d.multi) expect(c.countryCount, `${iso3} ${c.zone}`).toBeGreaterThan(1)
    }
  })

  it('zonePageData — 모르는 zone 은 null(→ 404), 아는 zone 은 그 zone', () => {
    expect(zonePageData(catalog, 'XXX00')).toBeNull()
    expect(zonePageData(catalog, 'CZE00')!.zone).toBe('CZE00')
  })

  it('판매하지 않는 나라 · 모르는 코드는 null(→ 404)', () => {
    expect(countryPageData(catalog, 'JPN')).toBeNull()
    expect(countryPageData(catalog, 'XXX')).toBeNull()
  })

  it('응답에 옵션 · 판매가가 없다(카드에 필요한 조각만)', () => {
    const json = JSON.stringify(countryPageData(catalog, 'FRA'))
    expect(json).not.toMatch(/options|salePrice|immediateDiscount|naverUrl/)
  })
})
