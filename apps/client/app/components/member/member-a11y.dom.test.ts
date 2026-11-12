// @vitest-environment happy-dom
// 회원 화면 접근성(design-qa MEMBER-A2 5-3 · 5-5 · 5-6 · 5-7 · 5-8 · PM ① ② · spec D-31) — 실제로 마운트해 본다
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, h, nextTick, onMounted, ref, watch } from 'vue'
import { NPinInput } from '@imjohnkoo/design-vue'

Object.assign(globalThis, { ref, computed, watch, onMounted, nextTick })
enableAutoUnmount(afterEach)

const { focusFirstInvalid, focusWhenEnabled, PIN_FIELD } = await import('~/utils/member-a11y')
const MemberShell = (await import('./MemberShell.vue')).default
const MemberStatus = (await import('./MemberStatus.vue')).default
const PasswordField = (await import('./PasswordField.vue')).default

describe('focusFirstInvalid(5-5)', () => {
  it('aria-invalid 첫 입력칸으로 · 없으면 null', () => {
    document.body.innerHTML = `<form id="f"><input id="a"><input id="b" aria-invalid="true"><input id="c" aria-invalid="true"></form>`
    expect(focusFirstInvalid(document.getElementById('f'))?.id).toBe('b')
    expect(document.activeElement?.id).toBe('b')
    document.body.innerHTML = `<form id="f"><input id="a"></form>`
    expect(focusFirstInvalid(document.getElementById('f'))).toBeNull()
  })

  it('PIN 묶음(PM ①) — invalid 면 묶음에 aria-invalid · 숨은 input 이 아니라 보이는 첫 칸으로(PM ②)', async () => {
    const w = mount(
      {
        render: () =>
          h('form', { id: 'pf' }, [
            h(NPinInput, {
              id: 'pin',
              modelValue: [],
              length: 6,
              invalid: true,
              fieldLabel: (p: number, l: number) => `인증 코드 ${l}자리 중 ${p}번째`,
            }),
          ]),
      },
      { attachTo: document.body },
    )
    await nextTick()
    const group = w.element.querySelector('[role="group"]')!
    expect(group.getAttribute('aria-invalid')).toBe('true')
    const first = focusFirstInvalid(w.element)!
    expect(first.matches(PIN_FIELD)).toBe(true)
    expect(first.getAttribute('aria-label')).toBe('인증 코드 6자리 중 1번째')
    expect(document.activeElement).toBe(first)
  })
})

describe('focusWhenEnabled(키보드 walk major — 틀린 코드 뒤 첫 칸)', () => {
  it('검증 중 disabled 였던 칸이 다시 켜진 뒤에 포커스한다', async () => {
    document.body.innerHTML = `<div id="pin"><input class="n-pin-input__field" disabled></div>`
    const el = document.querySelector('input')!
    const p = focusWhenEnabled('#pin .n-pin-input__field')
    await nextTick()
    expect(document.activeElement).not.toBe(el)
    el.disabled = false
    expect(await p).toBe(true)
    expect(document.activeElement).toBe(el)
  })
})

describe('MemberStatus(5-7)', () => {
  it('role=status 그릇은 처음부터 비어 있고 글은 마운트 뒤에 들어간다 · 바뀐 글도 같은 그릇', async () => {
    vi.useFakeTimers()
    const w = mount(MemberStatus, { props: { text: '로그아웃했어요.' } })
    const box = w.get('[role="status"]')
    expect(box.text()).toBe('')
    vi.advanceTimersByTime(100)
    await nextTick()
    expect(w.get('[role="status"]').element).toBe(box.element)
    expect(box.text()).toBe('로그아웃했어요.')
    await w.setProps({ text: '탈퇴했어요.' })
    expect(box.text()).toBe('탈퇴했어요.')
    vi.useRealTimers()
  })

  it('글이 없어도 그릇은 있다', () => {
    expect(
      mount(MemberStatus, { props: { text: null } })
        .find('[role="status"]')
        .exists(),
    ).toBe(true)
  })
})

describe('MemberShell(5-6)', () => {
  it('첫 진입은 포커스를 옮기지 않고 · 제목이 바뀌면 새 제목(tabindex=-1)으로', async () => {
    const w = mount(MemberShell, { props: { title: '첫 단계' }, attachTo: document.body })
    await nextTick()
    const h1 = w.get('h1').element as HTMLElement
    expect(h1.getAttribute('tabindex')).toBe('-1')
    expect(document.activeElement).not.toBe(h1)
    await w.setProps({ title: '둘째 단계' })
    await nextTick()
    expect(document.activeElement).toBe(w.get('h1').element)
  })
})

describe('PasswordField(5-3 · 5-5)', () => {
  it('보기 — 이름 «비밀번호 보기» 고정 · 상태는 aria-pressed 만', async () => {
    const w = mount(PasswordField, { props: { inputId: 'pw', autocomplete: 'current-password' } })
    const btn = w.get('button')
    expect(btn.attributes('aria-label')).toBe('비밀번호 보기')
    expect(btn.attributes('aria-pressed')).toBe('false')
    await btn.trigger('click')
    expect(btn.attributes('aria-label')).toBe('비밀번호 보기')
    expect(btn.attributes('aria-pressed')).toBe('true')
    expect(btn.text()).toBe('보기')
  })

  it('오류 문장은 role=alert · 칸이 describedby 로 읽는다 · 도움말은 alert 아님', async () => {
    const w = mount(PasswordField, {
      props: { inputId: 'pw', autocomplete: 'new-password', hint: '8자 이상' },
    })
    expect(w.get('#pw-desc').attributes('role')).toBeUndefined()
    await w.setProps({ error: '비밀번호를 입력해 주세요.' })
    expect(w.get('#pw-desc').attributes('role')).toBe('alert')
    expect(w.get('input').attributes('aria-describedby')).toBe('pw-desc')
    expect(w.get('input').attributes('aria-invalid')).toBe('true')
  })
})

describe('가입 화면 소스(5-8 · PM ① ②)', () => {
  const src = readFileSync(resolve(__dirname, '../../pages/signup.vue'), 'utf8')
  it('동의 «보기» 링크 이름이 서로 다르다', () => {
    expect(src).toContain('aria-label="이용약관 보기"')
    expect(src).toContain('aria-label="개인정보 수집·이용 안내 보기"')
  })
  it('코드 칸에 invalid 를 넘기고 · 첫 칸 포커스는 숨은 input 이 아니라 보이는 칸', () => {
    expect(src).toContain(':invalid="!!codeErr"')
    expect(src).not.toContain("'#signup-pin input'")
    expect(src).toContain('`#signup-pin ${PIN_FIELD}`')
  })
})
