// F-17 · AC-7.1 · I-10 — 회원 화면 진입 판정
import { describe, expect, it } from 'vitest'
import { decideMemberRoute, type AuthSessionView } from './member-guard'

const OFF: AuthSessionView = { methods: [], user: null }
const ANON: AuthSessionView = { methods: ['email'], user: null }
const USER: AuthSessionView = {
  methods: ['email'],
  user: { emailMasked: 'wa***@example.com', providers: ['email'] },
}

describe('decideMemberRoute', () => {
  it.each(['/login', '/signup', '/password/reset', '/password/reset/new', '/my/withdraw'])(
    '플래그 off → %s 404',
    (p) => {
      expect(decideMemberRoute(p, p, undefined, OFF)).toEqual({ action: 'not-found' })
      expect(decideMemberRoute(p, p, undefined, { ...USER, methods: [] })).toEqual({
        action: 'not-found',
      })
    },
  )

  it('탈퇴 화면은 로그인 필요 → /login?next=', () => {
    expect(decideMemberRoute('/my/withdraw', '/my/withdraw', undefined, ANON)).toEqual({
      action: 'redirect',
      to: '/login?next=%2Fmy%2Fwithdraw',
    })
    expect(decideMemberRoute('/my/withdraw', '/my/withdraw', undefined, USER)).toEqual({
      action: 'continue',
    })
  })

  it('로그인 상태로 로그인 · 가입 화면 → next(같은 사이트만) 또는 /my', () => {
    expect(
      decideMemberRoute('/login', '/login?next=/products/fra00', '/products/fra00', USER),
    ).toEqual({
      action: 'redirect',
      to: '/products/fra00',
    })
    expect(decideMemberRoute('/signup', '/signup', '//evil.example', USER)).toEqual({
      action: 'redirect',
      to: '/my',
    })
  })

  it('비로그인은 로그인 · 가입 · 재설정을 그대로', () => {
    for (const p of ['/login', '/signup', '/password/reset', '/password/reset/new']) {
      expect(decideMemberRoute(p, p, undefined, ANON)).toEqual({ action: 'continue' })
    }
  })

  it('D-23 — 로그인 상태로 재설정 화면(메일 링크)을 열어도 그대로 — /my 로 튕기며 프래그먼트 토큰을 끌고 가지 않는다', () => {
    for (const p of ['/password/reset', '/password/reset/new']) {
      expect(decideMemberRoute(p, p, undefined, USER)).toEqual({ action: 'continue' })
    }
  })

  it('끝 / 로 가드를 비켜 가지 못한다', () => {
    expect(decideMemberRoute('/my/withdraw/', '/my/withdraw/', undefined, ANON)).toMatchObject({
      action: 'redirect',
    })
    expect(decideMemberRoute('/login/', '/login/', undefined, USER)).toEqual({
      action: 'redirect',
      to: '/my',
    })
  })
})
