import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { optionLabel, zoneByCode } from '#shared/catalog/derive'
import { activeCatalog, fixtureCatalog } from '#shared/catalog/test-data'
import { BANNED_COPY } from '#shared/catalog/test-copy'
import { readSource, stringsOf } from '#shared/catalog/test-source'
import type { Kind, ZoneView } from '#shared/catalog/types'
import * as copy from './product-detail'
import {
  HOW_TO,
  REFUND,
  USAGE,
  USAGE_EXAMPLE_DAYS,
  coverageLead,
  coverageTitle,
  daysPhrase,
  faqItems,
  heroChecks,
  heroLead,
  periodHint,
  planSub,
  purchaseBody,
  usageNote,
  usageTimeline,
} from './product-detail'

const catalog = fixtureCatalog()
/** 실제로 나가는 카탈로그 — 문안 함수가 K1 라벨 · 부제 · 나라 이름을 문장에 넣으므로 전 zone 을 본다 */
const active = activeCatalog()

/** 문자열 · 배열 · 객체 안의 글자를 전부 모은다(링크 경로는 문안이 아니라 뺀다) */
function strings(v: unknown): string[] {
  if (typeof v === 'string') return v.startsWith('/') ? [] : [v]
  if (Array.isArray(v)) return v.flatMap(strings)
  if (v && typeof v === 'object') return Object.values(v).flatMap(strings)
  return []
}

/** 내보낸 함수마다 부르는 법 — 새 함수를 내보내면 아래 «빠짐없이» 테스트가 여기 추가를 요구한다 */
const CALLS: Record<string, (zone: ZoneView, kind: Kind) => unknown> = {
  heroLead: (z, k) => heroLead(z, k),
  heroChecks: (z, k) => heroChecks(z, k),
  daysPhrase: (z, k) => daysPhrase(daysOf(z, k)),
  periodHint: (z, k) => periodHint(k, daysOf(z, k)),
  planTitle: (z, k) => capsOf(z, k).map((c) => copy.planTitle(k, c)),
  planSub: (_z, k) => copy.planSub(k, '1,300원'),
  purchaseBody: (z, k) => optionsOf(z, k).map((o) => purchaseBody(optionLabel(o))),
  countdownText: () => [3, 2, 1, 0].map(copy.countdownText),
  coverageTitle: (z) => copy.coverageTitle(z),
  coverageLead: (z) => copy.coverageLead(z),
  faqItems: (z, k) => faqItems(z, k),
  usageTimeline: (_z, k) => usageTimeline(k),
  usageNote: (_z, k) => usageNote(k),
}
const optionsOf = (z: ZoneView, k: Kind) => z.products.find((p) => p.kind === k)?.options ?? []
const capsOf = (z: ZoneView, k: Kind) => [...new Set(optionsOf(z, k).map((o) => o.cap))]
const daysOf = (z: ZoneView, k: Kind) => [...new Set(optionsOf(z, k).map((o) => o.days))]

/** 상세 화면에 나오는 문안 전부 — 상수 전부 + 함수 전부(zone × 종류) */
function allCopy(zone: ZoneView, kind: Kind): string {
  const constants = Object.values(copy).filter((v) => typeof v !== 'function')
  const calls = Object.values(CALLS).map((call) => call(zone, kind))
  return strings([...constants, ...calls]).join('\n')
}

/** 카탈로그 화면 .vue — <template> 원문과 <script> 의 문자열(주석 제외 · test-source.ts) */
const VUE_FILES = [
  'app/components/catalog/ProductSections.vue',
  'app/components/catalog/PurchaseSheet.vue',
  'app/components/catalog/PlanCards.vue',
  'app/components/catalog/PeriodSelect.vue',
  'app/components/catalog/ZoneCard.vue',
  'app/components/catalog/ZoneMap.vue',
  'app/components/catalog/SearchField.vue',
  'app/pages/products/[zone].vue',
  'app/pages/countries/[iso3].vue',
  'app/pages/index.vue',
  'app/pages/search.vue',
  'app/components/shell/ErrorPanel.vue',
  'app/error.vue',
]
const APP = fileURLToPath(new URL('../../', import.meta.url))
const vueParts = (file: string) => {
  const { template, script } = readSource(`${APP}${file}`)
  if (!template) throw new Error(`${file}: <template> 가 없다`)
  return { template, scriptText: stringsOf(script).join('\n') }
}
const template = (file: string) => vueParts(file).template

const BANNED = BANNED_COPY
/** 환불 영역 — «발급 전 전액» 만(A5) */
const REFUND_BANNED = /수수료|3,500|3500|반품|불가|발급 후|발급 뒤|공제|차감|청약철회/

const cases = catalog.zones.flatMap((z) => z.products.map((p) => [z.zone, p.kind] as const))
const activeCases = active.zones.flatMap((z) => z.products.map((p) => [z.zone, p.kind] as const))

describe('상세 문안 불변식 (catalog spec 불변식 5 · F-7)', () => {
  it('내보낸 함수를 빠짐없이 검사한다(새 문안 함수는 CALLS 에 넣어야 통과)', () => {
    const fns = Object.entries(copy)
      .filter(([, v]) => typeof v === 'function')
      .map(([k]) => k)
      .sort()
    expect(fns).toEqual(Object.keys(CALLS).sort())
  })

  it('실 카탈로그 전 zone × 종류 — 금지어 없음(상수 · 함수 전부 · K1 라벨 · 부제 · 나라 이름 포함)', () => {
    const found = activeCases.flatMap(([code, kind]) => {
      const text = allCopy(zoneByCode(active, code)!, kind)
      return BANNED.flatMap(([re, why]) => {
        const m = text.match(re)?.[0]
        return m ? [`${code} ${kind}: «${m}» — ${why}`] : []
      })
    })
    expect(found).toEqual([])
  })

  it.each(cases)('표본 %s %s — 금지어 없음', (code, kind) => {
    const text = allCopy(zoneByCode(catalog, code)!, kind)
    for (const [re, why] of BANNED) expect(text.match(re)?.[0] ?? null, why).toBeNull()
  })

  it.each(VUE_FILES)('%s — 템플릿 · 스크립트 문자열에 직접 쓴 문구에도 금지어 없음', (file) => {
    const { template: tpl, scriptText } = vueParts(file)
    for (const [re, why] of BANNED) {
      expect(tpl.match(re)?.[0] ?? null, `템플릿 ${why}`).toBeNull()
      expect(scriptText.match(re)?.[0] ?? null, `스크립트 ${why}`).toBeNull()
    }
  })

  it('실 카탈로그 종량제 전부 — 무제한 문구(512kbps · 무제한 · 소진 후)가 없다', () => {
    const found = activeCases
      .filter(([, k]) => k === 'L')
      .flatMap(([code]) => {
        const z = zoneByCode(active, code)!
        const text = strings([
          heroLead(z, 'L'),
          heroChecks(z, 'L'),
          periodHint('L', daysOf(z, 'L')),
          capsOf(z, 'L').map((c) => copy.planTitle('L', c)),
          copy.planSub('L', '2,200원'),
          faqItems(z, 'L'),
          usageTimeline('L'),
          usageNote('L'),
        ]).join('\n')
        const m = text.match(/512kbps|무제한|소진\s?후/)?.[0]
        return m ? [`${code}: «${m}»`] : []
      })
    expect(found).toEqual([])
  })

  it.each(cases.filter(([, k]) => k === 'L'))(
    '%s 종량제 — 무제한 문구(512kbps · 무제한 · 소진 후)가 없다',
    (code) => {
      const z = zoneByCode(catalog, code)!
      const text = strings([
        heroLead(z, 'L'),
        heroChecks(z, 'L'),
        periodHint('L', daysOf(z, 'L')),
        capsOf(z, 'L').map((c) => copy.planTitle('L', c)),
        copy.planSub('L', '2,200원'),
        faqItems(z, 'L'),
      ]).join('\n')
      expect(text).not.toMatch(/512kbps|무제한|소진\s?후/)
    },
  )

  it('환불은 «발급 전 전액» 만 — 수수료 · 발급 후 조건 없음(A5)', () => {
    for (const code of catalog.zones.map((z) => z.zone)) {
      for (const kind of ['U', 'L'] as const) {
        const faq = faqItems(zoneByCode(catalog, code)!, kind)
          .map((f) => `${f.q} ${f.a}`)
          .join(' ')
        expect(faq).not.toMatch(/환불|반품|수수료|3,500|돌려받을 수 없/)
      }
    }
    expect(REFUND.text).toBe('발급 전이면 전액 환불해 드려요.')
    // 환불 영역 전체 — 제목 · 본문 · 링크 문구 + 섹션 템플릿
    expect(strings(REFUND).join(' ')).not.toMatch(REFUND_BANNED)
    const section = template('app/components/catalog/ProductSections.vue').match(
      /<section[^>]*sec-refund[\s\S]*?<\/section>/,
    )?.[0]
    expect(section).toBeDefined()
    expect(section).not.toMatch(REFUND_BANNED)
  })

  it('여러 나라 zone 은 자동 전환 FAQ 가 있고, 단일국에는 없다', () => {
    const eu = faqItems(zoneByCode(catalog, 'EU340')!, 'U').at(-1)!
    expect(eu.a).toContain('34개국에서 자동으로 연결돼요')
    expect(eu.a).toContain('재발급도 없어요')
    expect(
      faqItems(zoneByCode(catalog, 'CZE00')!, 'U').some((f) => f.q.includes('나라를 옮기면')),
    ).toBe(false)
  })

  it('무제한은 512kbps, 종량제는 «사용이 끝나요»', () => {
    const cze = zoneByCode(catalog, 'CZE00')!
    expect(allCopy(cze, 'U')).toContain('512kbps')
    expect(
      faqItems(cze, 'L')
        .map((f) => f.a)
        .join(' '),
    ).toContain('사용이 끝나요')
  })

  it('사용일수 설명은 «처음 연결된 때부터 24시간»', () => {
    expect(USAGE.lead).toContain('처음 연결된 때부터 24시간')
  })

  it('K2 구매 문구는 Proposal 원문 그대로', () => {
    expect(purchaseBody('매일 2GB + 소진후 512kbps 무제한 · 7일')).toBe(
      '결제사 도입 준비 중입니다. 네이버 스마트스토어에서 구매 가능합니다. 스토어에서 ‹매일 2GB + 소진후 512kbps 무제한 · 7일› 옵션을 골라 주세요',
    )
  })
})

describe('히어로 문구 (S-4 — 고른 종류를 따른다)', () => {
  it('단일국 · 4개국 이하 · 5개국 이상', () => {
    expect(heroLead(zoneByCode(catalog, 'CZE00')!, 'U')).toBe('체코 어디서나, 데이터 넉넉하게')
    expect(heroLead(zoneByCode(catalog, 'CZE00')!, 'L')).toBe(
      '체코 어디서나, 필요한 만큼 나눠 써요',
    )
    expect(heroLead(zoneByCode(catalog, 'NA022')!, 'U')).toBe('미국 · 캐나다, 한 번 설치로 2개국')
    expect(heroLead(zoneByCode(catalog, 'EU340')!, 'U')).toBe(
      '영국·스위스·튀르키예 포함, 한 번 설치로 34개국',
    )
  })

  it('무제한 체크 3줄 — 용량 · 기간 · 발급', () => {
    expect(heroChecks(zoneByCode(catalog, 'CZE00')!, 'U')).toEqual([
      '매일 1·2·3GB, 다 쓰면 512kbps 로 계속',
      '1~30일 · 60·90일 중에서 골라요',
      '결제하면 보통 1~2분 안에 카카오톡으로 발급 링크가 와요',
    ])
  })

  it('종량제 체크 3줄 — 총량 · 하루 한도 없음 · 발급(무제한 문구 없음)', () => {
    expect(heroChecks(zoneByCode(catalog, 'CZE00')!, 'L')).toEqual([
      '30일 동안 총 1~30GB 를 나눠 써요',
      '하루 한도가 없고 다 쓰면 끝나요',
      '결제하면 보통 1~2분 안에 카카오톡으로 발급 링크가 와요',
    ])
  })

  it('종량제 용량이 하나면 범위로 쓰지 않는다(«총 5~5GB» 금지)', () => {
    const cze = structuredClone(zoneByCode(catalog, 'CZE00')!)
    const l = cze.products.find((p) => p.kind === 'L')!
    l.options = l.options.filter((o) => o.cap === 5)
    expect(heroChecks(cze, 'L')[0]).toBe('30일 동안 총 5GB 를 나눠 써요')
  })

  it('기간 안내는 실제 일수로 — 60 · 90일이 없으면 약속하지 않는다', () => {
    const all = [...Array.from({ length: 30 }, (_, i) => i + 1), 60, 90]
    expect(periodHint('U', all)).toBe(
      '1~30일은 하루 단위로, 그 밖에는 60일 · 90일을 고를 수 있어요.',
    )
    expect(
      periodHint(
        'U',
        all.filter((d) => d !== 90),
      ),
    ).toBe('1~30일은 하루 단위로, 그 밖에는 60일을 고를 수 있어요.')
    expect(periodHint('U', all.slice(0, 30))).toBe('1~30일 중 하루 단위로 고를 수 있어요.')
    expect(periodHint('L', [30])).toContain('처음 연결된 때부터 24시간 단위')
  })

  it.each(['U', 'L'] as const)(
    '사용일수 예시(%s) — 모든 점에 시각 · 끝 = 연결 + 일수 × 24시간 · «시작 날짜»',
    (kind) => {
      const n = USAGE_EXAMPLE_DAYS[kind]
      const t = usageTimeline(kind)
      for (const p of t) expect(p.text).toMatch(/오후 3시/)
      expect(t[0]).toEqual({ date: '3월 1일', text: '오후 3시 연결' })
      expect(t.at(-1)).toEqual({ date: `3월 ${1 + n}일`, text: '오후 3시 끝' })
      expect(usageNote(kind)).toContain(`${n}일 상품을 3월 1일 오후 3시에 처음 연결한 경우`)
      expect(usageNote(kind)).toContain('시작 날짜') // 발급 화면 이름과 같은 말
    },
  )

  it('종량제 예시는 30일(종량제는 30일 상품뿐)', () => {
    expect(USAGE_EXAMPLE_DAYS.L).toBe(30)
  })

  it('도착 안내 — 두 회선 모두 켜기 + 요금 경고 두 줄(카피 규칙 3 · 빼지 않는다)', () => {
    expect(HOW_TO.steps.at(-1)).toBe('도착하면 한국 회선과 이 회선을 모두 켜요')
    expect(HOW_TO.steps).toContain('출국 전에 설치하고, 도착할 때까지는 이 회선을 꺼 두세요')
    expect(HOW_TO.warnings).toEqual([
      '한국 회선의 데이터 로밍은 꺼 두세요',
      '셀룰러 데이터 전환 허용은 꺼 두세요',
    ])
  })

  it('커버리지 — 단일국 · 여러 나라 문구(spec S-4 원문)', () => {
    const eu = zoneByCode(catalog, 'EU340')!
    const cze = zoneByCode(catalog, 'CZE00')!
    expect(coverageTitle(eu)).toBe('34개국에서 하나의 eSIM 으로')
    expect(coverageLead(eu)).toBe(
      '나라를 옮겨도 같은 eSIM 을 그대로 써요. 폰이 알아서 그 나라 통신사로 바꿔요.',
    )
    expect(coverageTitle(cze)).toBe('체코 전 지역에서 써요')
    expect(coverageLead(cze)).toBe('폰이 알아서 현지 통신사에 연결해요.')
  })

  it('실 카탈로그 — 여러 나라 zone 은 전부 자동 전환 FAQ(답 원문 그대로), 단일국은 없다', () => {
    for (const z of active.zones)
      for (const kind of ['U', 'L'] as const) {
        const f = faqItems(z, kind).find((x) => x.q === '나라를 옮기면 다시 설정해야 하나요?')
        if (z.countries.length > 1)
          expect(f?.a, `${z.zone} ${kind}`).toBe(
            `아니요. 같은 eSIM 으로 ${z.countries.length}개국에서 자동으로 연결돼요. 따로 할 일도, 재발급도 없어요.`,
          )
        else expect(f, `${z.zone} ${kind}`).toBeUndefined()
      }
  })

  it.each(['U', 'L'] as const)(
    '설치 FAQ(%s) — 두 회선 켜기 + 한국 회선 요금 경고 두 줄(카피 규칙 3 · 원문 그대로)',
    (kind) => {
      const a = faqItems(zoneByCode(catalog, 'CZE00')!, kind).find(
        (f) => f.q === '설치는 언제 하면 되나요?',
      )!.a
      expect(a).toBe(
        '발급받은 뒤 언제든 설치할 수 있어요. 출국 전에 미리 설치해 두고, 도착하면 한국 회선과 함께 켜세요. 한국 회선의 데이터 로밍과 셀룰러 데이터 전환 허용은 꺼 두세요.',
      )
    },
  )

  it.each(['U', 'L'] as const)('사용일수 예시(%s) 전체 — 연결 · 2일째 · N일째 · 끝', (kind) => {
    const n = USAGE_EXAMPLE_DAYS[kind]
    expect(usageTimeline(kind)).toEqual([
      { date: '3월 1일', text: '오후 3시 연결' },
      { date: '3월 2일', text: '오후 3시 · 2일째' },
      { date: `3월 ${n}일`, text: `오후 3시 · ${n}일째` },
      { date: `3월 ${n + 1}일`, text: '오후 3시 끝' },
    ])
  })

  it('무제한 — 카드 부제 · FAQ 에 512kbps', () => {
    expect(planSub('U', '700원')).toContain('다 쓰면 512kbps 로 계속')
    const faq = faqItems(zoneByCode(catalog, 'CZE00')!, 'U').find((f) =>
      f.q.includes('매일 데이터를 다 쓰면'),
    )!
    expect(faq.a).toContain('512kbps')
  })

  it('기간 문구', () => {
    expect(daysPhrase([...Array.from({ length: 30 }, (_, i) => i + 1), 60, 90])).toBe(
      '1~30일 · 60·90일',
    )
    expect(daysPhrase([30])).toBe('30일')
    expect(daysPhrase([1, 2, 3])).toBe('1~3일')
  })
})
