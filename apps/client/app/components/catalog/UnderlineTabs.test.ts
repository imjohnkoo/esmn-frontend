// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import UnderlineTabs from './UnderlineTabs.vue'

/** catalog spec D-3 · D-5 · F-6 — role=tablist · 좌우 화살표 이동(끝에서 순환) · 고른 탭만 Tab 초점(roving tabindex) */
const TABS = [
  { key: 'U', label: '무제한' },
  { key: 'L', label: '종량제' },
  { key: 'X', label: '셋째' },
]

function setup(initial = 'U') {
  const model = ref(initial)
  const Host = defineComponent({
    setup: () => () =>
      h(UnderlineTabs, {
        tabs: TABS,
        label: '요금 종류',
        idPrefix: 'kind',
        modelValue: model.value,
        'onUpdate:modelValue': (v: string) => (model.value = v),
      }),
  })
  const w = mount(Host, { attachTo: document.body })
  const buttons = () => w.findAll('button[role="tab"]')
  return { w, model, buttons }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('UnderlineTabs', () => {
  it('고른 탭만 aria-selected · tabindex 0, 나머지는 -1 · 패널을 가리킨다', () => {
    const { w, buttons } = setup('L')
    expect(buttons().map((b) => [b.attributes('aria-selected'), b.attributes('tabindex')])).toEqual(
      [
        ['false', '-1'],
        ['true', '0'],
        ['false', '-1'],
      ],
    )
    expect(buttons()[1]!.attributes('id')).toBe('kind-tab-L')
    expect(buttons()[1]!.attributes('aria-controls')).toBe('kind-panel')
    expect(w.get('[role="tablist"]').attributes('aria-label')).toBe('요금 종류')
    w.unmount()
  })

  it('→ 는 다음 탭을 고르고 초점도 옮긴다 · 끝에서 처음으로 순환', async () => {
    const { w, model, buttons } = setup('L')
    await buttons()[1]!.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    await nextTick()
    expect(model.value).toBe('X')
    expect(document.activeElement).toBe(buttons()[2]!.element)
    await buttons()[2]!.trigger('keydown', { key: 'ArrowRight' })
    await nextTick()
    await nextTick()
    expect(model.value).toBe('U')
    expect(document.activeElement).toBe(buttons()[0]!.element)
    w.unmount()
  })

  it('← 는 앞 탭 · 처음에서 끝으로 순환', async () => {
    const { w, model, buttons } = setup('U')
    await buttons()[0]!.trigger('keydown', { key: 'ArrowLeft' })
    await nextTick()
    await nextTick()
    expect(model.value).toBe('X')
    expect(document.activeElement).toBe(buttons()[2]!.element)
    w.unmount()
  })

  it('누르면 그 탭을 고른다 · 고른 탭이 바뀌면 tabindex 가 따라간다', async () => {
    const { w, model, buttons } = setup('U')
    await buttons()[1]!.trigger('click')
    expect(model.value).toBe('L')
    expect(buttons().map((b) => b.attributes('tabindex'))).toEqual(['-1', '0', '-1'])
    w.unmount()
  })
})
