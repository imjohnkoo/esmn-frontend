import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import NLottie from '../components/NLottie/NLottie.vue'

// 플레이어 청크를 못 받으면(배포 뒤 해시 변경 · 네트워크) 빈 자리로 두고 complete 로 기다리는 쪽을 풀어 준다
vi.mock('@lottiefiles/dotlottie-vue', () => {
  throw new Error('chunk load failed')
})

describe('NLottie 플레이어 로드 실패', () => {
  it('동적 import 가 실패해도 complete 1회 · 자리는 남는다', async () => {
    const w = mount(NLottie, { props: { src: '/x.json', label: '완료' } })
    await flushPromises()
    expect(w.emitted('complete')).toHaveLength(1)
    expect(w.attributes('role')).toBe('img')
    expect(w.find('canvas').exists()).toBe(false)
    w.unmount()
  })
})
