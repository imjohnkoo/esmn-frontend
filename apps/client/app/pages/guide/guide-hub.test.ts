// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { GUIDE_CONTACT, GUIDE_FLOW, GUIDE_HUB } from '~/content/guide/common'

/** client-guide spec S-1 · F-1 — 허브: OS 카드 2(아이폰 → /guide/ios · 안드로이드 → /guide/android) · 3단계 흐름 · 지원 기기 · 문의 */
const seo = vi.fn()
beforeEach(() => vi.stubGlobal('useCatalogSeo', seo))
afterEach(() => vi.unstubAllGlobals())

const NuxtLink = defineComponent({
  props: { to: { type: String, default: '' }, custom: Boolean },
  setup:
    (props, { slots, attrs }) =>
    () =>
      props.custom
        ? slots.default?.({ href: props.to, navigate: () => {} })
        : h('a', { ...attrs, href: props.to }, slots.default?.()),
})

describe('/guide 허브', () => {
  it('OS 카드 순서 · 이름 · 경로 · 흐름 3단계 · 지원 기기 · 허브용 문의 제목 · 설명은 STATIC_DESCRIPTIONS', async () => {
    const Page = (await import('./index.vue')).default
    const w = mount(Page, { global: { stubs: { NuxtLink } } })
    const cards = w.findAll('a.n-link-card')
    expect(cards.map((c) => [c.find('.n-link-card__label').text(), c.attributes('href')])).toEqual([
      ['아이폰 설치 가이드', '/guide/ios'],
      ['안드로이드 설치 가이드', '/guide/android'],
    ])
    // 아이콘 짝 — 아이폰 카드 = 사과 · 안드로이드 카드 = 안드로이드
    expect(cards.map((c) => c.find('img').attributes('src'))).toEqual(['/icons/apple.svg', '/icons/android.svg'])
    // 새 탭이 아니다(사이트 안 이동)
    for (const c of cards) expect(c.attributes('target')).toBeUndefined()
    expect(w.findAll('.g-flow__item').map((li) => li.find('.g-flow__title').text())).toEqual(
      GUIDE_FLOW.map((f) => f.title),
    )
    expect(w.text()).toContain(GUIDE_HUB.flowNote)
    // 허브 글자(spec S-1) — 상수를 비추지 않게 글자로
    expect(w.find('.guide-page__desc').text()).toBe(
      '아이폰과 안드로이드 설치 방법을 출국 전 설치부터 현지에서 켜기까지 순서대로 안내해요.',
    )
    expect(w.find('#guide-cs-title').text()).toBe('설치가 잘 안 되면 문의해 주세요')
    expect(w.findAll('.g-flow__meta').map((m) => m.text().replace(/\s+/g, ' ').trim())).toEqual([
      '출국 전 · 5분',
      '설치 직후 · 1분',
      '도착 후 · 1분',
    ])
    expect(w.find('a[href="/supported-devices"]').exists()).toBe(true)
    expect(w.find('#guide-cs-title').text()).toBe(GUIDE_CONTACT.hubTitle)
    expect(seo).toHaveBeenCalledWith(expect.objectContaining({ title: '설치 가이드' }))
    expect(w.text()).not.toMatch(/super\.site/)
  })
})
