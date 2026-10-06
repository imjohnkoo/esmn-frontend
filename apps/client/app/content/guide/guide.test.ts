import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { STATIC_ROUTES } from '#shared/catalog/seo'
import { ANDROID_GUIDE } from './android'
// 생성 스크립트의 지문 계산을 그대로 쓴다(같은 계산이어야 대조가 된다)
import { guideFigureHash, guideInputsHash, sha256 } from '../../../scripts/guide-screens/lock.mjs'
import * as COMMON from './common'
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
import lockJson from './figures.lock.json'
import { guideGolden } from './golden'
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
  it('짝이 안 맞는 표기 · 빈 경로 토막 · 표기 안 표기 · 빈 이름 · 남는 괄호는 던진다', () => {
    expect(() => parseGuideInline('{{계속을 눌러요')).toThrow()
    expect(() => parseGuideInline('**굵게')).toThrow()
    expect(() => parseGuideInline('[[설정 › ]]')).toThrow()
    expect(() => parseGuideInline('{{eSIM **추가**}}를')).toThrow()
    expect(() => parseGuideInline('[[설정 › {{셀룰러}}]]에서')).toThrow()
    expect(() => parseGuideInline('{{a}}}')).toThrow()
    expect(() => parseGuideInline('{{ }}를')).toThrow()
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

  it('단계마다 붙는 화면이 2609 판 순서 그대로(원본 <figure data-screen> 순서 · 상태 표시줄 자리 포함)', () => {
    const want =
      os === 'ios'
        ? [
            'ios-cellular',
            'ios-transfer',
            'ios-esim-setup',
            'ios-qr-scan',
            'web-qr',
            'ios-longpress',
            'web-codes-ios',
            'ios-qr-scan',
            'ios-manual',
            'ios-activate-alert',
            'ios-activate-ready',
            'ios-where',
            'ios-plan',
            'ios-done',
            'ios-cellular',
            'ios-line',
            'ios-lock-noti',
            'ios-travel-choice',
            'ios-lowdata',
            'ios-line',
            'ios-celldata',
            'status',
          ]
        : [
            'aos-connections',
            'aos-sim',
            'aos-method',
            'aos-scan',
            'web-qr',
            'aos-scan',
            'web-codes-aos',
            'aos-scan',
            'aos-code',
            'aos-confirm',
            'aos-sim',
            'aos-sim',
            'aos-sim',
            'aos-roaming',
            'aos-data-sheet',
            'aos-roaming',
            'status',
          ]
    expect(stepsOf(g).map((s) => (s.figure ? GUIDE_FIGURES[s.figure].screen : 'status'))).toEqual(
      want,
    )
    const faqWant =
      os === 'ios'
        ? ['ios-error', 'ios-cellular', '-', '-', 'ios-network', '-']
        : ['-', '-', '-', 'aos-carrier', '-']
    expect(g.help.faqs.map((f) => (f.figure ? GUIDE_FIGURES[f.figure].screen : '-'))).toEqual(
      faqWant,
    )
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
    expect(all).not.toMatch(
      /자정|0시|날짜가 바뀌|매일|하루씩|그때부터 사용일수|설치하면 사용일수가 시작|켜면 사용일수가 시작/,
    )
    expect(all).toContain('현지에서 처음 연결된 순간부터 24시간 단위로 차감돼요')
    expect(all).toContain('설치만으로는 사용일수가 시작되지 않아요')
    expect(all).toContain('미리 설치해도 사용일수는 시작되지 않아요')
    expect(all).toContain('한국에서 켜 두어도 사용일수는 시작되지 않고')
    expect(all).not.toMatch(/재개통|나라마다 다시|국가마다 다시/)
  })

  it('공급사 값 · 개인정보 0 — 주소 · 도메인 · 코드 값 · 전화번호 · 이메일 · ICCID · URL 을 본문에 적지 않는다', () => {
    const all = strings(g).map(guidePlainText).join('\n')
    expect(all).not.toMatch(/https?:\/\/|LPA:1\$|\b[a-z0-9-]+\.(com|net|io|global|kr|co|org)\b/i)
    expect(all).not.toMatch(
      /\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b|[\w.+-]+@[\w-]+\.[\w.]+|\b89\d{17,18}\b/,
    )
  })

  it('안드로이드 «지원 기기» 문장 = 사이트 지원 기기 페이지(국내판 첫 지원 S23 · Z 플립4 · Z 폴드4 — D-4 · QA ⑦)', () => {
    const card = ANDROID_GUIDE.checks.items.find((c) => c.title === '지원 기기')
    expect(guidePlainText(card!.body)).toBe(
      '국내판 갤럭시는 S23 · Z 플립4 · Z 폴드4 이후 모델과 일부 A 시리즈가 eSIM을 지원해요. 통신사 잠금(컨트리락)도 풀려 있어야 해요.',
    )
    // 지원 기기 페이지가 바뀌면(첫 지원 모델 · 비지원 목록) 이 문장도 같이 본다
    const dev = read('app/components/devices/SupportedDevicesContent.vue')
    expect(dev).toContain("'S23 · S24 · S25 · S26 전 모델'")
    expect(dev).toContain("'Z 플립 4 · 5 · 6 · 7 · 8'")
    expect(dev).toContain("'Z 폴드 4 · 5 · 6 · 7 · 8 · 8 울트라'")
    expect(dev).toMatch(/'A35 · A36'/)
    expect(dev).toContain(
      'S22 · S21 · S20 시리즈, Note 20, Z 플립3 이전, Z 폴드3 이전 모델은 eSIM 하드웨어가 없어요.',
    )
  })

  it('제품명 표기 «아이폰»(client-shell D-52) — 본문에 «iPhone» 0', () => {
    const all = strings(g).map(guidePlainText).join('\n')
    expect(all).not.toContain('iPhone')
  })
})

describe('공통 문안(허브 · 카드 · 흐름 · 문의) — 본문과 같은 카피 불변식', () => {
  const all = JSON.stringify(COMMON)
  it('자정 · iPhone · URL · 전화번호 0', () => {
    expect(all).not.toMatch(/자정|iPhone|https?:\/\/|\b01[016789]-?\d{3,4}-?\d{4}\b/)
  })
  it('OS 페이지 경로 · 이름은 글자 그대로(아이폰 → /guide/ios · 안드로이드 → /guide/android — 서로 바뀌면 실패)', () => {
    expect(GUIDE_PAGES.ios).toEqual({
      to: '/guide/ios',
      label: '아이폰 설치 가이드',
      short: '아이폰',
      sub: 'QR 스캔 · QR 길게 누르기 · 코드 입력',
    })
    expect(GUIDE_PAGES.android).toEqual({
      to: '/guide/android',
      label: '안드로이드 설치 가이드',
      short: '안드로이드',
      sub: '갤럭시 기준 · QR 스캔 · QR 이미지 · 코드 입력',
    })
    expect(IOS_GUIDE.os).toBe('ios')
    expect(ANDROID_GUIDE.os).toBe('android')
    expect(IOS_GUIDE.title).toContain('아이폰')
    expect(ANDROID_GUIDE.title).toContain('안드로이드')
  })
})

describe('화면 창 매니페스트 ↔ PNG (spec F-3 · DoD 2)', () => {
  const used = new Set([...figuresOf(IOS_GUIDE), ...figuresOf(ANDROID_GUIDE)])
  const keys = Object.keys(GUIDE_FIGURES) as FigureKey[]

  it('매니페스트의 창은 전부 어딘가에서 쓴다(안 쓰는 창 0)', () => {
    expect(keys.filter((k) => !used.has(k))).toEqual([])
  })

  it('모든 창에 대체 글이 있고(창마다 다르다), 키는 파일 이름으로 쓸 수 있는 글자만', () => {
    expect(new Set(keys.map((k) => GUIDE_FIGURES[k].alt)).size).toBe(keys.length)
    for (const k of keys) {
      expect(GUIDE_FIGURES[k].alt.length, k).toBeGreaterThan(5)
      expect(k).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('PNG 가 전부 있고 크기가 매니페스트와 같다(가로 368 × 3 · 세로 = 가로 ÷ 비율) · 매니페스트 밖 파일 0', () => {
    const dir = new URL('public/guide-screens/', CLIENT)
    const files = readdirSync(dir)
      .filter((f) => !f.startsWith('.'))
      .sort()
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
    expect(FIGURE_SCALE).toBe(3)
  })

  it('PNG 가 지금 매니페스트 · 템플릿 · 글꼴로 구운 것이다(figures.lock.json — 고치고 다시 굽지 않으면 실패)', () => {
    const lock = lockJson as {
      figures: Record<string, { inputs: string; figure: string; png: string; browser: string }>
    }
    const inputs = guideInputsHash(
      new URL('scripts/guide-screens/', CLIENT).pathname,
      new URL('public/fonts/PretendardVariable.woff2', CLIENT).pathname,
    )
    expect(Object.keys(lock.figures).sort()).toEqual([...keys].sort())
    for (const k of keys) {
      const rec = lock.figures[k]!
      expect(rec.inputs, `${k} — 템플릿 · 글꼴이 바뀌었다: render.mjs 로 다시 굽기`).toBe(inputs)
      expect(rec.figure, `${k} — 창 값이 바뀌었다: render.mjs 로 다시 굽기`).toBe(
        guideFigureHash(GUIDE_FIGURES[k], FIGURE_WIDTH, FIGURE_SCALE),
      )
      const png = readFileSync(new URL(`public/guide-screens/${k}.${FIGURE_VERSION}.png`, CLIENT))
      expect(rec.png, `${k} — PNG 가 기록과 다르다`).toBe(sha256(png))
    }
  })

  it('창마다 구운 브라우저(판 · OS)가 기록돼 있고 한 판으로만 구웠다(일부만 다른 판으로 다시 구우면 실패 — spec F-3)', () => {
    const recs = Object.values(
      (lockJson as { figures: Record<string, { browser?: string }> }).figures,
    )
    for (const r of recs) expect(r.browser).toMatch(/^chromium \d+\.\S+ · [a-z0-9]+$/)
    expect(new Set(recs.map((r) => r.browser)).size).toBe(1)
  })

  it('웹 화면 PNG 글자 = 지금 발급 화면 글자(발급 화면을 고치면 템플릿도 고쳐 다시 굽는다 — 앱 CLAUDE.md)', () => {
    const view = read('app/pages/view/[orderId].vue')
    // 웹 화면 구간만 본다(«SM-DP+ 주소» · «활성화 코드» 는 아이폰 · 안드로이드 입력 화면에도 있다)
    const all = read('scripts/guide-screens/screens.js')
    const screens = all.slice(
      all.indexOf('// 우리 발급 화면 (/view/{orderId})'),
      all.indexOf('// 화면별 근거와 확인 필요 항목'),
    )
    expect(screens.length).toBeGreaterThan(500)
    for (const t of [
      '아이폰 수동 설치',
      '안드로이드 수동 설치',
      'LPA 전체',
      'SM-DP+ 주소',
      '활성화 코드',
      'QR 코드 다운로드',
      '발급 완료',
      '다운로드가 안 되면 스크린샷으로 저장해 주세요.',
    ]) {
      expect(view, `발급 화면 «${t}»`).toContain(t)
      expect(screens, `웹 화면 템플릿 «${t}»`).toContain(t)
    }
  })

  it('이미지 템플릿 안 주소 · 코드 0 — 웹 화면 값은 가린 글자(••••)만 · 도메인 · 활성화 코드 모양 0 · URL 은 가린 예시 하나(불변식 · D-4)', () => {
    const screens = read('scripts/guide-screens/screens.js')
    // 발급 화면 코드 줄(wRow) 의 값 = 가린 글자 · 구분자만(LPA:1$ 접두 허용)
    const vals = [...screens.matchAll(/wRow\('([^']+)', '([^']*)'\)/g)].map(
      (m) => [m[1], m[2]] as const,
    )
    expect(vals.map(([k]) => k)).toEqual(['SM-DP+ 주소', '활성화 코드', 'LPA 전체'])
    for (const [k, v] of vals) expect(v, k).toMatch(/^(LPA:1\$)?[•$-]+$/)
    // 도메인 모양(하위 도메인까지 통째로 · 두 글자 이상 이름 + 최상위 도메인)은 발급 호스트 주소창 하나뿐 ·
    // 활성화 코드 모양(대문자 · 숫자 묶음 - 묶음) 0
    const domains =
      screens.match(/(?:[a-z0-9-]+\.)*[a-z0-9-]{2,}\.(?:com|net|org|io|kr|me|app)\b/gi) ?? []
    expect(domains.length).toBeGreaterThan(0)
    expect(new Set(domains)).toEqual(new Set(['app.esimmany.com']))
    expect(screens).not.toMatch(/\b[A-Z0-9]{1,6}-[A-Z0-9]{4,}\b/)
    expect(screens).not.toMatch(/LPA:1\$[^$•…\s]*[A-Za-z0-9-]\.[A-Za-z]{2,}/)
    expect(new Set(screens.match(/https?:\/\/[^\s"'<`)]*/g) ?? [])).toEqual(
      new Set(['https://••••']),
    )
    expect(screens).not.toMatch(/operator|sm-dp\.|smdp\./i)
  })

  it('스위치 켜짐/꺼짐 = 본문 행동(«꺼 두세요» 를 켜진 그림으로 그리지 않는다 — 로밍 요금 위험 · QA ⑥ R5)', () => {
    const screens = read('scripts/guide-screens/screens.js')
    const sw = (label: string) =>
      [
        ...screens.matchAll(
          new RegExp(
            `[ia]Row\\('${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}',[^)]*?sw: (true|false)`,
            'g',
          ),
        ),
      ].map((m) => m[1])
    const want = {
      '이 회선 켜기': 'true', // ios STEP 2 «이 회선 켜기와 데이터 로밍을 미리 켜 두세요»
      '데이터 로밍': 'true',
      '셀룰러 데이터 전환 허용': 'false', // ios «셀룰러 데이터 전환 허용은 꺼 두세요»
      '데이터 전환': 'false', // android «데이터 전환은 꺼 두세요»
      '데이터 로밍 SIM 1': 'false', // android «데이터 로밍 SIM 1은 꺼 두세요»
      '데이터 로밍 eSIM 1': 'true', // android «데이터 로밍 eSIM 1을 미리 켜 두세요»
      'eSIM 1': 'true', // android «eSIM 1이 켜져 있으면»
    } as const
    for (const [label, on] of Object.entries(want)) {
      const got = sw(label)
      expect(got.length, label).toBeGreaterThan(0)
      expect(new Set(got), label).toEqual(new Set([on]))
    }
    // 본문이 그 행동을 말한다(문장이 바뀌면 이 표도 본다)
    const body = strings(IOS_GUIDE).join('\n') + strings(ANDROID_GUIDE).join('\n')
    expect(body).toContain('{{이 회선 켜기}}와 {{데이터 로밍}}을 미리 켜 두세요')
    expect(body).toContain('{{셀룰러 데이터 전환 허용}}은 꺼 두세요')
    expect(body).toContain('{{데이터 전환}}은 꺼 두세요')
    expect(body).toContain('**데이터 로밍 SIM 1은 꺼 두세요.**')
    expect(body).toContain('{{데이터 로밍 eSIM 1}}을 미리 켜 두세요')
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

  it('설치 가이드 카드 = 사이트판 링크(새 탭) + 하단 시트(D-13 · D-17) — 아이폰 카드(사과 아이콘)는 ios · 안드로이드 카드는 android', () => {
    const cards = read('app/components/guide/GuideCards.vue')
    const icon = { ios: 'fill="#111827"', android: 'fill="#3ddc84"' } as const
    for (const os of ['ios', 'android'] as const) {
      const card = cards.match(
        new RegExp(
          `<NLinkCard[^>]*:label="GUIDE_PAGES\\.${os}\\.label"[^>]*>[\\s\\S]*?</NLinkCard>`,
        ),
      )?.[0]
      expect(card, os).toBeTruthy()
      expect(card).toContain(`:sub="GUIDE_PAGES.${os}.sub"`)
      // 사이트판 링크 · 새 탭(화면 준비 전 · 보조키 클릭) — 보조키 없는 클릭은 openGuide 가 막고 시트로
      expect(card).toContain(`:href="GUIDE_PAGES.${os}.to"`)
      expect(card).toMatch(/\sexternal\s/)
      expect(card).toContain(`@click="openGuide('${os}', $event)"`)
      expect(card).toContain('aria-haspopup="dialog"')
      expect(card).toContain(icon[os])
      // 화면낭독기가 읽는 이름 = 그 카드의 이름 — 설명(눌러서 여는 것은 시트 — aria-haspopup)
      expect(card).toContain(
        ':aria-label="`${GUIDE_PAGES.' + os + '.label} — ${GUIDE_PAGES.' + os + '.sub}`"',
      )
    }
    // 카드가 바꾸는 값 = 시트의 v-model(컴포넌트 안에 한 번)
    expect(cards.match(/<GuideSheet v-model="guideOs" \/>/g)).toHaveLength(1)
    expect(cards).toMatch(/^const guideOs = computed<GuideOs \| null>\(\{$/m)
    expect(cards).not.toMatch(/Universal Link 자동 설치|Galaxy · Pixel · QR 등록|\(새 창\)/)
    // 쓰는 곳 — 발급 완료 화면(D-13)과 본인 확인 화면 약관 링크 아래(D-19)에 한 번씩. 누른 동작은 pages/view · pages/verify 의 *.dom.test.ts
    expect(read('app/pages/view/[orderId].vue').match(/<GuideCards\b/g)).toHaveLength(1)
    const verify = read('app/pages/verify/[orderId].vue')
    expect(verify.match(/<GuideCards\b/g)).toHaveLength(1)
    // 개인정보처리방침 · 이용약관 링크 바로 아래 · «주문 확인하기» 위(D-19 — John 위치 지정)
    expect(verify.indexOf('<GuideCards')).toBeGreaterThan(verify.indexOf('class="verify-page__policy"'))
    expect(verify.indexOf('<GuideCards')).toBeLessThan(verify.indexOf('class="verify-page__cta"'))
  })

  it('설치 가이드 카드 설명 — 명암비 4.5:1(#737373) · 13px · 어절 줄바꿈 · 줄간격 1.6(spec ⑤ · QA ⑦)', () => {
    const css = read('app/components/guide/GuideCards.vue').split('<style scoped>')[1] ?? ''
    const rule = css.match(/\.guide-cards__list :deep\(\.n-link-card__sub\) \{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/color: var\(--n-color-neutral-500, #737373\);/)
    expect(rule).toMatch(/font-size: 13px;/)
    expect(rule).toMatch(/line-height: 1\.6;/)
    expect(rule).toMatch(/word-break: keep-all;/)
  })

  it('발급 화면 머리 설명 · FAQ — 어절 단위 줄바꿈(«연결/돼요» 처럼 어절 중간에서 끊지 않는다 · QA ⑦ walk 2)', () => {
    const css = read('app/pages/view/[orderId].vue').split('<style scoped>')[1] ?? ''
    const rule =
      css.match(
        /\.view-page__heading :deep\(\.n-page-heading__desc\),\s*\.view-page__faq-q,\s*\.view-page__faq-a \{([^}]*)\}/,
      )?.[1] ?? ''
    expect(rule).toMatch(/word-break: keep-all;/)
    expect(rule).toMatch(/overflow-wrap: break-word;/)
    // 머리 설명은 .view-page__heading 안의 NPageHeading 이다(선택자가 다른 칸을 가리키면 적용되지 않는다)
    expect(read('app/pages/view/[orderId].vue')).toMatch(/<div class="view-page__heading">\s*<NPageHeading/)
  })

  it('바로가기 착지 — 기본 레이아웃이 헤더 높이만큼 scroll-padding-top 을 준다(앵커 머리가 헤더에 가리지 않게 · E2E-4)', () => {
    const layout = read('app/layouts/default.vue')
    expect(layout).toContain("useHead({ htmlAttrs: { class: 'has-shell-chrome' } })")
    expect(layout).toMatch(
      /html\.has-shell-chrome \{[^}]*scroll-padding-top: calc\(var\(--shell-header-height, 56px\) \+ 8px\);/,
    )
  })

  it('가이드 화면 글자 크기 하한 — 모든 글 13px 이상 · 본문 칸 15px 이상(spec ⑤ — 장식 로고 글자 제외)', () => {
    const files = [
      ...readdirSync(new URL('app/components/guide/', CLIENT))
        .filter((f) => f.endsWith('.vue'))
        .map((f) => `app/components/guide/${f}`),
      'app/pages/guide/index.vue',
    ]
    const BODY =
      /^\.(g-step__p|g-check__body|g-alert__body|g-sec__lede|g-hero__lede|g-hero__hint|g-faq__a|g-note|g-method__desc|g-cs__lede|g-status__cap|guide-page__desc)$/
    const DECOR = /^\.g-cs__icon(--kakao|--naver)?$/
    let seen = 0
    for (const f of files) {
      const css = read(f).split('<style scoped>')[1] ?? ''
      for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
        const sel = m[1]!.trim()
        const px = m[2]!.match(/font-size:\s*(\d+(?:\.\d+)?)px/)
        if (!px) continue
        seen++
        const size = Number(px[1])
        if (sel.split(',').every((x) => DECOR.test(x.trim()))) continue
        expect(size, `${f} ${sel}`).toBeGreaterThanOrEqual(13)
        if (sel.split(',').some((x) => BODY.test(x.trim())))
          expect(size, `${f} ${sel}`).toBeGreaterThanOrEqual(15)
      }
    }
    expect(seen).toBeGreaterThan(30)
  })

  it('외부 가이드 사이트(esimmany.super.site)로 나가는 링크 0 — apps/client 전체(생성물 · 의존성 폴더 밖)', () => {
    const SKIP = new Set(['node_modules', '.nuxt', '.output', '.data', '.cache'])
    const hits: string[] = []
    let scanned = 0
    const walk = (rel: string) => {
      for (const e of readdirSync(new URL(rel ? `${rel}/` : './', CLIENT), {
        withFileTypes: true,
      })) {
        if (SKIP.has(e.name)) continue
        const p = rel ? `${rel}/${e.name}` : e.name
        if (e.isDirectory()) walk(p)
        else if (
          /\.(vue|ts|mjs|js|json|html|css|md|ya?ml|txt)$/.test(e.name) &&
          !p.endsWith('guide.test.ts')
        ) {
          if (statSync(new URL(p, CLIENT)).size > 5_000_000) continue
          scanned++
          if (read(p).includes('super.site')) hits.push(p)
        }
      }
    }
    walk('')
    expect(scanned).toBeGreaterThan(100)
    expect(hits).toEqual([])
  })
})

describe('골든 — 2609 원본 대조를 마친 콘텐츠 전체(spec F-2 · D-3 · D-4)', () => {
  const GOLDEN = new URL('./guide.golden.json', import.meta.url)
  it('문장 · 표기 · 보조 문장 위치 · 화면 창(상태 · 강조 · 초점 · 대체 글) · 안내 박스 종류 · 공통 문안이 골든과 같다', () => {
    const now = guideGolden()
    if (process.env.WRITE_GUIDE_GOLDEN === '1')
      writeFileSync(GOLDEN, JSON.stringify(now, null, 2) + '\n')
    expect(existsSync(GOLDEN), 'guide.golden.json 없음 — WRITE_GUIDE_GOLDEN=1 로 쓴다').toBe(true)
    expect(now).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')))
  })
})
