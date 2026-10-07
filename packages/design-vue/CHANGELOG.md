# Changelog

`@imjohnkoo/design-vue` 변경 사항. Semantic-ish. 날짜는 한국 시각 기준.

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
