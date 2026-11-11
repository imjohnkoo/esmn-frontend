# Changelog

`@imjohnkoo/design-mobile` 변경 사항. Semantic-ish (0.x: breaking = minor / 그 외 = patch). 날짜는 한국 시각 기준.

## 0.4.1 — 2026-11-12

### Added

- `theme.motion` — design-tokens `motion.json` 숫자 그대로(`duration` ms · `easing` cubic-bezier 4숫자 → `Easing.bezier(...)` · `spring` → Reanimated `withSpring` · `stagger` ms). 웹 `--n-motion-*` 와 같은 값.
- `NLottie` — design-vue 와 같은 규칙(`source` · `autoplay` · `loop` · `size` · `reducedMotion` · `label` · `onComplete`). `lottie-react-native` 위 · OS «동작 줄이기»면 `progress` 0/1 정지 프레임 · hide 는 null. 설정을 아직 모르는 첫 응답 전에는 플레이어를 그리지 않는다(켬 기기에서 첫 프레임이 재생되지 않게). `onComplete` 는 마운트당 1회(loop · autoplay=false 는 없음) — 줄이기 켬이면 정지 즉시. 끝난 연출은 설정을 다시 꺼도 처음부터 돌지 않는다. 화면 밖 일시정지는 없음(RN 가시성 API 부재 — loop 연출을 스크롤 목록에 넣을 때 추가). `dev:web` 미리 보기에서는 lottie-react-native 웹 구현이 `progress` 를 무시해 정지 프레임이 첫 프레임으로 보인다(네이티브 무관).
- `useReducedMotion()` — `AccessibilityInfo` 구독 하나를 앱 전체가 공유(`useSyncExternalStore`) · `null` = 아직 모름.
- 테스트 러너 — vitest + happy-dom(`src/__tests__/NLottie.test.tsx` — react-native · lottie-react-native 대역).
- peer `lottie-react-native` >=7.3.0(Expo SDK 55 = ~7.3.4 · Expo Go 포함).

## 0.4.0 — 2026-11-12

### Changed — breaking

- `NAlertDialog` — `width` prop(기본 300) 을 없애고 `size: 'default' | 'wide'`(기본 `default`)로 바꿨다. 폭은 design-vue 와 같은 토큰 `dialog.width`(default 280 · wide 340)와 `dialog.viewport-ratio`(화면 폭 90% 상한)로 정한다 — **기본 폭 300 → 280**(웹과 통일). 옛 `width={340}` → `size="wide"`.
- `NLoaderDialog` — `minWidth: 220` → 토큰 default 폭(280) 고정 · 화면 폭 90% 상한.
- `theme.dialog` — `components.json` 의 `dialog` 토큰(`width.default` · `width.wide` px 숫자 · `viewportRatio` 0~1).

## 0.3.1 — 2026-08-19

mobile 4-step 발급 흐름 (weekly B 트랙) 을 위한 **design-vue 0.4.0 "토스풍 세트" 의 RN 포팅**. 전부 additive — breaking 없음.

### Added — 신규 컴포넌트 (12)

| 컴포넌트            | 용도                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------- |
| `NStepProgress`     | 4-bar progress + "n / total · label" 라벨                                                  |
| `NPageHeading`      | eyebrow + 큰 헤딩 + 보조 설명 (`\n` 줄바꿈 — RN Text 기본 동작)                            |
| `NInfoChip`         | rounded-full chip — `label` + `value` + `icon`. brand-50 bg / brand-700 text               |
| `NStatusPill`       | status pill — `color: success \| info \| warning \| error \| primary \| neutral` + `dot`   |
| `NTrustNote`        | neutral-50 카드 + 좌측 brand icon-circle + `title`/`children` — 보안/정책 안내             |
| `NHighlightCard`    | brand-50 카드 — 요약/사용 기간 미리보기                                                    |
| `NFieldCard`        | 탭형 dropdown trigger — `label`/`value`/`placeholder`/`active`/`error`                     |
| `NAlertDialog`      | 중앙 Modal 다이얼로그 — `title`/`color`/`closable`/`actions`/`width`                       |
| `NLoaderDialog`     | 백드롭 + 흰 카드 + 브랜드 스피너 — `title`/`description`                                   |
| `NDurationCalendar` | 시작일 선택 + `duration` 자동 range. `CalDate` 타입 동봉. 과거 disable, spillover dim      |
| `NCodeRow`          | 라벨 + mono value + 복사 버튼. 클립보드는 `onCopy` 콜백으로 앱이 주입 (패키지 무의존 유지) |
| `NLinkCard`         | 아이콘 박스 + 제목 + 보조 + chevron — 외부 가이드 링크 카드                                |

### Changed — 기존 컴포넌트 확장 (additive)

- **`NButton`** — `size: 'xl'` 추가 (minHeight 56 + radius 2xl + font 16/600 CTA — design-vue xl 대응)
- **`NBottomSheet`** — `footer` prop 추가 (하단 고정 CTA 영역, 상단 divider)
- **`NAlert`** — 좌측 4px 액센트 바 제거, 배경 + radius 만 남긴 심플 박스로 변경 (john 디자인 피드백 2026-08-23). `colorMap` 의 미사용 `border` 키도 정리
- **`NInput`** — 웹(react-native-web) 한정 `outlineStyle: 'none'` 주입. RNW 가 `TextInput` 을 `<input>` 으로 렌더해 브라우저 UA 가 포커스 시 `outline: auto` (Chrome/macOS `#E59700` 주황) 를 그리던 것을 차단. 포커스 표시는 컨테이너 보더 (`primary/500`) 가 단독 담당. `Platform.select` 로 web 에만 적용하므로 네이티브 렌더는 불변

## 0.3.0 — 이전

RN 기본 컴포넌트 16종 (NButton, NBottomSheet, NScreen, NInput, NTabBar 등) + design-tokens 기반 `theme`.
