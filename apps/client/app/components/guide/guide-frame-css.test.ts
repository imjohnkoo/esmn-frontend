import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * client-guide-check 불변식 «같은 모양» · plan §2.1 — 새 본문(GuideCheckArticle)은 설치 가이드 본문(GuideArticle)의 틀 CSS 를
 * 복제한다(GuideArticle 골든을 흔들지 않으려고). 복제가 어긋나면 여기서 실패한다 — 한쪽을 고치면 다른 쪽도 같이.
 */
const read = (f: string) => readFileSync(`${process.cwd()}/app/components/guide/${f}`, 'utf8')

/** `<style scoped>` 의 규칙 → { 선택자: 정렬한 선언 } (@media 안 규칙은 «@media … 선택자») */
function rules(file: string): Map<string, string> {
  const css = (read(file).split('<style scoped>')[1] ?? '')
    .replace(/<\/style>\s*$/, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  const out = new Map<string, string>()
  const add = (prefix: string, body: string) => {
    for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const sel = prefix + m[1]!.replace(/\s+/g, ' ').trim()
      const decl = m[2]!
        .split(';')
        .map((d) => d.replace(/\s+/g, ' ').trim())
        .filter(Boolean)
        .sort()
        .join('; ')
      out.set(sel, decl)
    }
  }
  const media = /@media([^{]+)\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g
  for (const m of css.matchAll(media)) add(`@media ${m[1]!.replace(/\s+/g, ' ').trim()} `, m[2]!)
  add('', css.replace(media, ''))
  return out
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
