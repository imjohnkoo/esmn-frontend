// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import SearchField from './SearchField.vue'

/**
 * catalog spec F-4 — 한글 조합 중에도 입력 이벤트의 값으로 바로 거른다.
 * v-model(vModelText)은 compositionstart 뒤 input 을 무시한다 — 그렇게 되돌아가면 이 테스트가 실패한다.
 */
function setup(initial = '', autofocus = false) {
  const updates: string[] = []
  const w = mount(SearchField, {
    props: {
      modelValue: initial,
      autofocus,
      'onUpdate:modelValue': (v: string) => updates.push(v),
    },
    attachTo: document.body,
  })
  return { w, updates, input: w.get('input').element as HTMLInputElement }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('SearchField (F-4 · S-2)', () => {
  it('조합 중(«파리» 의 «리» 를 치는 중) 입력도 곧바로 값을 올린다', () => {
    const { w, updates, input } = setup()
    input.dispatchEvent(new CompositionEvent('compositionstart'))
    input.value = '파'
    input.dispatchEvent(new InputEvent('input', { isComposing: true }))
    input.value = '파리'
    input.dispatchEvent(new InputEvent('input', { isComposing: true }))
    expect(updates).toEqual(['파', '파리'])
    w.unmount()
  })

  it('영문 입력도 글자마다 올린다', async () => {
    const { w, updates } = setup()
    await w.get('input').setValue('F')
    await w.get('input').setValue('Fr')
    await w.get('input').setValue('Fra')
    expect(updates).toEqual(['F', 'Fr', 'Fra'])
    w.unmount()
  })

  it('autofocus 면 들어오자마자 입력창에 초점(S-2) · 아니면 그대로', () => {
    const a = setup('', true)
    expect(document.activeElement).toBe(a.input)
    a.w.unmount()
    const b = setup('', false)
    expect(document.activeElement).not.toBe(b.input)
    b.w.unmount()
  })

  it('지우기 — 값을 비우고 초점을 입력창으로 돌린다(버튼이 사라져도 초점을 잃지 않게)', async () => {
    const { w, updates, input } = setup('파리')
    const clear = w.get('button[aria-label="입력 지우기"]')
    ;(clear.element as HTMLButtonElement).focus()
    await clear.trigger('click')
    expect(updates.at(-1)).toBe('')
    expect(document.activeElement).toBe(input)
    w.unmount()
  })

  it('값이 비면 지우기 버튼이 없다', () => {
    const { w } = setup('')
    expect(w.find('button').exists()).toBe(false)
    w.unmount()
  })
})
