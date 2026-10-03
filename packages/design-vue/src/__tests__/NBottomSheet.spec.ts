import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import NBottomSheet from '../components/NBottomSheet/NBottomSheet.vue'

const open = async (props: Record<string, unknown> = {}) => {
  const wrapper = mount(NBottomSheet, {
    props: { modelValue: true, title: '이용약관', ...props },
    slots: { default: '<p>본문</p>' },
    attachTo: document.body,
  })
  await nextTick()
  return wrapper
}

describe('NBottomSheet', () => {
  it('closable 이 아니면 X 버튼이 없다(지금 쓰는 곳 그대로)', async () => {
    const w = await open()
    expect(document.body.querySelector('.n-bottom-sheet__close')).toBeNull()
    expect(document.body.querySelector('.n-bottom-sheet__title')?.textContent).toBe('이용약관')
    w.unmount()
  })

  it('closable — 제목 줄에 접근 이름 «닫기» 인 X 버튼 · 누르면 닫힘(update:modelValue false)', async () => {
    const w = await open({ closable: true })
    const x = document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!
    expect(x).not.toBeNull()
    expect(x.getAttribute('aria-label')).toBe('닫기')
    expect(x.closest('.n-bottom-sheet__header')).not.toBeNull()
    x.click()
    await nextTick()
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false])
    w.unmount()
  })

  it('closeLabel 로 접근 이름을 바꾼다', async () => {
    const w = await open({ closable: true, closeLabel: '약관 닫기' })
    expect(document.body.querySelector('.n-bottom-sheet__close')?.getAttribute('aria-label')).toBe('약관 닫기')
    w.unmount()
  })
})
