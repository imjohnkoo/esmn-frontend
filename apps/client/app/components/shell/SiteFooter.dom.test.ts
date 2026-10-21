// @vitest-environment happy-dom
// 푸터 맨 위 고객센터 묶음(client-shell spec D-57) — 판매 화면(default 레이아웃)만 «고객센터 번호(tel) · 운영 시간»,
// flow 레이아웃(4-step · 체크아웃 · 가이드 전용판 = app.esimmany.com 발급 흐름)에는 없다. 사업자정보 줄은 둘 다 그대로.
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { SUPPORT_HOURS, SUPPORT_PHONE } from '~/content/support'
import SiteFooter from './SiteFooter.vue'

const NuxtLink = defineComponent({
  props: { to: { type: String, required: true } },
  setup:
    (props, { slots }) =>
    () =>
      h('a', { href: props.to }, slots.default?.()),
})
const render = (props: { compact?: boolean; support?: boolean }) =>
  mount(SiteFooter, { props, global: { stubs: { NuxtLink } } })

describe('SiteFooter 고객센터 묶음(D-57)', () => {
  it('support = 맨 위에 «고객센터 070-8064-5232»(tel 링크) · 운영 시간 · 그 아래 링크 줄 · 사업자정보 줄', () => {
    const w = render({ support: true })
    const cs = w.find('footer > .site-footer__cs')
    expect(cs.exists()).toBe(true)
    expect(w.find('footer').element.firstElementChild).toBe(cs.element)
    expect(cs.find('.site-footer__cs-title').text()).toBe(`고객센터${SUPPORT_PHONE}`)
    expect(cs.find('a.site-footer__cs-phone').attributes('href')).toBe('tel:070-8064-5232')
    expect(cs.find('.site-footer__cs-hours').text()).toBe(SUPPORT_HOURS)
    expect(SUPPORT_HOURS).toBe('평일 09:00–18:00, 주말·공휴일 휴무')
    expect(w.text()).toContain(
      '전화: 070-8064-5232 (평일 09:00–18:00, 주말·공휴일 휴무) | 이메일: help@nomacom.net',
    )
    w.unmount()
  })

  it('support 없음(flow 의 compact · 기본값) = 고객센터 묶음 0 · 사업자정보 줄은 그대로', () => {
    for (const props of [{ compact: true }, {}]) {
      const w = render(props)
      expect(w.find('.site-footer__cs').exists(), JSON.stringify(props)).toBe(false)
      expect(w.text()).toContain('이메일: help@nomacom.net')
      expect(w.text()).toContain('사업자등록번호: 704-24-01747')
      w.unmount()
    }
  })

  it('레이아웃 — default 만 support 를 켠다 · flow 는 compact 만', () => {
    const tpl = (f: string) => readFileSync(`${process.cwd()}/app/layouts/${f}`, 'utf8')
    expect(tpl('default.vue').match(/<SiteFooter[^>]*>/g)).toEqual(['<SiteFooter support />'])
    expect(tpl('flow.vue').match(/<SiteFooter[^>]*>/g)).toEqual([
      '<SiteFooter v-if="showFooter" compact />',
    ])
  })
})
