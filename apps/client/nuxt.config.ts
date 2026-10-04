// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
import { CATALOG_SERVER_ASSET_DIR } from './shared/catalog/files'
import { buildRobotsRouteRules } from './shared/utils/robots'

export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  devtools: { enabled: true },
  pages: true,

  // + modules/catalog.ts(자동 등록) — 카탈로그(K1) 검증 · 프리렌더 목록 · 체크아웃 상품 값(catalog F-1 · F-9 · F-12)
  modules: ['@pinia/nuxt', '@vueuse/nuxt'],

  css: ['~/assets/css/main.css', '@imjohnkoo/design-vue/style.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  build: {
    transpile: ['@imjohnkoo/design-vue'],
  },

  // noindex · 캐시 금지 헤더 — 목록은 shared/utils/robots.ts 하나 (meta · robots.txt 와 같은 출처)
  routeRules: buildRobotsRouteRules(),

  nitro: {
    // 카탈로그(K1) — server/data/catalog.json(W1-1 export) 또는 표본 픽스처. server/utils/catalog.ts 가 읽는다
    serverAssets: [{ baseName: 'catalog', dir: CATALOG_SERVER_ASSET_DIR }],
    // 프리렌더 목록은 modules/catalog.ts 가 카탈로그에서 넣는다(홈 · 검색 · 국가 · 상품 · 정적 — catalog F-9).
    // 200 이 아닌 라우트가 하나라도 있으면 빌드가 실패한다(failOnError 기본값).
  },

  runtimeConfig: {
    public: {
      apiBase: '/api/v1',
      // 게스트 발급 호스트(K3) — 판매 사이트의 주문번호 조회가 이 호스트의 /verify/{주문번호} 로 보낸다.
      // 루프백(127.0.0.1 · localhost)에서 연 페이지는 이 값 대신 자기 출처로 보낸다(resolveGuestOrigin · catalog D-17) —
      // 프리렌더가 이 값을 빌드 때 굳히므로, 로컬 walk 가 실호스트로 나가지 않게 하려는 것이다.
      guestAppOrigin: 'https://app.esimmany.com',
      // PortOne V2 공개값 — /checkout-preview 전용. 값은 리포에 두지 않는다(런타임 env 로만).
      // SSM /nomacom/client/NUXT_PUBLIC_PORTONE_STORE_ID · NUXT_PUBLIC_PORTONE_TEST_CHANNEL_KEY
      // → after_deploy.sh 가 키 이름 끝 토막을 env 이름으로 쓰므로 NUXT_PUBLIC_ 접두가 그대로 런타임 덮어쓰기가 된다.
      // ⚠️ testChannelKey 에는 테스트 채널키만 — 실채널키는 다른 이름으로(Phase 2).
      portone: {
        storeId: '',
        testChannelKey: '',
      },
    },
  },
})
