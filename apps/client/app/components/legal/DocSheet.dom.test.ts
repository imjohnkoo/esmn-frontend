// @vitest-environment happy-dom
// 문서 하단 시트(client-shell spec D-45 · D-46 · D-48 · E2E-8 ③ ④) — 실제로 마운트해 «어느 문서가 열리는가 · 닫히는가» 를 본다.
// 페이지 연결(링크 → v-model 키)은 legal-links.test.ts, 중첩(바깥 누름이 시트만 닫고 팝업은 남는다)은 E2E-8 walk 몫.
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { computed, defineComponent, h, nextTick, ref, watch } from 'vue'
import { PRIVACY_DOC } from '~/content/legal/privacy'
import { REFUND_DOC } from '~/content/legal/refund'
import { TERMS_DOC } from '~/content/legal/terms'
import DocSheet, { type DocSheetKey } from './DocSheet.vue'
import IssueConsentLabel from './IssueConsentLabel.vue'

// Nuxt 자동 import 대신 — 컴포넌트는 Nuxt 안에서처럼 ref · computed · watch 를 전역 이름으로 찾는다
Object.assign(globalThis, { ref, computed, watch })

// 단언이 실패해도 포털(body 로 옮겨진 시트)이 다음 테스트로 새지 않게
enableAutoUnmount(afterEach)

const settle = async () => {
  await nextTick()
  await nextTick()
}
const sheet = () => document.body.querySelector('.n-bottom-sheet__content')
const title = () => document.body.querySelector('.n-bottom-sheet__title')?.textContent?.trim()
const body = () => document.body.querySelector('.legal-sheet')?.textContent ?? ''

/** v-model 을 쥔 부모 — 시트가 스스로 닫히면 키가 null 로 돌아오는지 본다 */
const host = async (initial: DocSheetKey | null) => {
  const key = ref<DocSheetKey | null>(initial)
  const wrapper = mount(
    defineComponent({
      setup: () => () =>
        h(DocSheet, {
          modelValue: key.value,
          'onUpdate:modelValue': (v: DocSheetKey | null) => {
            key.value = v
          },
        }),
    }),
    { attachTo: document.body },
  )
  await settle()
  return { key, wrapper }
}

describe('DocSheet — 키마다 그 문서', () => {
  it.each([
    ['privacy', PRIVACY_DOC.title, '개인정보의 처리 목적', '제1장 총칙'],
    ['terms', TERMS_DOC.title, '제1장 총칙', '개인정보의 처리 목적'],
    ['refund', REFUND_DOC.title, '한눈에 보기', '제1장 총칙'],
    ['devices', 'eSIM 지원 기기', '갤럭시 (국내판)', '제1장 총칙'],
  ] as const)(
    '%s → 제목 «%s» · 본문에 «%s» · 다른 문서 글자 없음',
    async (key, heading, inBody, notInBody) => {
      await host(key)
      expect(sheet()).not.toBeNull()
      expect(title()).toBe(heading)
      expect(body()).toContain(inBody)
      expect(body()).not.toContain(notInBody)
      // 본문 영역 이름 = 문서 제목(키보드 스크롤 영역)
      expect(document.body.querySelector('.legal-sheet')?.getAttribute('aria-label')).toBe(heading)
    },
  )

  it('지원 기기 시트 = 페이지와 같은 본문 — 기준일 · 사용할 수 있어요 · 사용할 수 없어요 · 카드는 접힌 채 시작해 누르면 모델 목록이 열린다', async () => {
    await host('devices')
    expect(body()).toContain('기준일')
    expect(body()).toContain('2026.10.04')
    // D-55(2026-10-04 웹 검증) — 아이폰 16 시리즈 · 18 Pro · Duo · Air · 갤럭시 트라이폴드 · FE · 홍콩 판정
    for (const t of ['11 ~ 16 전 모델', '18 Pro · 18 Pro Max', 'Duo (접는 모델)', 'Air', 'Z 트라이폴드', 'S23 FE · S24 FE · S25 FE · S26 FE'])
      expect(body()).toContain(t)
    expect(body()).not.toContain('17 Air')
    expect(body()).toContain('XR · XS Max · 11 ~ 16 시리즈')
    expect(body()).toContain('사용할 수 있어요')
    expect(body()).toContain('사용할 수 없어요')
    // 제품명은 «아이폰»(D-52 — 카피 규칙 9/13) · 모델명 · iPad 는 그대로
    expect(body()).toContain('아이폰')
    expect(body()).not.toContain('iPhone')
    expect(body()).toContain('iPad (셀룰러 모델)')
    // 접이식은 v-show — 글자는 DOM 에 있고 카드 본문이 display:none 으로 접혀 있다
    const card = [...document.body.querySelectorAll<HTMLButtonElement>('.legal-sheet .devices-page__card-head')].find((b) =>
      b.textContent?.includes('갤럭시 (국내판)'),
    )!
    const models = card.parentElement!.querySelector<HTMLElement>('.devices-page__card-body')!
    expect(models.textContent).toContain('S23 · S24 · S25 · S26 전 모델')
    expect(models.style.display).toBe('none')
    card.click()
    await settle()
    expect(models.style.display).toBe('')
    // «사용할 수 없어요» 카드도 접힌 채 시작해 누르면 설명이 열린다
    const noCard = [...document.body.querySelectorAll<HTMLButtonElement>('.legal-sheet .devices-page__card--no .devices-page__card-head')].find((b) =>
      b.textContent?.includes('통신사 잠금 기기'),
    )!
    const desc = noCard.parentElement!.querySelector<HTMLElement>('.devices-page__card-body')!
    expect(desc.textContent).toContain('캐리어 락')
    expect(desc.style.display).toBe('none')
    noCard.click()
    await settle()
    expect(desc.style.display).toBe('')
  })

  it('법정 3종의 제목 · 본문은 문서 생성물 그대로(본문 첫 장 제목 = 생성물의 첫 «## » 줄)', async () => {
    for (const [key, doc] of [
      ['terms', TERMS_DOC],
      ['privacy', PRIVACY_DOC],
      ['refund', REFUND_DOC],
    ] as const) {
      const { wrapper } = await host(key)
      const firstH2 = doc.markdown
        .split('\n')
        .find((l) => l.startsWith('## '))!
        .slice(3)
        .trim()
      expect(document.body.querySelector('.legal-sheet .legal-md__h2')?.textContent).toBe(firstH2)
      wrapper.unmount()
    }
  })

  it('null 이면 닫혀 있다 · 열린 채 키를 바꾸면 그 문서로 바뀐다', async () => {
    const { key } = await host(null)
    expect(sheet()).toBeNull()
    key.value = 'privacy'
    await settle()
    expect(title()).toBe(PRIVACY_DOC.title)
    key.value = 'refund'
    await settle()
    expect(title()).toBe(REFUND_DOC.title)
    expect(body()).toContain('한눈에 보기')
    expect(body()).not.toContain('개인정보의 처리 목적')
  })

  it('X(접근 이름 «닫기») 를 누르면 닫힌다 — 부모 키가 null 로 돌아온다', async () => {
    const { key } = await host('terms')
    const x = document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')
    expect(x?.getAttribute('aria-label')).toBe('닫기')
    x!.click()
    await settle()
    expect(key.value).toBeNull()
    expect(sheet()).toBeNull()
  })

  it('Esc 로 닫힌다 — 부모 키가 null', async () => {
    const { key } = await host('privacy')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await settle()
    expect(key.value).toBeNull()
    expect(sheet()).toBeNull()
  })

  it('닫은 뒤 다른 문서로 다시 열면 그 문서(마지막 문서에 붙잡히지 않는다)', async () => {
    const { key } = await host('privacy')
    document.body.querySelector<HTMLButtonElement>('.n-bottom-sheet__close')!.click()
    await settle()
    key.value = 'devices'
    await settle()
    expect(title()).toBe('eSIM 지원 기기')
    expect(body()).toContain('갤럭시 (국내판)')
  })
})

describe('IssueConsentLabel — 링크마다 그 문서를 연다', () => {
  /** 문서 단계에서 기본 동작 여부를 기록하고 막는다(테스트 환경이 페이지를 옮기지 않게) */
  const clickLink = (text: string, init: MouseEventInit = {}) => {
    const a = [...document.body.querySelectorAll('a')].find((x) => x.textContent === text)!
    let prevented: boolean | undefined
    const record = (e: Event) => {
      prevented = e.defaultPrevented
      e.preventDefault()
    }
    document.addEventListener('click', record)
    a.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...init }),
    )
    document.removeEventListener('click', record)
    return { a, prevented }
  }

  it('«이용약관» → terms · «취소·환불 정책» → refund · 일반 클릭은 페이지 이동을 막는다 · href 는 남는다', async () => {
    const w = mount(IssueConsentLabel, { attachTo: document.body })
    const t = clickLink('이용약관')
    const r = clickLink('취소·환불 정책')
    expect(w.emitted('open')).toEqual([['terms'], ['refund']])
    expect([t.prevented, r.prevented]).toEqual([true, true])
    expect([t.a.getAttribute('href'), r.a.getAttribute('href')]).toEqual(['/terms', '/refund'])
  })

  it.each([{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: true }])(
    '보조키 클릭(%o)은 시트를 열지 않고 브라우저 기본 동작(새 탭 등) 그대로',
    async (mods) => {
      const w = mount(IssueConsentLabel, { attachTo: document.body })
      const { prevented } = clickLink('이용약관', mods)
      expect(w.emitted('open')).toBeUndefined()
      expect(prevented).toBe(false)
    },
  )
})
