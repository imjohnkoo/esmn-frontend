import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h } from 'vue'
import { renderToString } from '@vue/server-renderer'
import NLottie from '../components/NLottie/NLottie.vue'

// 제안 §4 · §8 — 플레이어(WASM)는 마운트 뒤에만 불러온다. 서버 렌더는 빈 자리만 낸다.
const loaded = vi.hoisted(() => ({ n: 0 }))
vi.mock('@lottiefiles/dotlottie-vue', () => {
  loaded.n++
  return { DotLottieVue: {} }
})

describe('NLottie SSR', () => {
  it('서버 렌더에서 dotlottie-vue 를 불러오지 않고 크기만 잡은 자리를 낸다', async () => {
    const html = await renderToString(
      createSSRApp({ render: () => h(NLottie, { src: '/x.json', size: 80, label: '완료' }) }),
    )
    expect(loaded.n).toBe(0)
    expect(html).toContain('role="img"')
    expect(html).toContain('width:80px;height:80px;')
    expect(html).not.toContain('<canvas')
  })
})
