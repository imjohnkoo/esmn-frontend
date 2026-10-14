import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * client-guide-check 불변식 «같은 모양» · plan §2.1 — 새 본문(GuideCheckArticle)은 설치 가이드 본문(GuideArticle)의 틀 CSS 를
 * 복제한다(GuideArticle 골든을 흔들지 않으려고). 복제가 어긋나면 여기서 실패한다 — 한쪽을 고치면 다른 쪽도 같이.
 */
// 이 테스트 파일 기준 경로(작업 폴더와 무관 — 리포 복사본에서 돌려도 그 복사본을 읽는다)
const read = (f: string) =>
  readFileSync(new URL(f.includes('/') ? `../${f}` : `./${f}`, import.meta.url), 'utf8')

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
  it('허용 목록 규칙의 값도 고정(틀 요소 .g-sec 를 건드리는 규칙 포함)', () => {
    expect(Object.fromEntries(EXTRA.map((sel) => [sel, mine.get(sel)]))).toEqual({
      '.g-article :is(h1, h2, .g-hero__lede, .g-sec__lede)': 'text-wrap: balance',
      '.g-hero__link, .g-note__link':
        'color: var(--n-color-primary-600, #5025e8); font-weight: 700; text-decoration: underline; text-underline-offset: 3px',
      '.g-note__more': 'margin: 6px 0 0',
      '@media (max-width: 350px) .g-article--chips-2': '--g-jump-h: 53px',
      '@media (max-width: 354px) .g-article--chips-4': '--g-jump-h: 72px',
      '.g-article--chips-0': '--g-jump-h: 0px',
      '.g-sec--intro': 'padding-top: 0',
      '.g-sec--intro > :first-child': 'margin-top: 0',
      '.g-sec--intro-solo': 'padding-top: 20px',
      '.g-sec :deep(.g-points + .g-shot), .g-sec :deep(.g-points + .g-status)': 'margin-top: 16px',
      '.g-more': 'display: grid; gap: 10px; margin-top: 10px',
      '.g-more :deep(.n-link-card__label)': 'font-size: 15px',
      '.g-more :deep(.n-link-card__sub)':
        'color: var(--n-color-neutral-500, #737373); font-size: 13px; line-height: 1.6',
      '.g-more__icon': 'color: var(--n-color-primary-600, #5025e8); height: 20px; width: 20px',
    })
  })
  it('설치 가이드 본문의 틀 규칙은 전부 FRAME 에 있다(GuideArticle 에 새 틀 규칙이 생기면 여기서 멈추고 복제를 같이 고친다)', () => {
    const base = rules('GuideArticle.vue')
    // 설치 가이드에만 있는 구성(흐름 · 확인 카드 · 방법 카드 · 문제 해결 · 머리 안 흐름)은 틀이 아니다
    const ONLY_GUIDE = /^(\.g-hero__flow|\.g-check|\.g-alert|\.g-method|\.g-pill|\.g-faq|\.g-checks)|\.g-method /
    const frameLike = base.seen.filter(
      (sel) =>
        /^(@media [^ ]+ [^ ]+ )?\.(g-article|g-hero|g-os|g-jump|g-sec|g-badge)/.test(sel) &&
        !ONLY_GUIDE.test(sel.replace(/^@media \([^)]*\) /, '')) &&
        // 줄 길이 고르기 대상은 가이드에 방법 카드가 더 있어 따로 대조한다(위 «제목 · 설명 줄 길이 고르기»)
        sel !== '.g-article :is(h1, h2, .g-hero__lede, .g-sec__lede, .g-method__title, .g-method__desc)',
    )
    expect(frameLike.sort()).toEqual([...FRAME].sort())
  })
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
