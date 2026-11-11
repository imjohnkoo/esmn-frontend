import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { motion as builtMotion } from '@imjohnkoo/design-tokens'
import motionJson from '@imjohnkoo/design-tokens/src/motion.json'
import { useReducedMotion } from '../composables/useReducedMotion'
import NLottie from '../components/NLottie/NLottie.vue'

// DS-MOTION — 제안 2026-11-12-motion-foundation §2(토큰) · §3 reduced-motion · §4 NLottie

enableAutoUnmount(afterEach)

// --- matchMedia 대역: OS «동작 줄이기» 설정을 테스트가 바꾼다 ---
type Listener = (e: { matches: boolean }) => void
function installMatchMedia(initial: boolean) {
  const listeners = new Set<Listener>()
  const mql = {
    matches: initial,
    addEventListener: (_: string, cb: Listener) => listeners.add(cb),
    removeEventListener: (_: string, cb: Listener) => listeners.delete(cb),
  }
  const matchMedia = vi.fn((q: string) => {
    expect(q).toBe('(prefers-reduced-motion: reduce)')
    return mql
  })
  vi.stubGlobal('matchMedia', matchMedia)
  return {
    listeners,
    set(matches: boolean) {
      mql.matches = matches
      for (const cb of [...listeners]) cb({ matches })
    },
  }
}
afterEach(() => vi.unstubAllGlobals())

// --- dotlottie-vue 대역: 플레이어 인스턴스 호출을 기록한다 ---
const players = vi.hoisted(() => [] as Array<ReturnType<typeof makeFakeDotLottie>>)
function makeFakeDotLottie() {
  const handlers = new Map<string, Set<() => void>>()
  return {
    isLoaded: false,
    isPlaying: false,
    totalFrames: 60,
    props: {} as Record<string, unknown>,
    pause: vi.fn(),
    play: vi.fn(),
    setFrame: vi.fn(),
    addEventListener(t: string, cb: () => void) {
      if (!handlers.has(t)) handlers.set(t, new Set())
      handlers.get(t)!.add(cb)
    },
    removeEventListener(t: string, cb: () => void) {
      handlers.get(t)?.delete(cb)
    },
    fire(t: string) {
      if (t === 'load') this.isLoaded = true
      for (const cb of handlers.get(t) ?? []) cb()
    },
  }
}
vi.mock('@lottiefiles/dotlottie-vue', () => ({
  DotLottieVue: defineComponent({
    props: { src: String, autoplay: Boolean, loop: Boolean },
    setup(props, { expose }) {
      const dl = makeFakeDotLottie()
      dl.props = props
      players.push(dl)
      expose({ getDotLottieInstance: () => dl })
      return () => h('canvas')
    },
  }),
}))
beforeEach(() => {
  players.length = 0
})

async function mountLottie(props: Record<string, unknown> = {}) {
  const w = mount(NLottie, { props: { src: '/check.json', ...props } })
  await flushPromises()
  await nextTick()
  return w
}

describe('토큰 motion.json — 수치형', () => {
  it('duration 7 · easing 6 · spring 2 · stagger 3 — 제안 §2 값 그대로', () => {
    expect(motionJson).toEqual({
      duration: {
        instant: 0,
        press: 120,
        fast: 150,
        base: 200,
        moderate: 300,
        sheet: 500,
        celebrate: 1000,
      },
      easing: {
        out: [0.23, 1, 0.32, 1],
        inOut: [0.77, 0, 0.175, 1],
        drawer: [0.32, 0.72, 0, 1],
        standard: [0.25, 0.1, 0.25, 1],
        overshoot: [0.34, 1.56, 0.64, 1],
        linear: [0, 0, 1, 1],
      },
      spring: {
        settle: { duration: 400, dampingRatio: 1 },
        sheet: { duration: 300, dampingRatio: 0.8 },
      },
      stagger: { item: 40, maxTotal: 300, maxTotalOnboarding: 500 },
    })
  })

  it('빌드된 JS 는 숫자 그대로 export 한다(문자열 아님)', () => {
    expect(builtMotion).toEqual(motionJson)
    expect(typeof builtMotion.duration.fast).toBe('number')
  })

  describe('빌드된 CSS', () => {
    const css = readFileSync(`${process.cwd()}/../design-tokens/dist/css/tokens.css`, 'utf8')
    const vars = (prefix: string) =>
      css.match(new RegExp(`--n-${prefix}[a-z-]*: [^;]+;`, 'g')) ?? []

    it('시간은 ms · 곡선은 cubic-bezier · 스태거는 ms 로 낸다', () => {
      expect(vars('motion-duration-')).toEqual([
        '--n-motion-duration-instant: 0ms;',
        '--n-motion-duration-press: 120ms;',
        '--n-motion-duration-fast: 150ms;',
        '--n-motion-duration-base: 200ms;',
        '--n-motion-duration-moderate: 300ms;',
        '--n-motion-duration-sheet: 500ms;',
        '--n-motion-duration-celebrate: 1000ms;',
      ])
      expect(vars('motion-easing-')).toEqual([
        '--n-motion-easing-out: cubic-bezier(0.23, 1, 0.32, 1);',
        '--n-motion-easing-in-out: cubic-bezier(0.77, 0, 0.175, 1);',
        '--n-motion-easing-drawer: cubic-bezier(0.32, 0.72, 0, 1);',
        '--n-motion-easing-standard: cubic-bezier(0.25, 0.1, 0.25, 1);',
        '--n-motion-easing-overshoot: cubic-bezier(0.34, 1.56, 0.64, 1);',
        '--n-motion-easing-linear: cubic-bezier(0, 0, 1, 1);',
      ])
      expect(vars('motion-stagger-')).toEqual([
        '--n-motion-stagger-item: 40ms;',
        '--n-motion-stagger-max-total: 300ms;',
        '--n-motion-stagger-max-total-onboarding: 500ms;',
      ])
    })

    it('스프링은 웹에 내지 않고, 배열이 쉼표 문자열로 새지 않는다', () => {
      expect(css).not.toMatch(/--n-motion-spring/)
      expect(css).not.toMatch(/--n-motion[a-z-]*: [\d.]+,[\d.]+/)
    })

    it('옛 transition 토큰은 값 그대로(화면 변화 0)', () => {
      expect(vars('transition-')).toEqual([
        '--n-transition-fast: 150ms ease;',
        '--n-transition-normal: 250ms ease;',
        '--n-transition-slow: 350ms ease;',
      ])
    })
  })
})

describe('useReducedMotion', () => {
  const Probe = defineComponent({
    setup() {
      const reduced = useReducedMotion()
      return () => h('i', String(reduced.value))
    },
  })

  it('마운트 때 OS 설정을 읽고, 바뀌면 따라가고, 언마운트하면 구독을 푼다', async () => {
    const mm = installMatchMedia(true)
    const w = mount(Probe)
    await nextTick()
    expect(w.text()).toBe('true')
    mm.set(false)
    await nextTick()
    expect(w.text()).toBe('false')
    expect(mm.listeners.size).toBe(1)
    w.unmount()
    expect(mm.listeners.size).toBe(0)
  })

  it('matchMedia 가 없으면 false', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(mount(Probe).text()).toBe('false')
  })
})

describe('NLottie', () => {
  it('label 이 있으면 role="img" + 이름, 없으면 장식(aria-hidden) · 기본 크기 120px', async () => {
    installMatchMedia(false)
    const named = await mountLottie({ label: '발급 완료' })
    expect(named.attributes()).toMatchObject({ role: 'img', 'aria-label': '발급 완료' })
    expect(named.attributes('aria-hidden')).toBeUndefined()
    expect(named.attributes('style')).toContain('width: 120px; height: 120px')

    const deco = await mountLottie()
    expect(deco.attributes('aria-hidden')).toBe('true')
    expect(deco.attributes('role')).toBeUndefined()
  })

  it('줄이기 끔 — src · autoplay · loop 를 그대로 넘기고, 재생이 끝나면 complete', async () => {
    installMatchMedia(false)
    const w = await mountLottie({ loop: false })
    const dl = players.at(-1)!
    expect(dl.props).toMatchObject({ src: '/check.json', autoplay: true, loop: false })
    dl.fire('load')
    expect(dl.setFrame).not.toHaveBeenCalled()
    expect(w.emitted('complete')).toBeUndefined()
    dl.fire('complete')
    expect(w.emitted('complete')).toHaveLength(1)
  })

  it.each([
    ['last-frame', 59],
    ['first-frame', 0],
  ] as const)(
    '줄이기 켬 · %s — 재생하지 않고 그 프레임에 멈춘 뒤 complete',
    async (mode, frame) => {
      installMatchMedia(true)
      const w = await mountLottie({ reducedMotion: mode })
      const dl = players.at(-1)!
      expect(dl.props.autoplay).toBe(false)
      dl.fire('load')
      expect(dl.pause).toHaveBeenCalled()
      expect(dl.setFrame).toHaveBeenLastCalledWith(frame)
      expect(w.emitted('complete')).toHaveLength(1)
    },
  )

  it('줄이기 켬 · hide — 아무것도 그리지 않고 플레이어도 만들지 않는다', async () => {
    installMatchMedia(true)
    const w = await mountLottie({ reducedMotion: 'hide' })
    expect(w.html()).toBe('<!--v-if-->')
    expect(players).toHaveLength(0)
    expect(w.emitted('complete')).toHaveLength(1)
  })

  it('loop 연출은 줄이기 켬이어도 complete 를 내지 않는다', async () => {
    installMatchMedia(true)
    const w = await mountLottie({ loop: true })
    players.at(-1)!.fire('load')
    expect(w.emitted('complete')).toBeUndefined()
  })

  it('보는 중에 설정이 바뀌면 따라간다 — 켬이면 멈춤 · 끔이면 다시 재생', async () => {
    const mm = installMatchMedia(false)
    await mountLottie()
    const dl = players.at(-1)!
    dl.fire('load')
    mm.set(true)
    await nextTick()
    expect(dl.pause).toHaveBeenCalled()
    expect(dl.setFrame).toHaveBeenLastCalledWith(59)
    mm.set(false)
    await nextTick()
    expect(dl.play).toHaveBeenCalledTimes(1)
  })
})
