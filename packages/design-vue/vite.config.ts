import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import dts from 'vite-plugin-dts'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue(),
    dts({
      include: ['src/**/*.ts', 'src/**/*.vue'],
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      // 다중 엔트리 — `.` (컴포넌트) / `./nuxt` (Nuxt 모듈) / `./charts` (차트) 를 분리한다.
      // Nuxt 모듈은 @nuxt/kit 에, 차트는 vue-chrts 에 의존하므로 메인 번들에 섞이면
      // 그 의존성을 설치하지 않은 소비자(design-showcase 등)가 해석 불가 import 를 만난다.
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        nuxt: resolve(__dirname, 'src/nuxt.ts'),
        charts: resolve(__dirname, 'src/charts.ts'),
      },
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => `${entryName}.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      // @nuxt/kit·vue-chrts 는 optional peer — 각각 Nuxt 앱 / 차트 소비자에서만
      // 해석되면 된다. vue-chrts 는 `vue-chrts/enums` 서브패스로도 import 하므로
      // 정규식을 함께 둔다 (문자열 external 은 정확히 일치하는 id 만 잡는다).
      // dotlottie-vue 는 NLottie 가 마운트 뒤 동적 import 한다 — 소비자 번들러가 따로 쪼개게 둔다.
      external: ['vue', '@nuxt/kit', 'vue-chrts', /^vue-chrts\//, '@lottiefiles/dotlottie-vue'],
      output: {
        globals: {
          vue: 'Vue',
        },
        // ⚠️ CSS 파일명 고정. `@imjohnkoo/design-vue/style.css` 가 이 경로를 가리키고
        // client(배포 중)·showcase·demo 가 그대로 import 한다. 이름이 바뀌면 전부 깨진다.
        assetFileNames: (asset) => {
          const name = asset.names?.[0] ?? ''
          return name.endsWith('.css') ? 'design-vue.css' : '[name][extname]'
        },
      },
    },
    cssCodeSplit: false,
  },
})
