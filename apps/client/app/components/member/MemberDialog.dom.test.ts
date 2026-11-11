// @vitest-environment happy-dom
// 회원 대화상자 수명(QA ⑦ 2회차 major) — 화면마다 하나를 늘 붙여 두고 열고 닫기만 한다.
// 닫은 뒤 body 에 대화상자 · 오버레이가 남지 않고, 다시 열면 새 글자로 열리며, [확인] 이 매번 동작하는지 실제로 마운트해 본다.
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { computed, defineComponent, h, nextTick, ref } from 'vue'
import { useMemberDialog } from '~/composables/useMemberDialog'
import MemberDialog from './MemberDialog.vue'

Object.assign(globalThis, { ref, computed })
enableAutoUnmount(afterEach)

const settle = async () => {
  for (let i = 0; i < 4; i++) await nextTick()
}
const dialogs = () => document.body.querySelectorAll('[role="alertdialog"], [role="dialog"]')
const overlays = () => document.body.querySelectorAll('.n-alert-dialog__overlay')
const confirmButton = () =>
  [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === '확인') as
    | HTMLButtonElement
    | undefined

const VIEW = {
  a: { title: '첫 대화상자', body: '본문 A' },
  b: { title: '둘째 대화상자', body: '본문 B' },
} as const

async function host() {
  const confirms: string[] = []
  const state = useMemberDialog<'a' | 'b'>('a')
  mount(
    defineComponent({
      setup: () => () =>
        h(MemberDialog, {
          modelValue: state.open.value,
          'onUpdate:modelValue': (v: boolean) => {
            state.open.value = v
          },
          ...VIEW[state.key.value],
          onConfirm: () => confirms.push(state.key.value),
        }),
    }),
    { attachTo: document.body },
  )
  await settle()
  return { state, confirms }
}

describe('MemberDialog — 열고 닫기를 되풀이해도 고아 오버레이 0', () => {
  it('처음엔 닫혀 있다', async () => {
    await host()
    expect(dialogs()).toHaveLength(0)
    expect(overlays()).toHaveLength(0)
  })

  it('[확인] 5번 — 매번 닫히고 body 에 남는 것 0 · 다음 열기는 새 글자', async () => {
    const { state, confirms } = await host()
    for (let i = 0; i < 5; i++) {
      const k = i % 2 ? 'b' : 'a'
      state.show(k)
      await settle()
      expect(dialogs()).toHaveLength(1)
      expect(document.body.textContent).toContain(VIEW[k].title)
      confirmButton()!.click()
      await settle()
      expect(state.open.value).toBe(false)
      expect(dialogs()).toHaveLength(0)
      expect(overlays()).toHaveLength(0)
    }
    expect(confirms).toEqual(['a', 'b', 'a', 'b', 'a'])
  })

  it('Escape 로 닫아도 [확인] 과 같은 동작(D-28) · 본문은 aria-describedby 로 묶인다', async () => {
    const { state, confirms } = await host()
    state.show('b')
    await settle()
    const dialog = dialogs()[0] as HTMLElement
    const describedBy = dialog.getAttribute('aria-describedby')
    expect(describedBy && document.getElementById(describedBy)?.textContent).toContain(VIEW.b.body)
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(state.open.value).toBe(false)
    expect(confirms).toEqual(['b'])
    expect(overlays()).toHaveLength(0)
  })
})
