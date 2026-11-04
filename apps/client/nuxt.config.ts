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

  // favicon(public/ — 16·32·48 ICO · 아이폰 180 PNG). app.vue 가 아니라 여기 — error.vue 는 app.vue 대신 그려진다
  app: {
    head: {
      link: [
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
    },
  },

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
    // 토스 시크릿 키 — 서버 전용(confirm 라우트). SSM /nomacom/client/NUXT_TOSS_SECRET_KEY(SecureString · after_deploy.sh 가
    // --with-decryption 으로 읽는다) → env NUXT_TOSS_SECRET_KEY 가 런타임에 덮는다. 심사 기간 test_gsk_* · 계약 뒤 live_gsk_*(코드 0)
    tossSecretKey: '',
    public: {
      apiBase: '/api/v1',
      // 게스트 발급 호스트(K3) — 판매 사이트의 주문번호 조회가 이 호스트의 /verify/{주문번호} 로 보낸다.
      // 루프백(127.0.0.1 · localhost)에서 연 페이지는 이 값 대신 자기 출처로 보낸다(resolveGuestOrigin · catalog D-17) —
      // 프리렌더가 이 값을 빌드 때 굳히므로, 로컬 walk 가 실호스트로 나가지 않게 하려는 것이다.
      guestAppOrigin: 'https://app.esimmany.com',
      // 토스페이먼츠 결제위젯 클라이언트 키 — /checkout-preview 전용 공개값(shell D-12 · D-59). 값은 리포에 두지 않는다(런타임 env 로만).
      // SSM /nomacom/client/NUXT_PUBLIC_TOSS_CLIENT_KEY(String) → after_deploy.sh 가 키 이름 끝 토막을 env 이름으로 쓴다.
      // 심사 기간은 test_gck_* · 계약 뒤 같은 이름에 live_gck_*(코드 0). 비우면 결제 버튼 비활성
      toss: {
        clientKey: '',
      },
    },
  },
})
