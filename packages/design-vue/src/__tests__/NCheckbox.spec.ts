import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NCheckbox from '../components/NCheckbox/NCheckbox.vue'

describe('NCheckbox', () => {
  it('label 글자를 문구로 그린다', () => {
    const wrapper = mount(NCheckbox, { props: { label: '동의합니다' } })
    expect(wrapper.find('.n-checkbox__label').text()).toBe('동의합니다')
  })

  it('문구가 없으면 문구 칸을 그리지 않는다', () => {
    const wrapper = mount(NCheckbox)
    expect(wrapper.find('.n-checkbox__label').exists()).toBe(false)
  })

  it('기본 slot 이 있으면 label 대신 slot 을 그린다(링크 같은 꾸민 문구)', () => {
    const wrapper = mount(NCheckbox, {
      props: { label: '쓰이지 않는 글자' },
      slots: { default: '(필수) <a href="/terms" target="_blank">이용약관</a>에 동의합니다' },
    })
    const label = wrapper.find('.n-checkbox__label')
    expect(label.text()).toBe('(필수) 이용약관에 동의합니다')
    expect(label.find('a').attributes('href')).toBe('/terms')
    expect(wrapper.text()).not.toContain('쓰이지 않는 글자')
  })

  it('slot 문구 글자를 누르면 체크된다(문구 칸이 label 안)', async () => {
    const wrapper = mount(NCheckbox, {
      props: { modelValue: false },
      slots: { default: '(필수) <a href="#x">이용약관</a> <span data-test="text">동의</span>' },
      attachTo: document.body,
    })
    expect(wrapper.find('label .n-checkbox__label a').exists()).toBe(true)
    await wrapper.find('[data-test="text"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true])
    wrapper.unmount()
  })
  // 링크를 눌러도 체크가 바뀌지 않는 것(label 안 대화형 요소 — 활성화 대상이 링크)은 브라우저 규칙이라 happy-dom 이 재현하지 않는다 →
  // 화면 walk 로 확인한다(client-shell spec E2E-8 ④)
})
