import { readFileSync } from 'node:fs'
import { afterEach, describe, it, expect } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import components from '@imjohnkoo/design-tokens/src/components.json'
import NAlertDialog, { type NAlertDialogProps } from '../components/NAlertDialog/NAlertDialog.vue'
import NConfirmDialog from '../components/NConfirmDialog/NConfirmDialog.vue'
import NLoaderDialog from '../components/NLoaderDialog/NLoaderDialog.vue'

// DS-DIALOG-W — 대화상자 폭은 토큰 3개로만 정한다(제안 2026-11-12-dialog-width-token §2).
// happy-dom 은 레이아웃이 없어 계산 폭은 «토큰 값 → CSS 식» 으로 본다.

enableAutoUnmount(afterEach)

const DEFAULT = 'min(var(--n-dialog-viewport-ratio, 90vw), var(--n-dialog-width-default, 17.5rem))'
const WIDE = 'min(var(--n-dialog-viewport-ratio, 90vw), var(--n-dialog-width-wide, 21.25rem))'

const css = (name: string) =>
  readFileSync(`${process.cwd()}/src/components/${name}/${name}.vue`, 'utf8').split('<style>')[1]!
const rule = (src: string, sel: string) =>
  src.match(
    new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
  )?.[2] ?? ''
const widthOf = (src: string, sel: string) =>
  rule(src, sel).match(/(?:^|\n)\s*width:\s*([^;]+);/)?.[1]
const px = (rem: string) => parseFloat(rem) * 16

describe('토큰 dialog.width · dialog.viewport-ratio', () => {
  it('default 17.5rem(280px) · wide 21.25rem(340px) · 화면 비율 90vw — 지금 웹 값 그대로', () => {
    expect(components.dialog).toEqual({
      width: { default: '17.5rem', wide: '21.25rem' },
      'viewport-ratio': '90vw',
    })
    expect(px(components.dialog.width.default)).toBe(280)
    expect(px(components.dialog.width.wide)).toBe(340)
  })
})

describe('부품 CSS — 직접 숫자 없이 토큰만 읽는다', () => {
  it.each([
    ['NAlertDialog', '.n-alert-dialog__content', '.n-alert-dialog__content--wide'],
    ['NConfirmDialog', '.n-confirm__content', '.n-confirm__content--wide'],
  ])(
    '%s — 기본은 min(90vw, default) · --wide 는 min(90vw, wide) · max-width 직접 값 없음',
    (name, base, wide) => {
      const src = css(name)
      expect(widthOf(src, base)).toBe(DEFAULT)
      expect(widthOf(src, wide)).toBe(WIDE)
      expect(rule(src, base)).not.toMatch(/max-width|280px|340px/)
      // 우선순위가 같은 두 선택자 — --wide 가 뒤에 있어야 size="wide" 가 실제로 이긴다
      expect(src.indexOf(`\n${wide} {`)).toBeGreaterThan(src.indexOf(`\n${base} {`))
      expect(src.indexOf(`\n${base} {`)).toBeGreaterThanOrEqual(0)
    },
  )

  it('NLoaderDialog — min(90vw, default) 하나(변형 없음)', () => {
    const src = css('NLoaderDialog')
    expect(widthOf(src, '.n-loader-dialog__content')).toBe(DEFAULT)
    expect(src).not.toMatch(/280px/)
  })
})

describe('size prop', () => {
  const content = () => document.body.querySelector('[role="dialog"]')!

  it.each([
    [NAlertDialog, 'n-alert-dialog__content'],
    [NConfirmDialog, 'n-confirm__content'],
  ] as const)('기본(default)은 --wide 가 없고 · size="wide" 면 붙는다', async (C, cls) => {
    const a = mount(C, { props: { modelValue: true, title: 't' }, attachTo: document.body })
    await nextTick()
    expect(content().classList.contains(cls)).toBe(true)
    expect(content().classList.contains(`${cls}--wide`)).toBe(false)
    expect(content().getAttribute('style') ?? '').not.toMatch(/width/)
    a.unmount()

    const b = mount(C, {
      props: { modelValue: true, title: 't', size: 'wide' },
      attachTo: document.body,
    })
    await nextTick()
    expect(content().classList.contains(`${cls}--wide`)).toBe(true)
    b.unmount()
  })

  it('NLoaderDialog 는 폭 변형이 없다', () => {
    expect(Object.keys(NLoaderDialog.props ?? {})).not.toContain('size')
  })

  it('NAlertDialog 의 옛 width prop 은 없다(숫자 폭을 화면에서 넣지 못한다)', () => {
    expect(Object.keys(NAlertDialog.props ?? {})).not.toContain('width')
    // @ts-expect-error — width 는 NAlertDialogProps 에 없다(vue-tsc typecheck 가 본다)
    const old: NAlertDialogProps = { width: 340 }
    expect(old).toBeTruthy()
  })
})
