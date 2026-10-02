import { describe, expect, it } from 'vitest'
import { LEGAL_LINKS, SHELL_MENU, SHELL_TABS, activeTabOf, tabAriaCurrent } from './shell-nav'

describe('activeTabOf', () => {
  it.each([
    ['/', 'home'],
    ['/search', 'home'],
    ['/my-esim', 'my-esim'],
    ['/guide', 'guide'],
    ['/guide/devices', 'guide'],
    ['/supported-devices', 'guide'],
    ['/my', 'my'],
    ['/my/', 'my'],
    ['/terms', 'my'],
    ['/privacy', 'my'],
    ['/refund', 'my'],
    ['/my#cs', 'my'],
  ])('%s → %s', (path, tab) => {
    expect(activeTabOf(path)).toBe(tab)
  })

  it.each([
    '/verify/1',
    '/details/1',
    '/select-date/1',
    '/view/1',
    '/checkout-preview',
    '/business', // D-39 — 페이지 없음(404)
    '/myanmar',
    '/guidex',
  ])('%s → 활성 없음', (path) => {
    expect(activeTabOf(path)).toBeNull()
  })
})

describe('shell 목록', () => {
  it('하단 탭은 홈 · 내 eSIM · 가이드 · 마이 순서 4개 (D4)', () => {
    expect(SHELL_TABS.map((tab) => tab.label)).toEqual(['홈', '내 eSIM', '가이드', '마이'])
  })

  it('탭 목적지 (spec F-6)', () => {
    expect(SHELL_TABS.map((tab) => [tab.label, tab.to])).toEqual([
      ['홈', '/'],
      ['내 eSIM', '/my-esim'],
      ['가이드', '/guide'],
      ['마이', '/my'],
    ])
  })

  it('전체 메뉴 3묶음 · 항목 · 목적지 (spec F-5)', () => {
    expect(
      SHELL_MENU.map((group) => [group.title, group.links.map((l) => [l.label, l.to])]),
    ).toEqual([
      [
        'eSIM',
        [
          ['국가 검색', '/search'],
          ['내 eSIM 조회', '/my-esim'],
          ['설치 가이드', '/guide'],
          ['지원 기기 확인', '/supported-devices'],
        ],
      ],
      ['고객지원', [['고객센터', '/my#cs']]],
      [
        '약관 및 정책',
        [
          ['이용약관', '/terms'],
          ['개인정보처리방침', '/privacy'],
          ['취소·환불 정책', '/refund'],
        ],
      ],
    ])
  })

  it('각 탭의 목적지는 그 탭을 활성으로 만든다', () => {
    for (const tab of SHELL_TABS) {
      expect(activeTabOf(tab.to)).toBe(tab.key)
    }
  })

  it('약관 및 정책 3종이 전체 메뉴에 그대로 들어 있다 — 사업자정보 링크 없음(D-39)', () => {
    const legal = SHELL_MENU.find((group) => group.title === '약관 및 정책')
    expect(legal?.links).toEqual(LEGAL_LINKS)
    expect(LEGAL_LINKS.map((link) => link.to)).toEqual(['/terms', '/privacy', '/refund'])
  })

  it('전체 메뉴는 체크아웃 미리보기를 가리키지 않는다 (K9 — 링크 0)', () => {
    const targets = SHELL_MENU.flatMap((group) => group.links.map((link) => link.to))
    expect(targets.some((to) => to.includes('checkout-preview'))).toBe(false)
  })
})

describe('tabAriaCurrent (spec F-6)', () => {
  const tab = (key: string) => SHELL_TABS.find((t) => t.key === key)!

  it('탭 주소와 같은 경로 → page (끝 / · 쿼리 · 해시 무시)', () => {
    expect(tabAriaCurrent('/', tab('home'))).toBe('page')
    expect(tabAriaCurrent('/my', tab('my'))).toBe('page')
    expect(tabAriaCurrent('/my/', tab('my'))).toBe('page')
    expect(tabAriaCurrent('/my#cs', tab('my'))).toBe('page')
    expect(tabAriaCurrent('/my-esim?x=1', tab('my-esim'))).toBe('page')
    expect(tabAriaCurrent('/guide', tab('guide'))).toBe('page')
  })

  it('탭 구역의 다른 경로 → true (현재 페이지로 읽히지 않게)', () => {
    expect(tabAriaCurrent('/terms', tab('my'))).toBe('true')
    expect(tabAriaCurrent('/refund', tab('my'))).toBe('true')
    expect(tabAriaCurrent('/search', tab('home'))).toBe('true')
    expect(tabAriaCurrent('/supported-devices', tab('guide'))).toBe('true')
  })

  it('다른 탭 · 탭 밖 경로 → 없음', () => {
    expect(tabAriaCurrent('/terms', tab('home'))).toBeUndefined()
    expect(tabAriaCurrent('/view/1', tab('my-esim'))).toBeUndefined()
    expect(tabAriaCurrent('/checkout-preview', tab('home'))).toBeUndefined()
  })

  it('한 경로에서 page 는 많아야 탭 하나', () => {
    for (const path of ['/', '/my', '/terms', '/guide', '/search', '/my-esim']) {
      const pages = SHELL_TABS.filter((t) => tabAriaCurrent(path, t) === 'page')
      expect(pages.length).toBeLessThanOrEqual(1)
    }
  })
})
