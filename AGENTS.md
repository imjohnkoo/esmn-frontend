# AGENTS.md — esmn-frontend (CLAUDE.md 는 심링크)

## 개요

Nomacom 프론트엔드 프로젝트들을 통합한 Yarn 4 + Turborepo monorepo. 참조 템플릿은 `m8-frontend` 였다.

2026-10-09 `nomacom-frontend` → `esmn-frontend` 개명(폴더·GitHub — remote `imjohnkoo/esmn-frontend` · 메인 클론 `~/dev/current-projects/esmn-frontend`). 서비스·AWS·Docker·CodeDeploy·스킬 이름과 기존 워크트리 폴더(`~/orca/workspaces/nomacom-frontend/`)는 그대로.

## 구성 원칙

- **패키지 매니저**: Yarn 4.5.3 (Berry, `nodeLinker: node-modules`). Corepack 로 버전 고정
- **오케스트레이션**: Turborepo 2.3. `^build` 토폴로지컬 의존성으로 `design-tokens → design-vue → apps` 순서 자동화
- **내부 의존성**: `workspace:*` 프로토콜. npm 레지스트리가 아닌 로컬 workspace 해석
- **TypeScript**: 루트 `tsconfig.base.json` 을 각 패키지가 `extends`
- **Lint/Format**: 루트 `eslint.config.js` (flat config) + `.prettierrc` 공유

## Workspaces

### Packages (`packages/*`)

| 이름                       | 역할                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| `@imjohnkoo/design-tokens` | 토큰 JSON → CSS 변수 + JS 상수 빌드 (tsx 스크립트)                      |
| `@imjohnkoo/design-vue`    | Vue 3 컴포넌트 라이브러리. Vite lib build + `vite-plugin-dts`           |
| `@imjohnkoo/design-mobile` | React Native 컴포넌트. `tsc --noEmit` 타입 체크만 수행, src 직접 export |

### Apps (`apps/*`)

| 이름                                | 프레임워크                        | 참고                                                                                                                                                                                 |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `nomacom-admin`                     | Nuxt 4                            | `app/` 디렉토리 구조, `server/` 에 Nitro API + Drizzle schema                                                                                                                        |
| `nomacom-client`                    | Nuxt 4                            | Nuxt 3 → 4 마이그레이션됨. `app/` 로 이동, server 코드는 상대 경로 import                                                                                                            |
| `nomacom-mobile`                    | Expo SDK 55 (RN 0.83, React 19.2) | Expo Router v7, `src/app/` 루트. Metro 는 SDK 52+ 부터 monorepo 자동 설정 (config 없음). iOS eSIM 설치는 Apple Universal Link 사용 — MVNO 라 CoreTelephony entitled API 경로는 불가. |
| `design-showcase`                   | Vite + Vue                        | 디자인 시스템 개발용. vite.config 에서 source alias 사용                                                                                                                             |
| `design-demo`, `design-demo-webapp` | Vite + Vue                        | 디자인 시스템 데모                                                                                                                                                                   |
| `design-storybook-mobile`           | Storybook                         | React Native Web 기반                                                                                                                                                                |

## Turbo 파이프라인

`turbo.json`:

- `build`: `dependsOn: ["^build"]`, outputs `dist/**`, `.output/**`, `.nuxt/**`
- `dev`: `cache: false`, `persistent: true` — 병렬 dev 서버
- `lint`, `typecheck`: `dependsOn: ["^build"]`
- `test`: `dependsOn: ["build"]`
- `clean`: `cache: false`

## 모바일 앱 노트 (apps/mobile)

- **Expo managed workflow** 만 사용. bare workflow 로 가지 말 것 — iOS 17.4+ Universal Link 방식이라 native 모듈이 거의 불필요하고, Expo managed 를 유지하면 `yarn install` 외 추가 native 빌드 툴체인이 필요 없음
- **Metro 설정은 건드리지 말 것** — Expo SDK 52+ 부터 monorepo 가 자동 지원됨. `metro.config.js` 를 만들면 오히려 `watchFolders`, `nodeModulesPaths` 등이 중복되어 문제가 발생함
- **루트 디렉토리는 `src/app/`** — SDK 55 의 새 기본값. 이전 `app/` 루트 대신 `src/app/` 을 사용하므로 루트의 `app/` 폴더를 만들면 충돌
- **tsconfig 는 `expo/tsconfig.base` 확장** — 루트 `tsconfig.base.json` 이 아님. Nuxt/Vue 용 설정과 RN 용 module resolution 이 다르기 때문
- **peer dep 경고 중 `@expo/log-box` 누락** — expo-router 가 요구하지만 런타임 문제 없음, 필요시 `yarn workspace nomacom-mobile add @expo/log-box`
- **`simctl` 에러는 무시** — `dev:web` 만 쓸 때는 iOS Simulator 가 없어서 뜨는 경고. dev server 동작에는 무관
- **Maya API 연동은 `apps/client/server/api/v1/*` 의 Nitro 엔드포인트를 그대로 호출** — 모바일용 별도 백엔드 필요 없음

## Nuxt 4 마이그레이션 노트 (apps/client)

Nuxt 3 → 4 변환 시 적용한 변경:

1. **디렉토리 구조**: `app.vue`, `assets/`, `components/`, `composables/`, `pages/`, `plugins/`, `stores/`, `utils/`, `types/` 를 `app/` 하위로 이동
2. **Server 코드 import**: 기존 `~/server/*` 는 Nuxt 4 에서 `app/server/*` 로 잘못 해석되므로, `server/api/v1/*.ts` 내 imports 를 상대 경로 (`../../db` 등) 로 변경
3. **Tailwind content paths**: `tailwind.config.ts` 의 content glob 을 `./app/components/**` 등으로 수정
4. **App 레이어 `~/` imports**: Nuxt 4 에서 `~/` 가 srcDir (`app/`) 를 가리키므로 `~/types/order` 등은 자동으로 올바른 경로로 해석됨 (변경 불필요)

## 빌드/실행

```bash
corepack enable && corepack prepare yarn@4.5.3 --activate
yarn install
yarn turbo run build

# 개발
yarn workspace nomacom-admin dev
yarn workspace nomacom-client dev
yarn workspace design-showcase dev
yarn workspace @imjohnkoo/design-vue dev   # watch 빌드
```

## Peer Dependency 경고 (알려진 사항)

현재 `yarn install` 시 경고가 몇 개 발생하지만 빌드에는 영향 없음:

- `@imjohnkoo/design-vue` 가 `typescript` peer 요구 (vite-plugin-dts) — 루트 devDep 에 있음
- `design-storybook-mobile` 가 `react-native` peer 요구 — Web 빌드에서만 사용하므로 무해
- `nomacom-client` 가 `tailwindcss` peer 요구 (vue-tailwind-datepicker) — `@nuxtjs/tailwindcss` 가 전이적으로 제공

엄격히 하려면 각 앱에 해당 peer 의존성을 명시적으로 추가 가능.

## 추가 컨텍스트 (필요 시 로드)

monorepo 공유 도메인/운영 룰은 `.claude/rules/` 아래에 분리:

- `.claude/rules/dev-process.md` — **개발 프로세스 v2 정본** (Tier · 게이트 · QA · 환경 제약)
- `.claude/rules/turbo.md` — Turbo 의존 그래프 + 커맨드 상세
- `.claude/rules/claude-code-assets.md` — Skills/Hooks 카탈로그 + Vendoring 정책
- `.claude/rules/deployment.md` — CodeDeploy 배포 흐름, path filter, 브랜치 전략 **((b) 확정 2026-09-02: `dev` 개발·DS publish / `prod` 배포 — 2026-10-04 `main` → `dev` 이름 변경, `main` 브랜치 없음)**
- `.claude/rules/ssm-paths.md` — SSM Parameter Store 경로 + Secret naming 원칙 **(확정)**

- `.claude/rules/design-system-publish.md` — `@imjohnkoo/design-*` GitHub Packages publish 흐름 + 버전 bump 정책 **(C-2 완료 — 0.4.0 첫 publish 성공 2026-08-18)**

m8-frontend 에서 미포팅: `notion-workflow.md` (nomacom 개발 워크플로우는 Notion 비사용으로 결정).

앱 내부 컨텍스트:

- `apps/admin/CLAUDE.md` — admin 도메인 + dual DB 구조 (admin DB / eSIM 메인 DB) + 현재 미완 사항
- `apps/client/CLAUDE.md` — eSIM 발급 4-step 흐름 + Maya API + Nuxt 4 마이그 결과 반영
- `apps/mobile/CLAUDE.md` — mobile 4-step 흐름 + Universal Link 설치 + EAS 프로필 (B 트랙 MVP 반영)

앱별 `.claude/rules/` 는 도메인이 충분히 굳기 전까지는 신설하지 않음 — 루트 `.claude/rules/` 단일 보관 (분리 결정 게이트: Phase 3 쿠팡 진입 이후 코드 폭증 또는 admin/client 도메인 명확 분리 시점).

## 지식 지도 — esmn-wiki (2026-09-22, 결정 nomacom-wiki 0001)

- **이 리포에는 `docs/` 가 없다.** 문서는 전부 `$NOMACOM_WIKI`(fallback `../esmn-wiki` → `~/dev/current-projects/esmn-wiki`, private `imjohnkoo/esmn-wiki`): 내 실행 문서는 `wiki/frontend/{specs,plans,proposals,runbooks,decisions,migrations}/`(이 세션이 직접 쓰고 커밋 — `nomacom-wiki-update` 스킬, 규칙 `.claude/rules/docs-convention.md`), 크로스리포 사실·결정·계약·런북·외부 시스템은 `wiki/{domains,decisions,contracts,runbooks,entities}/`(초안 `wiki/_drafts/<CODE>/` → nomacom-manager 의 wiki 세션이 승격).
- 작업 전: `$NOMACOM_WIKI/index.md` → `wiki/frontend/README.md`(내 문서 전체 목록) → `wiki/contracts/CHANGELOG.md`(backend↔frontend 계약을 건드리면 한 줄 추가).
- 인용은 `[repo://<repo>/<path>#Lx-Ly@<sha>](GitHub 퍼머링크)`, 위키 안은 상대경로. PR 설명에 참조 문서를 인용한다.
- 주간 SoT 는 `$NOMACOM_MANAGER/docs/weekly/frontend-current-week.md`(fallback `~/dev/current-projects/nomacom-manager` — `nomacom-weekly` 스킬로 자기 트랙 행만), 서버 관측·운영 AC 판정은 nomacom-manager 의 monitor 세션(`nomacom-monitor` 스텁이 진입점).

## Hooks & 권한

- `.claude/settings.json` — committed 권한 화이트리스트 + hook 등록. **`.claude/` 는 git 추적** (2026-09-02 전환 — `settings.local.json` 만 제외)
  - **PostToolUse (Edit|Write|MultiEdit)**: prettier 자동 포맷 (.vue/.ts/.tsx/.css 등)
  - **PreToolUse (Bash · Monitor)**: **prod push** / `gh api` prod ref 쓰기 / ref force 되감기 / force push / production workflow 실행(dispatch · `gh workflow run` — ci · design-system-publish 외) / `gh run rerun` / prod base PR / `aws deploy create-deployment` / `docker push` / hard reset / `aws ssm put|delete` 차단
  - ⚠️ 훅 수정 시 **회귀 테스트 필수**: `.claude/hooks/guard-prod-push.test.sh` (2807판정 — 2026-10-05 구멍 · 오탐 수정 · 케이스 파일 guard-prod-push.cases.txt · fail-closed 11 · 꾸민 큰 입력 상한 · 2026-10-09 개명 쌍둥이 38 — 옛 · 새 리포 이름 둘 다)
  - ⚠️ 알려진 오탐: 인터프리터 heredoc(`python3 - <<PY`) 본문은 «실행» 으로 본다 — 짝이 맞는 문자열 안 글자는 통과하지만(python · node 의 백틱 문자열도 글자 — 백틱이 명령인 것은 ruby · perl · php), 짝 없는 따옴표가 든 줄 · 따옴표 밖에 차단 대상 명령 글자를 쓰면 막히고, 큰따옴표 문자열 안의 `$(…)` 는 따옴표 친 구분자(`<<'PY'`)여도 명령 치환 꼴이라 막는다(줄을 셸 기준으로 읽기 때문 — dev 판도 같다). 따옴표 없는 구분자(`<<PY`)면 `$(…)` · 백틱은 밖 셸이 실행하므로 명령이다(dev 판 훅은 더 넓게 막는다). 문서 편집은 Edit/Write 도구로, 긴 패치 스크립트는 파일로 써서 실행.
- 차단된 명령은 `.claude/hooks/guard-prod-push.sh` 참조. 우회 필요 시 사용자 명시 승인 받기.

## 개발 프로세스 v2 (2026-09-02 이식)

spec-driven + maker-checker QA + 관문 접합. **정본은 `.claude/rules/dev-process.md`** — 아래는 요약.

```
[Intake] T2 트리거 대조 → [기획] spec LOCK ★1 → [코딩] 증거+커밋 → [QA] ⑥리뷰/⑦walk
   → [통합] finish-branch Step 0 → [배포] prod-push-check → [사후] 값 대조·교훈 되먹임
```

- **사람 게이트는 2곳뿐**: spec LOCK ack · 칸반 스윕(하루 1~2회 `in-review` 일괄)
- **Tier 는 어휘**다. 실제 규칙은 T2 트리거 목록 하나 — 신규 화면/플로우 · 외부연동(Maya·스마트스토어·Cafe24·PG) · Drizzle 스키마 · 과금/PII · 다중 파일 신규 기능 · mobile 신규 화면. **버그픽스는 파일 수 무관 T1**. `design/` 캔버스는 별도 축 `D`
- **fresh checker 비타협**: 구현 측은 자기 산출물을 인증하지 않는다. 재검은 반드시 새 subagent

| 단계 | 스킬                                                                            |
| ---- | ------------------------------------------------------------------------------- |
| 기획 | `nomacomfe-spec-session` (→ `grill-me` / `ask-questions-if-underspecified`)     |
| 계획 | `nomacomfe-write-plan`                                                          |
| 착수 | `nomacomfe-worktree-setup` (Orca `--setup run` 전제)                            |
| QA   | `nomacomfe-qa-session` — ⑥ 적대적 리뷰 / ⑦ acceptance walk (Orca 내장 브라우저) |
| 통합 | `nomacomfe-finish-branch` — **Step 0 이 Tier·QA 증거를 검사하는 집행 지점**     |
| 배포 | `nomacomfe-prod-push-check`                                                     |

> ✅ **INF-1(2026-09-02)**: `yarn turbo run lint typecheck test` 가 실제로 돈다 — typecheck 는 `.github/scripts/typecheck-gate.sh` 의 **baseline 초과분만 차단**(admin 0 / client 4 — 2026-09-23 W1-2 에서 7 → 4), test 는 design-vue 137 + client 1363(2026-10-04 W1-2 · W1-3 머지 — INF-1 당시 client 28), lint 는 에러만 차단.
> ✅ **INF-2(2026-09-02)**: `.github/workflows/ci.yml` 이 **PR + dev push** 에서 lint·test·typecheck(+ 게이트/훅 회귀 테스트)를 돌린다 — ⚠️ dev 에 required check 가 없어 빨간불이어도 UI 머지 버튼은 막히지 않는다(2026-09-23 확인).
> ✅ **INF-3(2026-09-02)**: `apps/{admin,client}/Dockerfile` 이 `nuxt build` 직전에 typecheck 게이트를 돌린다 — **어떤 경로로 배포하든** 타입 에러면 이미지가 만들어지지 않는다(검증: 에러 주입 시 build exit 1).
> ⚠️ 남은 갭: admin staging 부재(INF-4) · `design-storybook-mobile` 빌드 파손(INF-5). 게이트가 «타입» 만 보므로 동작 검증은 여전히 `nomacomfe-prod-push-check` 의 UI 수동 확인 몫이다.

## 비포함 범위 (후속 작업)

| 항목                                                                                | 상태                                            | 관련 트랙         |
| ----------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------- |
| GitHub Actions 워크플로우 (`admin-production.yml`, `client-production.yml`)         | ✅ 구축 완료 (2026-05-19)                       | weekly A-2b       |
| Dockerfile (`apps/admin/Dockerfile`, `apps/client/Dockerfile`)                      | ✅ 구축 완료 (2026-05-19)                       | weekly A-2a       |
| AWS CodeDeploy `appspec.yml` + `deploy/scripts/`                                    | ✅ 구축 완료 (2026-05-19)                       | weekly A-2c       |
| AWS SSM Parameter Store 연동 + 실제 경로 audit                                      | ✅ 확정 (`.claude/rules/ssm-paths.md`)          | weekly A-1 / A-2c |
| 원본 GitHub 레포 (`nomacom-admin`, `nomacom-client-nuxt3`, `nomacom-design-system`) | ✅ Archived (2026-05-21)                        | weekly A-5 / C-3  |
| `@imjohnkoo/design-*` 배포 파이프라인 (GitHub Packages)                             | ✅ 정책 채택 — (b) GH Packages (2026-05-21)     | weekly C-1        |
| `design-system-publish.yml` workflow 포팅                                           | ✅ 완료 — 0.4.0 첫 publish 성공 (2026-08-18)    | weekly C-2        |
| `apps/admin/CLAUDE.md` + `apps/client/CLAUDE.md`                                    | 작성 완료 (2026-05-19)                          | —                 |
| `apps/mobile/CLAUDE.md`                                                             | ✅ 작성 완료 (2026-08-19)                       | weekly B 트랙     |
| `apps/*/.claude/rules/` 도메인 분리                                                 | 보류 (도메인 굳을 때)                           | —                 |
| mobile EAS 배포 흐름 정의                                                           | eas.json 구축 — 실행 (eas init/build) 승인 대기 | weekly B 트랙     |
| 개발 프로세스 v2 이식 (spec 제도 · QA 게이트 · 스킬 6종)                            | ✅ 완료 (2026-09-02)                            | —                 |
| **admin/client 검증 러너** (typecheck 게이트 + vitest + lint)                        | ✅ 완료 — INF-1 (2026-09-02)                    | 프로세스 v2 후속  |
| **PR/dev CI 게이트** (`ci.yml` — lint / test / typecheck gate)                       | ✅ 완료 — INF-2 (2026-09-02, run 33599247862)   | 프로세스 v2 후속  |
| **Dockerfile 배포 게이트** (이미지 빌드 시 typecheck)                               | ✅ 완료 — INF-3 (2026-09-02)                    | 프로세스 v2 후속  |
| `design-storybook-mobile` 빌드 파손 (clean install 에서 preset 미해결)              | ❌ INF-5 (2026-09-02 발견)                      | 프로세스 v2 후속  |
| admin staging 환경 (prod 가 첫 통합 환경)                                           | 구조적 갭 — 프로세스가 완화만 함                | 프로세스 v2 후속  |
