import { readFileSync } from 'node:fs'
import { afterEach, describe, it, expect } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import NPinInput from '../components/NPinInput/NPinInput.vue'

// DS-PIN-FIX — 제안 2026-11-12-pin-dialog-fixes W1(작은 폰) · W3(한국어 이름 · group · aria-invalid).
// happy-dom 은 레이아웃이 없어 넘침은 «CSS 값 → 폭 계산» 으로 본다(실제 320 · 390px 폭은 ⑦ walk).

enableAutoUnmount(afterEach)

const src = readFileSync(`${process.cwd()}/src/components/NPinInput/NPinInput.vue`, 'utf8').split(
  /<style[^>]*>/,
)[1]!
const rule = (sel: string) =>
  src.match(
    new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
  )?.[2] ?? ''
const decl = (sel: string, prop: string) =>
  rule(sel)
    .match(new RegExp(`(?:^|\\n)\\s*${prop}:\\s*([^;]+);`))?.[1]
    ?.replace(/\s+/g, ' ')
    .trim()

const GAP = 8 // --n-spacing-2 = 0.5rem
const px = (v: string | undefined) => parseFloat(v ?? 'NaN')

describe('W1 — 칸 폭은 flex(36~48px) · 고정 44px 아님', () => {
  it('그릇은 flex · width 100% · max-width = 칸 수 × 48px + 간격', () => {
    expect(decl('.n-pin-input', 'display')).toBe('flex')
    expect(decl('.n-pin-input', 'width')).toBe('100%')
    expect(decl('.n-pin-input', 'max-width')).toBe(
      'calc( var(--n-pin-input-length) * 48px + (var(--n-pin-input-length) - 1) * var(--n-spacing-2) )',
    )
    expect(decl('.n-pin-input', 'gap')).toBe('var(--n-spacing-2)')
  })

  it('칸은 flex 1 1 0 · min 36px · max 48px · 정사각 · 고정 width/height 없음', () => {
    expect(decl('.n-pin-input__field', 'flex')).toBe('1 1 0')
    expect(decl('.n-pin-input__field', 'min-width')).toBe('36px')
    expect(decl('.n-pin-input__field', 'max-width')).toBe('48px')
    expect(decl('.n-pin-input__field', 'aspect-ratio')).toBe('1')
    expect(rule('.n-pin-input__field')).not.toMatch(/(^|\n)\s*(width|height):/)
  })

  // 320px 폰 − 화면 좌우 여백 24px × 2 = 272px 그릇
  it.each([
    [320, 6],
    [320, 4],
    [375, 6],
    [390, 6],
  ])('%ipx 폰 · %i칸 — 최소 폭 합이 그릇(화면 − 48px) 안이라 넘침 0', (vw, n) => {
    const box = vw - 48
    const min = n * px(decl('.n-pin-input__field', 'min-width')) + (n - 1) * GAP
    expect(min).toBeLessThanOrEqual(box)
    // 실제 칸 폭 = min(48, (그릇 − 간격) / n) — 36 이상
    const cell = Math.min(48, (box - (n - 1) * GAP) / n)
    expect(cell).toBeGreaterThanOrEqual(36)
    expect(n * cell + (n - 1) * GAP).toBeLessThanOrEqual(box)
  })

  it('예전 값(44px 고정 · 6칸 304px)은 272px 를 넘쳤다 — 회귀 기준', () => {
    expect(6 * 44 + 5 * GAP).toBeGreaterThan(320 - 48)
  })

  it('칸 수를 CSS 변수로 그릇에 넘긴다', () => {
    const w = mount(NPinInput, { props: { length: 6 } })
    expect(w.element.getAttribute('style')).toContain('--n-pin-input-length: 6')
  })
})

describe('W3 — 이름 · group · aria-invalid', () => {
  it('칸 이름은 «코드 n자리 중 i번째»(영어 기본값 아님)', () => {
    const w = mount(NPinInput, { props: { length: 6 } })
    const labels = w.findAll('input:not([tabindex="-1"])').map((i) => i.attributes('aria-label'))
    expect(labels).toEqual([1, 2, 3, 4, 5, 6].map((i) => `코드 6자리 중 ${i}번째`))
    expect(w.html()).not.toMatch(/pin input/)
  })

  it('fieldLabel 로 칸 이름을 바꾼다(position 은 1부터)', () => {
    const w = mount(NPinInput, {
      props: { length: 4, fieldLabel: (i: number, n: number) => `${n}칸 중 ${i}` },
    })
    const labels = w.findAll('input:not([tabindex="-1"])').map((i) => i.attributes('aria-label'))
    expect(labels).toEqual(['4칸 중 1', '4칸 중 2', '4칸 중 3', '4칸 중 4'])
  })

  it('묶음은 role=group · 기본 이름 «코드 입력» · 평소 aria-invalid 없음', () => {
    const w = mount(NPinInput)
    expect(w.attributes('role')).toBe('group')
    expect(w.attributes('aria-label')).toBe('코드 입력')
    expect(w.attributes('aria-invalid')).toBeUndefined()
  })

  it('invalid 면 묶음에 aria-invalid="true"', () => {
    const w = mount(NPinInput, { props: { invalid: true } })
    expect(w.attributes('aria-invalid')).toBe('true')
  })

  it('화면이 넘긴 aria-label · aria-describedby 가 묶음 기본값을 이긴다(가입 화면 그대로)', () => {
    const w = mount(NPinInput, {
      props: { length: 6 },
      attrs: { 'aria-label': '인증 코드 6자리', 'aria-describedby': 'err' },
    })
    expect(w.attributes('aria-label')).toBe('인증 코드 6자리')
    expect(w.attributes('aria-describedby')).toBe('err')
    // 칸 이름은 그대로 한국어
    expect(w.find('input').attributes('aria-label')).toBe('코드 6자리 중 1번째')
  })
})
