import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * client-guide-check 불변식 «같은 모양» · plan §2.1 — 새 본문(GuideCheckArticle)은 설치 가이드 본문(GuideArticle)의 틀 CSS 를
 * 복제한다(GuideArticle 골든을 흔들지 않으려고). 복제가 어긋나면 여기서 실패한다 — 한쪽을 고치면 다른 쪽도 같이.
 */
const read = (f: string) =>
  readFileSync(`${process.cwd()}/app/components/${f.includes('/') ? f : `guide/${f}`}`, 'utf8')

/** `<style scoped>` 의 규칙 → { 선택자: 정렬한 선언 } (@media 안 규칙은 «@media … 선택자») */
function rules(file: string): Map<string, string> & { seen: string[] } {
  const css = (read(file).split('<style scoped>')[1] ?? '')
    .replace(/<\/style>\s*$/, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const out = new Map<string, string>()
  const seen: string[] = []
  const add = (prefix: string, body: string) => {
    for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = prefix + m[1]!.replace(/\s+/g, ' ').trim()
      const decl = m[2]!
        .split(';')
        .map((d) => d.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .sort()
        .join('; ')
      seen.push(sel)
      out.set(sel, decl)
    }
  }
  const media = /@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g
  for (const m of css.matchAll(media)) add(`@media ${m[1]!.replace(/\s+/g, ' ').trim()} `, m[2]!)
  add('', css.replace(media, ''))
  return Object.assign(out, { seen })
}

const FRAME = [
  '.g-article',
  '.g-article p',
  '.g-hero',
  '.g-hero__eyebrow',
  '.g-hero__title',
  '.g-hero__lede',
  '.g-os',
  '.g-os__tab',
  '.g-os__tab--on',
  '.g-jump',
  '.g-jump--under-header',
  '.g-jump__chip',
  '.g-jump__step',
  '.g-hero__hint',
  '.g-sec',
  '@media (max-width: 350px) .g-article',
  '.g-jump--under-header ~ .g-sec',
  '.g-article :deep(:is(a, button, [tabindex]))',
  '.g-article .g-jump .g-jump__chip',
  '.g-sec--alt',
  '.g-badge',
  '.g-sec__title',
  '.g-sec__lede',
  '.g-sec__steps',
]

describe('틀 CSS — GuideCheckArticle = GuideArticle', () => {
  const base = rules('GuideArticle.vue')
  const mine = rules('GuideCheckArticle.vue')
  it.each(FRAME)('%s', (sel) => {
    expect(base.get(sel), `GuideArticle 에 ${sel} 없음`).toBeTruthy()
    expect(mine.get(sel)).toBe(base.get(sel))
  })
  it('제목 · 설명 줄 길이 고르기(text-wrap: balance) 대상에 h1 · h2 · 머리 설명 · 구간 설명', () => {
    expect(mine.get('.g-article :is(h1, h2, .g-hero__lede, .g-sec__lede)')).toBe(
      'text-wrap: balance',
    )
  })
})

describe('확인 목록 글자 = 설치 가이드 단계 문장', () => {
  it('GuidePoints .g-point__p = GuideSteps .g-step__p (16px · 줄간격 1.6 · 색)', () => {
    expect(rules('GuidePoints.vue').get('.g-point__p')).toBe(
      rules('GuideSteps.vue').get('.g-step__p'),
    )
  })
})

describe('나라별 통신사 칩 = 상품 상세 «현지 통신사» 칩(client-guide-check S-4)', () => {
  it('GuideCarriers .g-carriers__op = ProductSections .sec__op · 흐린 칩도 같다', () => {
    const mine = rules('GuideCarriers.vue')
    const base = rules('catalog/ProductSections.vue')
    expect(mine.get('.g-carriers__op')).toBe(base.get('.sec__op'))
    expect(mine.get('.g-carriers__op--muted')).toBe(base.get('.sec__op--muted'))
  })
})

describe('틀을 다른 선택자로 덮어쓰지 않는다(QA ⑥ R4 — 값 대조만으로는 «덧붙여 덮어쓰기» 를 못 잡는다)', () => {
  const mine = rules('GuideCheckArticle.vue')
  // 틀(FRAME) 밖에 둘 수 있는 규칙 — 새 조각(링크 · 안내 줄 · 더 보기 카드) · 칩 수에 따른 칩 줄 높이만
  const EXTRA = [
    '.g-article :is(h1, h2, .g-hero__lede, .g-sec__lede)',
    '.g-hero__link, .g-note__link',
    '.g-note__more',
    '@media (max-width: 350px) .g-article--chips-2',
    '@media (max-width: 354px) .g-article--chips-4',
    '.g-article--chips-0',
    '.g-sec--intro',
    '.g-sec--intro > :first-child',
    '.g-sec--intro-solo',
    '.g-sec :deep(.g-points + .g-shot), .g-sec :deep(.g-points + .g-status)',
    '.g-more',
    '.g-more :deep(.n-link-card__label)',
    '.g-more :deep(.n-link-card__sub)',
    '.g-more__icon',
  ]
  it('선택자 = 틀 + 허용 목록(그 밖 0) · 같은 선택자 두 번 0', () => {
    expect([...mine.seen].sort()).toEqual([...FRAME, ...EXTRA].sort())
    expect(new Set(mine.seen).size).toBe(mine.seen.length)
  })
  it('칩 줄 높이 — 칩 2 는 폭 320 에서도 53px · «확인 n» 칩 4 는 폭 354 이하 72px · 칩 없음 0(QA ⑥ R3 실측)', () => {
    expect(mine.get('@media (max-width: 350px) .g-article--chips-2')).toBe('--g-jump-h: 53px')
    expect(mine.get('@media (max-width: 354px) .g-article--chips-4')).toBe('--g-jump-h: 72px')
    expect(mine.get('.g-article--chips-0')).toBe('--g-jump-h: 0px')
  })
})
