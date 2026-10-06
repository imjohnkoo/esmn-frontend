// @vitest-environment happy-dom
// flow 레이아웃의 사업자정보 푸터(client-shell K5 · D-2) — 본인 확인 화면만 뺀다(client-guide spec D-20 · DoD 6).
// 레이아웃을 실제로 마운트해 «페이지 meta 가 siteFooter: false 일 때만 푸터 0 · 화면이 바뀌면 그 화면 값» 을 보고,
// 그 값을 주는 페이지가 본인 확인 화면 하나뿐인지 소스로 본다.
import { mount } from '@vue/test-utils'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import FlowLayout from './flow.vue'

const route = reactive({ path: '/verify/1', meta: {} as Record<string, unknown> })
beforeEach(() => vi.stubGlobal('useRoute', () => route))
afterEach(() => vi.unstubAllGlobals())

// 푸터 본문은 legal-links 테스트가 본다 — 여기서는 «그려지는가 · compact 인가» 만
const SiteFooter = defineComponent({
  name: 'SiteFooter',
  props: { compact: Boolean },
  setup: (props) => () =>
    h('footer', { class: 'site-footer', 'data-compact': String(props.compact) }),
})
const render = (meta: Record<string, unknown>) => {
  route.meta = meta
  return mount(FlowLayout, {
    slots: { default: () => h('div', { class: 'page' }, '본문') },
    global: { stubs: { SiteFooter } },
  })
}

describe('flow 레이아웃 푸터(K5 · client-guide D-20)', () => {
  it('기본 = 사업자정보 푸터(작은 판) 1 · 본문은 그대로', () => {
    const w = render({ layout: 'flow', middleware: 'order-flow' })
    expect(w.findAll('footer.site-footer').map((f) => f.attributes('data-compact'))).toEqual([
      'true',
    ])
    expect(w.find('.layout-flow__main .page').text()).toBe('본문')
    w.unmount()
  })

  it('페이지 meta siteFooter: false = 푸터 0 · 본문은 그대로', () => {
    const w = render({ layout: 'flow', middleware: 'order-flow', siteFooter: false })
    expect(w.findAll('footer')).toHaveLength(0)
    expect(w.find('.layout-flow__main .page').text()).toBe('본문')
    w.unmount()
  })

  it('false 일 때만 끈다 — 다른 값(빠짐 · true · 글자 false)은 푸터 그대로', () => {
    for (const meta of [
      {},
      { siteFooter: true },
      { siteFooter: 'false' },
      { siteFooter: undefined },
    ]) {
      const w = render(meta)
      expect(w.findAll('footer.site-footer'), JSON.stringify(meta)).toHaveLength(1)
      w.unmount()
    }
  })

  it('화면이 바뀌면 그 화면 값 — 본인 확인(푸터 0) → 상품 선택(푸터 1) → 다시 본인 확인(0)', async () => {
    const w = render({ siteFooter: false })
    expect(w.findAll('footer')).toHaveLength(0)
    route.meta = { layout: 'flow', middleware: 'order-flow' }
    await nextTick()
    expect(w.findAll('footer.site-footer')).toHaveLength(1)
    route.meta = { siteFooter: false }
    await nextTick()
    expect(w.findAll('footer')).toHaveLength(0)
    w.unmount()
  })
})

describe('푸터를 끄는 페이지는 본인 확인 화면 하나(D-20)', () => {
  const PAGES = join(process.cwd(), 'app/pages')
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n)
      return statSync(p).isDirectory() ? walk(p) : p.endsWith('.vue') ? [p] : []
    })

  it('siteFooter 를 쓰는 페이지 = verify/[orderId].vue 뿐 · 그 값은 false', () => {
    const users = walk(PAGES).filter((f) => readFileSync(f, 'utf8').includes('siteFooter'))
    expect(users.map((f) => relative(PAGES, f))).toEqual(['verify/[orderId].vue'])
    expect(readFileSync(users[0]!, 'utf8')).toContain(
      "definePageMeta({ layout: 'flow', middleware: 'order-flow', siteFooter: false })",
    )
  })

  it('다른 flow 화면(details · select-date · view · checkout-preview · 가이드 전용판)은 flow 레이아웃 그대로 — 푸터 있음', () => {
    const flow = walk(PAGES).filter((f) =>
      /definePageMeta\(\{ layout: 'flow'/.test(readFileSync(f, 'utf8')),
    )
    expect(flow.map((f) => relative(PAGES, f)).sort()).toEqual(
      [
        'checkout-preview.vue',
        'details/[orderId].vue',
        'install-guide/android.vue',
        'install-guide/ios.vue',
        'select-date/[orderId].vue',
        'verify/[orderId].vue',
        'view/[orderId].vue',
      ].sort(),
    )
  })
})
