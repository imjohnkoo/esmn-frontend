# Changelog

`@imjohnkoo/design-vue` 변경 사항. Semantic-ish. 날짜는 한국 시각 기준.

## 0.9.0 — 2026-11-12

### Changed — breaking (레이아웃)

- `NPinInput` — 이제 `inline-flex` 가 아니라 그릇 폭을 채우는 블록(`display: flex; width: 100%` · 최대 폭에서 멈춤)이다. 다른 요소와 한 줄에 놓거나 부모 `text-align: center` 로 가운데 두던 곳은 그릇 쪽에서 배치해야 한다(지금 소비처 — client 가입 2단계 · 데모 — 는 블록 맥락이라 영향 없음).

### Fixed

- `NPinInput` — 작은 폰에서 넘치던 것(칸 44px 고정 · 6칸 304px > 320px 폰 그릇 272px → 가로 스크롤). 그릇 `max-width` = 칸 수 × 48px + 간격, 칸은 `flex: 1 1 0` · 36~48px · 정사각(`aspect-ratio: 1`). 넓은 화면은 칸 48px(전 44px), 좁은 화면에서만 칸이 줄어든다. 그릇이 256px(6칸 × 36 + 간격)보다 좁으면 여전히 넘친다.
- `NPinInput` — 칸 이름이 라이브러리 영어 기본값(«pin input 1 of 6»)이던 것 → «코드 6자리 중 1번째». 묶음은 `role="group"` · `aria-label`(기본 «코드 입력» — 화면이 넘긴 `aria-label` 이 이긴다).
- `NAlertDialog` · `NConfirmDialog` · `NLoaderDialog` — 제목 · 본문이 어절 중간에서 끊기던 것. 제목 `word-break: keep-all; overflow-wrap: anywhere; text-wrap: balance`, 본문 같은 규칙 + `text-wrap: pretty`. `anywhere` 인 까닭: 제목 · 본문이 가운데 정렬 flex 항목이라 `break-word` 로는 공백 없는 긴 이메일 · URL 이 박스를 뚫었다(61자 이메일 제목 554px / 대화상자 280px) — `anywhere` 는 min-content 를 줄여 박스 안에서 끊는다. 한국어 어절은 `keep-all` 로 그대로 지킨다.

### Added

- `NPinInput` — `invalid`(묶음에 `aria-invalid="true"`) · `fieldLabel(position, length)`(칸 이름 바꾸기, position 은 1부터). 제안 문서의 `ariaLabel` 이름은 Vue 가 `aria-label` 속성을 같은 prop 으로 받아 화면이 넘긴 묶음 이름 문자열과 부딪혀 `fieldLabel` 로 했다.

## 0.8.1 — 2026-11-12

### Added

- `NLottie` — 일러스트 연출(결과 · 축하 · 온보딩 · 로딩 일러스트) 표준 부품. props `src` · `autoplay`(true) · `loop`(false) · `size`(120px) · `reducedMotion: 'last-frame' | 'first-frame' | 'hide'`(기본 last-frame) · `label`(있으면 `role="img"` · 없으면 `aria-hidden`) · `@complete`. 플레이어 `@lottiefiles/dotlottie-vue` 는 **마운트 뒤 동적 import**(서버 렌더 · 첫 화면 번들에 안 들어감 · lib 빌드 external). 화면 밖이면 dotlottie-web 기본(`freezeOnOffscreen`)이 멈춘다. OS «동작 줄이기» 켬이면 재생하지 않고 정지 프레임을 보여 준다(hide 는 그리지 않음) — 재생 중에 켜면 그 자리에서. `complete` 는 마운트당 1회(loop · autoplay=false 는 없음): 재생 끝 · 줄이기 정지 · hide · 플레이어 로드 실패(`loadError` · 청크 실패)에 바로 낸다. 끝난 연출은 설정을 다시 꺼도 다시 돌지 않는다. 로딩 일러스트의 줄이기 처리(정지 아이콘 + 문구 + aria-busy)는 감싸는 화면 몫. UI 상태(버튼 · 토글 · 진행 막대)에는 쓰지 않는다.
- `useReducedMotion()` — `prefers-reduced-motion` 을 반응형으로 읽는다(matchMedia + change 구독 · 컴포넌트 안에서는 마운트 뒤에 읽어 하이드레이션과 어긋나지 않음 · 서버는 false).
- 의존성 `@lottiefiles/dotlottie-vue` ~0.11.28. WASM 은 dotlottie-web 기본대로 CDN(jsdelivr → unpkg)에서 받는다.

## 0.8.0 — 2026-11-12

### Changed — breaking

- `NAlertDialog` — `width` prop 을 없애고 `size: 'default' | 'wide'`(기본 `default`)로 바꿨다. 폭은 화면에서 숫자로 넣지 않고 토큰 변형 둘 중에서 고른다 — `default` 280px · `wide` 340px(요약 표 · 필수 동의 체크처럼 내용이 많은 확인만). 옛 `:width="340"` → `size="wide"`(같은 폭). 그보다 큰 내용은 `NModal` · `NBottomSheet`.
- `NAlertDialog` · `NConfirmDialog` · `NLoaderDialog` — 폭을 직접 값(`max-width: 280px` · `width: 280px`) 대신 토큰 `--n-dialog-width-{default,wide}` · `--n-dialog-viewport-ratio`(design-tokens 0.5.1)로 읽는다: `width: min(90vw, 17.5rem)`. 루트 글자 크기 16px 에서 전과 같은 폭이다. `NConfirmDialog` 도 `size` 를 받는다. `NLoaderDialog` 는 이제 화면 폭 90% 를 넘지 않는다(311px 보다 좁은 화면에서만 차이).

## 0.7.3 — 2026-10-18

### Added

- `NBottomSheet` — `fullHeight`(전체 화면 높이). 설치 가이드 · 설명서처럼 길게 읽는 시트용 — 기본 시트는 내용만큼 자라 최대 화면의 90% 에서 멈추고, 휴대폰에서는 주소창 · 시트 위 빈 띠 · 머리줄을 빼면 읽는 칸이 화면의 절반 남짓이었다. 켜면 화면 맨 위까지 올라오고(높이 단위가 아니라 `top: 0` — 주소창이 늘고 줄어도 제목 · X 가 화면 안) 손잡이 · 위 모서리 둥글림이 없으며, 본문 칸이 남은 높이를 채운다. 스크롤은 본문 안 스크롤 영역(`flex: 1` · `min-height: 0`)이 맡는다 — 없으면 기본 시트처럼 시트 틀이 스크롤한다(본문 칸 자체는 스크롤하지 않는다: 좌우 음수 여백으로 시트 끝까지 까는 본문이 가로로 밀리지 않게). 기본값 false — 지금 쓰는 곳은 그대로.

## 0.7.2 — 2026-10-07

### Fixed

- `NBottomSheet` — 닫힐 때 시트가 옆으로 잠깐 밀리던 것(스크롤바가 폭을 차지하는 데스크톱). 열려 있는 동안 reka 스크롤 잠금이 스크롤바를 숨기고, 닫히는 순간 스크롤바가 돌아와 화면 폭이 줄면서 `left: 50%` 로 서 있던 시트가 닫힘 애니메이션 중 스크롤바 폭의 절반만큼 밀렸다(실측 15px 스크롤바 → 7.5px). 이제 «화면 폭 − 스크롤바 폭»(`--scrollbar-width`) 안에서 `margin: 0 auto` 로 가운데 — 열림 · 닫힘 모두 같은 자리이고, 열려 있는 동안 뒤 페이지(잠금의 `padding-right` 로 제자리)와도 가운데가 맞는다. 애니메이션은 세로(translateY)만. 스크롤바가 화면 위에 겹치는 환경(휴대폰 등)은 전과 같다.

## 0.7.1 — 2026-10-03

### Added

- `NCheckbox` — 문구 기본 slot. 링크 같은 꾸민 문구를 넣을 수 있다(slot 이 없으면 지금처럼 `label` 글자). 문구 칸은 `<label>` 안이라 글자를 누르면 체크되고, 문구 안 링크를 누르면 링크만 열린다(브라우저 규칙 — label 안 대화형 요소).
- `NBottomSheet` — `closable`(제목 줄 오른쪽 X 닫기 버튼 · reka `DialogClose`) · `closeLabel`(접근 이름, 기본 «닫기»). 기본값 false — 지금 쓰는 곳은 그대로.

## 0.4.0 — 2026-05-19

eSIMmany B2C 4-step flow 를 위한 **토스풍 모바일 컴포넌트 세트** 도입. design-tokens 의 `primary` 팔레트, `radius`, `shadow` 와 동시 갱신.

### Added — 신규 컴포넌트 (12)

| 컴포넌트            | 용도                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `NStepProgress`     | 4-dot horizontal bar + "n / total + label" 라벨. progress 표시                                        |
| `NPageHeading`      | eyebrow + 큰 헤딩(`title`) + 보조 설명(`description`). `\n` → CSS `pre-line` 줄바꿈                   |
| `NInfoChip`         | rounded-full chip — `label` + `value` + icon slot. brand-50 bg / brand-700 text                       |
| `NStatusPill`       | 작은 status pill — `color: success \| info \| warning \| error \| primary \| neutral`, optional `dot` |
| `NTrustNote`        | rounded-2xl gray bg + 좌측 brand icon-circle + slot — 보안/안내 카드                                  |
| `NHighlightCard`    | `variant: 'brand-gradient' \| 'plain'` — 요약/사용 기간 미리보기                                      |
| `NFieldCard`        | 클릭형 dropdown trigger — `label` / `value` / `placeholder` / `active` / `error` 상태                 |
| `NBottomSheet`      | 하단 슬라이드 시트 — `title` / `grip` / `max-width` (기본 420). v-model bool                          |
| `NLoaderDialog`     | 백드롭 블러 + 흰 카드 + 보라 스피너 + `title` / `description`. v-model bool                           |
| `NDurationCalendar` | 시작일 선택 + `duration` 자동 range. 한국식 요일색, 이전월 disable, 다음월 spillover                  |
| `NCodeRow`          | 라벨 + mono value + 복사 버튼 (break-all, 구분선). `@copied` 이벤트                                   |
| `NLinkCard`         | 아이콘 박스 + 제목 + 보조 + chevron — 외부 가이드 링크 카드                                           |

### Changed — 기존 컴포넌트 확장

- **`NInput`**
  - `variant: 'box' \| 'underline'` prop 추가
  - `label` prop 추가 (underline 모드에서 floating-label 로 작동)
  - 자동 placeholder = `' '` 로 `:placeholder-shown` 트리거
- **`NButton`**
  - `size: 'sm' \| 'md' \| 'lg' \| 'xl'` (xl 신규)
  - `xl` = h56 + radius 2xl + font 16px / weight 600
  - `xl` + `variant="primary"` 자동 `shadow.cta-brand` 적용
  - `primary` 톤 조정 — base #6239FF(500), hover 600, active 700
- **`NAlertDialog`**
  - max-width 380 → **280**
  - border-radius `radius.xl` → **`radius.3xl` (24px)**
  - box-shadow `shadow.xl` → **`shadow.modal`**
  - overlay backdrop **blur(4px)** + rgba(17,17,17,0.32)
  - body padding 32/24/24 → **44/24/8** + gap 14px
  - icon-default **48 → 64px**
  - title 18 → 17px / weight 600 → **700**
  - description **margin-top -6px** + line-height 1.55
  - actions **column** flex + 8px gap + children 100% width

### Tokens (design-tokens 0.4.0 동시 갱신)

- `colors.primary` — 토스풍 보라 팔레트 50~900 (`#f1edff` ~ `#1f0c6e`, 500=`#6239FF` 유지)
- `base.radius.3xl` — `1.5rem` (24px) 신규
- `shadows.cta-brand` — `0 10px 24px -10px rgba(98,57,255,0.5)` 신규
- `shadows.modal` — `0 30px 60px -20px rgba(17,17,17,0.25)` 신규

### Removed

- (deprecation 없음. 기존 컴포넌트는 모두 호환.)

### Migration

기존 코드 변경 없이 동작. 토스풍 모드를 사용하려면 다음 패턴으로 갱신.

```vue
<!-- before -->
<NFormField label="이름" :error="err.name">
  <NInput v-model="name" placeholder="이름을 입력하세요" />
</NFormField>

<!-- after (underline / floating label) -->
<NInput v-model="name" variant="underline" label="이름" :error="!!err.name" />
```

```vue
<!-- before -->
<NButton variant="primary" size="lg" full-width>QR 코드 발행하기</NButton>

<!-- after (sticky CTA preset) -->
<NButton variant="primary" size="xl" full-width>QR 코드 발행하기</NButton>
```

### 클라이언트 적용

`apps/client` 의 4 페이지 (`/verify`, `/details`, `/select-date`, `/view`) 가 본 컴포넌트로 전면 재작성됨. legacy `StepHeader.vue` 제거.

### Showcase

`apps/design-showcase` 에 **Esimmany Patterns** view (`/esimmany`) 추가 — 12개 신규 + 3개 확장 데모.

---

## 0.3.0 — 이전 릴리스

NLogo (esimmany), NSpinner, NAlertDialog, NConfirmDialog, NPageHeader, NCopyButton, NQRCode, NMobileLayout 신규. NSeparator 라벨 지원.
