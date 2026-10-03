import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// 순수 유닛 테스트 + 컴포넌트 마운트 테스트(happy-dom · `*.dom.test.ts` — DB · 네트워크 없이 도는 것만)를 대상으로 한다.
// .env.local / 로컬 PG / 외부 API 에 의존하는 테스트는 여기 include 에 넣지 말 것 —
// 러너가 환경에 따라 흔들리면 회귀 자산이 아니라 소음이 된다.
// (그런 테스트가 필요하면 별도 config 로 분리하고 plan 에 "로컬 전용" 으로 표기)
export default defineConfig({
  // .vue 컴포넌트 마운트 테스트(`*.dom.test.ts` — 파일 머리 `@vitest-environment happy-dom`)용. 나머지 테스트는 node 환경 그대로
  plugins: [vue()],
  // app/ 코드의 `~/…` import (Nuxt srcDir alias) — 컴포넌트 마운트 테스트가 쓴다
  resolve: { alias: { '~': fileURLToPath(new URL('./app', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['server/**/*.{test,spec}.ts', 'app/**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/.nuxt/**', '**/.output/**'],
    // client 는 spark-mapping / verification 28건이 이미 있다.
    // 0건이 되면 «테스트가 사라진 것» 이므로 실패시킨다.
    passWithNoTests: false,
  },
})
