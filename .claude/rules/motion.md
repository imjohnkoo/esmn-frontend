# 모션 (DS-MOTION 2026-11-12)

- **모션 값은 `motion.*` 토큰만** — 웹 `var(--n-motion-duration-*)` · `var(--n-motion-easing-*)` · `var(--n-motion-stagger-*)`, 앱 `theme.motion.*`(`@imjohnkoo/design-tokens` `motion.json` 정본). 시간 · 곡선 숫자를 직접 쓰지 않는다(옛 `--n-transition-*` · 직접 값 약 30곳은 다음 트랙에서 옮긴다). 사용 규칙(연출별 시간 · 곡선 · 금지 · reduced-motion)은 위키 design-system 모션 절(초안 = esmn-manager `docs/design/system/2026-11-12-motion-foundation.md` §3).
- **Reanimated API 는 설치된 버전 문서부터** — https://docs.swmansion.com/react-native-reanimated/llms.txt (설치 4.2.1 · 3.x 문법 금지). 앱 애니메이션 작업 기준은 `.claude/skills/expo-animation`(expo/skills@a9e5bd3fa0 고정 복사).
- **NLottie 를 client · admin 화면에 붙이기 전에 dotlottie WASM 을 자체 호스팅한다** — 지금은 라이브러리 기본값(jsdelivr → unpkg CDN)이고 쇼케이스 전용이다(`setWasmUrl`).
