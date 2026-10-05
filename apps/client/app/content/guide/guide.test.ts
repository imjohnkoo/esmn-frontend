import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STATIC_ROUTES } from '#shared/catalog/seo'
import { ANDROID_GUIDE } from './android'
import { GUIDE_PAGES } from './common'
import {
  FIGURE_SCALE,
  FIGURE_VERSION,
  FIGURE_WIDTH,
  GUIDE_FIGURES,
  figureSize,
  figureSrc,
  type FigureKey,
} from './figures'
import { guidePlainText, parseGuideInline } from './inline'
import { IOS_GUIDE } from './ios'
import type { GuideContent, GuideStep } from './types'

/** client-guide spec F-2 · F-3 · F-6 · F-8 · DoD 2 · 5 · 6 · 불변식 */
const GUIDES = { ios: IOS_GUIDE, android: ANDROID_GUIDE } as const
const CLIENT = new URL('../../../', import.meta.url)
const read = (p: string) => readFileSync(new URL(p, CLIENT), 'utf8')

function stepsOf(g: GuideContent): GuideStep[] {
  return [...g.step1.methods.flatMap((m) => m.steps), ...g.step2.steps, ...g.step3.steps]
}

/** 콘텐츠 안 모든 문장(표기 포함) — 파서 · 금지어 검사 대상 */
function strings(g: GuideContent): string[] {
  const out: string[] = []
  const walk = (v: unknown) => {
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) v.forEach(walk)
    else if (v && typeof v === 'object') Object.values(v).forEach(walk)
  }
  walk(g)
  return out
}

function figuresOf(g: GuideContent): FigureKey[] {
  return [...stepsOf(g).map((s) => s.figure), ...g.help.faqs.map((f) => f.figure)].filter(
    (k): k is FigureKey => !!k,
  )
}

describe('인라인 표기 파서', () => {
  it('누를 이름 · 경로 뒤 한글 조사는 같은 토막에 붙는다(줄이 갈려도 조사가 떨어지지 않게)', () => {
    expect(parseGuideInline('[[설정 › 셀룰러]]에서 {{eSIM 추가}}를 눌러요.')).toEqual([
      { t: 'path', parts: ['설정', '셀룰러'], particle: '에서' },
      { t: 'text', v: ' ' },
      { t: 'ui', v: 'eSIM 추가', particle: '를' },
      { t: 'text', v: ' 눌러요.' },
    ])
  })
  it('굵게 · 줄바꿈 금지 · 조사 없는 이름', () => {
    expect(parseGuideInline('**5G**나 ((Wi-Fi나)) {{계속}}.')).toEqual([
      { t: 'b', v: '5G' },
      { t: 'text', v: '나 ' },
      { t: 'nw', v: 'Wi-Fi나' },
      { t: 'text', v: ' ' },
      { t: 'ui', v: '계속', particle: '' },
      { t: 'text', v: '.' },
    ])
  })
  it('짝이 안 맞는 표기 · 빈 경로 토막은 던진다', () => {
    expect(() => parseGuideInline('{{계속을 눌러요')).toThrow()
    expect(() => parseGuideInline('**굵게')).toThrow()
    expect(() => parseGuideInline('[[설정 › ]]')).toThrow()
  })
  it('표기를 걷은 글자 — 경로는 « › » 로 잇는다', () => {
    expect(guidePlainText('[[설정 › 셀룰러 › 셀룰러 데이터]]를 **메인**으로')).toBe(
      '설정 › 셀룰러 › 셀룰러 데이터를 메인으로',
    )
  })
})

describe.each(Object.entries(GUIDES))('%s 가이드 콘텐츠', (os, g) => {
  it('모든 문장이 파서를 통과한다(표기 짝 · 빈 경로 0)', () => {
    for (const s of strings(g)) expect(() => parseGuideInline(s), s).not.toThrow()
  })

  it('제목 · 배지 · 태그 · 눈썹 · 머리 설명은 글자 그대로 그린다 — 인라인 표기 0(표기는 문장 칸에만)', () => {
    const plain = [
      g.eyebrow,
      g.title,
      ...g.lede,
      ...g.checks.items.map((c) => c.title),
      g.checks.alert.title,
      ...[g.step1, g.step2, g.step3, g.help].flatMap((s) => [s.badge, s.title]),
      ...g.step1.methods.flatMap((m) => [m.tag, m.badge, m.title]),
      ...g.help.faqs.flatMap((f) => (f.link ? [f.link.label] : [])),
    ]
    for (const t of plain) expect(t, t).not.toMatch(/\{\{|\[\[|\*\*|\(\(/)
  })

  it('단계 수가 2609 판과 같다(spec DoD 5)', () => {
    const want =
      os === 'ios'
        ? { a: 4, b: 2, c: 3, step2: 7, step3: 6, faq: 6 }
        : { a: 4, b: 2, c: 3, step2: 5, step3: 3, faq: 5 }
    expect({
      a: g.step1.methods[0]!.steps.length,
      b: g.step1.methods[1]!.steps.length,
      c: g.step1.methods[2]!.steps.length,
      step2: g.step2.steps.length,
      step3: g.step3.steps.length,
      faq: g.help.faqs.length,
    }).toEqual(want)
    expect(g.step1.methods.map((m) => m.tag)).toEqual(['방법 A', '방법 B', '방법 C'])
    expect(g.checks.items).toHaveLength(4)
  })

  it('화면 창 수 — 아이폰 24 · 안드로이드 17(같은 화면은 파일을 함께 쓴다) · 상태 표시줄 그림 1', () => {
    expect(figuresOf(g)).toHaveLength(os === 'ios' ? 24 : 17)
    expect(stepsOf(g).filter((s) => s.status === os)).toHaveLength(1)
    expect(stepsOf(g).every((s) => !(s.figure && s.status))).toBe(true)
  })

  it('삭제 경고가 확인 구간 맨 끝 경고 박스에 있다(맨 앞 — 설치 단계보다 먼저)', () => {
    expect(g.checks.alert.title).toBe('설치한 eSIM은 여행이 끝날 때까지 지우지 마세요')
    expect(g.checks.alert.body).toContain('다시 설치할 수 없고 재발급도 되지 않아요')
  })

  it('eSIM 카피 불변식 — 자정 기준 서술 0 · «현지에서 처음 연결된 순간부터 24시간 단위» · 미리 설치로는 시작 안 함', () => {
    const all = strings(g).map(guidePlainText).join('\n')
    expect(all).not.toMatch(/자정|0시 기준|날짜가 바뀌/)
    expect(all).toContain('현지에서 처음 연결된 순간부터 24시간 단위로 차감돼요')
    expect(all).toContain('설치만으로는 사용일수가 시작되지 않아요')
    expect(all).not.toMatch(/재개통|나라마다 다시/)
  })

  it('공급사 값 · 개인정보 0 — 주소 · 코드 값 · 전화번호 · URL 을 본문에 적지 않는다', () => {
    const all = strings(g).map(guidePlainText).join('\n')
    expect(all).not.toMatch(/https?:\/\/|LPA:1\$|\.io\b|\b01[016789]-?\d{3,4}-?\d{4}\b/)
  })

  it('제품명 표기 «아이폰»(client-shell D-52) — 본문에 «iPhone» 0', () => {
    const all = strings(g).map(guidePlainText).join('\n')
    expect(all).not.toContain('iPhone')
  })
})

describe('화면 창 매니페스트 ↔ PNG (spec F-3 · DoD 2)', () => {
  const used = new Set([...figuresOf(IOS_GUIDE), ...figuresOf(ANDROID_GUIDE)])
  const keys = Object.keys(GUIDE_FIGURES) as FigureKey[]

  it('매니페스트의 창은 전부 어딘가에서 쓴다(안 쓰는 창 0)', () => {
    expect(keys.filter((k) => !used.has(k))).toEqual([])
  })

  it('모든 창에 대체 글이 있고, 키는 파일 이름으로 쓸 수 있는 글자만', () => {
    for (const k of keys) {
      expect(GUIDE_FIGURES[k].alt.length, k).toBeGreaterThan(5)
      expect(k).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('PNG 가 전부 있고 크기가 매니페스트와 같다(가로 368 × 3 · 세로 = 가로 ÷ 비율) · 매니페스트 밖 파일 0', () => {
    const dir = new URL('public/guide-screens/', CLIENT)
    const files = readdirSync(dir).sort()
    expect(files).toEqual(keys.map((k) => figureSrc(k).split('/').pop()!).sort())
    for (const k of keys) {
      const buf = readFileSync(new URL(`${k}.${FIGURE_VERSION}.png`, dir))
      expect(buf.subarray(1, 4).toString('ascii'), k).toBe('PNG')
      const { width, height } = figureSize(k)
      expect([buf.readUInt32BE(16), buf.readUInt32BE(20)], k).toEqual([
        width * FIGURE_SCALE,
        height * FIGURE_SCALE,
      ])
    }
    expect(FIGURE_WIDTH).toBe(368)
  })

  it('src 는 /guide-screens/<키>.<버전>.png (CloudFront 캐시 무효화가 필요 없게 버전 접미 — Proposal K4)', () => {
    expect(figureSrc('ios-done')).toBe(`/guide-screens/ios-done.${FIGURE_VERSION}.png`)
  })
})

describe('사이트 연결 (spec F-6 · F-7 · F-8)', () => {
  it('OS 가이드 경로가 정적 라우트(프리렌더 · sitemap)에 있다', () => {
    for (const page of Object.values(GUIDE_PAGES))
      expect(STATIC_ROUTES as readonly string[]).toContain(page.to)
  })

  it('발급 화면 카드가 사이트 안 OS 가이드를 새 탭으로 연다(D-5)', () => {
    const view = read('app/pages/view/[orderId].vue')
    for (const os of ['ios', 'android'] as const) {
      const card = view.match(
        new RegExp(`<NLinkCard[^>]*:href="GUIDE_PAGES\\.${os}\\.to"[^>]*>`, 's'),
      )?.[0]
      expect(card, os).toBeTruthy()
      expect(card).toMatch(/\sexternal\s/)
    }
  })

  it('외부 가이드 사이트(esimmany.super.site)로 나가는 링크 0 — app · shared · server 전체', () => {
    const roots = ['app', 'shared', 'server']
    const hits: string[] = []
    const walk = (rel: string) => {
      for (const e of readdirSync(new URL(`${rel}/`, CLIENT), { withFileTypes: true })) {
        const p = `${rel}/${e.name}`
        if (e.isDirectory()) walk(p)
        else if (/\.(vue|ts|json)$/.test(e.name) && !p.endsWith('guide.test.ts')) {
          if (read(p).includes('super.site')) hits.push(p)
        }
      }
    }
    roots.forEach(walk)
    expect(hits).toEqual([])
  })
})
