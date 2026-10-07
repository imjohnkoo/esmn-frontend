import { readFileSync } from 'node:fs'
import { afterEach, describe, it, expect } from 'vitest'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import NBottomSheet from '../components/NBottomSheet/NBottomSheet.vue'

// 단언이 실패해도 포털이 다음 테스트로 새지 않게
enableAutoUnmount(afterEach)

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

  it('제목 없이 closable 만 줘도 X 가 있는 머리줄이 그려진다', async () => {
    const w = await open({ closable: true, title: undefined })
    expect(document.body.querySelector('.n-bottom-sheet__title')).toBeNull()
    expect(
      document.body.querySelector('.n-bottom-sheet__header .n-bottom-sheet__close'),
    ).not.toBeNull()
    w.unmount()
  })

  it('closeLabel 로 접근 이름을 바꾼다', async () => {
    const w = await open({ closable: true, closeLabel: '약관 닫기' })
    expect(document.body.querySelector('.n-bottom-sheet__close')?.getAttribute('aria-label')).toBe(
      '약관 닫기',
    )
    w.unmount()
  })
})

describe('NBottomSheet 위치 — 닫힐 때 옆으로 밀리지 않는다(0.7.2)', () => {
  // happy-dom 은 레이아웃이 없어 CSS 로 본다. 실측(Chromium · 스크롤바 15px · 폭 600): 고치기 전 닫는 순간 시트 왼쪽 90 → 82.5px,
  // 고친 뒤 열림 · 닫힘 모두 82.5px(밀림 0)
  const css = readFileSync(
    `${process.cwd()}/src/components/NBottomSheet/NBottomSheet.vue`,
    'utf8',
  ).split('<style>')[1]!
  const rule = (sel: string) =>
    css.match(
      new RegExp(`(^|\\n)${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`),
    )?.[2] ?? ''

  it('가운데 정렬 = 화면 폭 − 스크롤바 폭(reka 스크롤 잠금의 --scrollbar-width) — left 50% · translateX(-50%) 를 쓰지 않는다', () => {
    const c = rule('.n-bottom-sheet__content')
    expect(c).toMatch(/position:\s*fixed/)
    expect(c).toMatch(/\bleft:\s*0;/)
    expect(c).toMatch(/\bright:\s*var\(--scrollbar-width, 0px\);/)
    expect(c).toMatch(/margin:\s*0 auto;/)
    expect(c).not.toMatch(/left:\s*50%|translateX/)
  })

  it('열림 · 닫힘 애니메이션은 세로로만(translateY) — 가로 이동 0', () => {
    for (const sel of ['.n-bottom-sheet-content-enter-from', '.n-bottom-sheet-content-leave-to']) {
      const r = rule(sel)
      expect(r, sel).toMatch(/transform:\s*translateY\(24px\);/)
      expect(r, sel).not.toMatch(/translateX/)
    }
    // 주석(왜 바꿨는지 설명 글자)은 빼고 본다
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/translateX/)
  })
})
