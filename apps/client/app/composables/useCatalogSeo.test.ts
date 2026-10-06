import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCatalogSeo } from './useCatalogSeo'

/** canonical · og:url(catalog spec F-9 · client-guide D-14) — 기본은 이 페이지 경로, canonicalPath 를 주면 그 경로(가이드 전용판 → 사이트판) */
const seoMeta = vi.fn()
const head = vi.fn()
let path = '/'
beforeEach(() => {
  seoMeta.mockClear()
  head.mockClear()
  vi.stubGlobal('useRoute', () => ({ path }))
  vi.stubGlobal('useSeoMeta', seoMeta)
  vi.stubGlobal('useHead', head)
})
afterEach(() => vi.unstubAllGlobals())

const canonical = () =>
  (head.mock.calls[0]![0] as { link: { rel: string; href: string }[] }).link[0]
const ogUrl = () => (seoMeta.mock.calls[0]![0] as { ogUrl: string }).ogUrl

describe('useCatalogSeo — canonical', () => {
  it('canonicalPath 없으면 이 페이지 경로(끝 / 제거)', () => {
    path = '/guide/ios/'
    useCatalogSeo({ title: 't', description: 'd' })
    expect(canonical()).toEqual({ rel: 'canonical', href: 'https://esimmany.com/guide/ios' })
    expect(ogUrl()).toBe('https://esimmany.com/guide/ios')
  })

  it('canonicalPath 를 주면 그 경로 — 전용판(/install-guide/ios)의 canonical · og:url = 사이트판', () => {
    path = '/install-guide/ios'
    useCatalogSeo({ title: 't', description: 'd' }, undefined, '/guide/ios')
    expect(canonical()).toEqual({ rel: 'canonical', href: 'https://esimmany.com/guide/ios' })
    expect(ogUrl()).toBe('https://esimmany.com/guide/ios')
  })
})
