# esmn-frontend

Nomacom 프론트엔드 프로젝트들을 단일 Yarn 4 + Turborepo 기반 monorepo로 통합한 저장소.

2026-10-09 `nomacom-frontend` → `esmn-frontend` 개명(폴더·GitHub). 서비스·AWS·Docker·CodeDeploy 이름은 그대로.

## Workspaces

### Apps

| Workspace | 경로 | 프레임워크 | 설명 |
|---|---|---|---|
| `nomacom-admin` | `apps/admin` | Nuxt 4 | 관리자 대시보드 (Drizzle ORM + PostgreSQL) |
| `nomacom-client` | `apps/client` | Nuxt 4 | eSIMMany — eSIM QR 발급 고객용 웹앱 |
| `nomacom-mobile` | `apps/mobile` | Expo SDK 55 + RN 0.83 + Expo Router v7 | iOS/Android 모바일 앱 (eSIM 앱내 설치) |
| `design-showcase` | `apps/design-showcase` | Vite + Vue 3 | design-vue 컴포넌트 개발/쇼케이스 환경 |
| `design-demo` | `apps/design-demo` | Vite + Vue 3 | 디자인 시스템 데모 앱 |
| `design-demo-webapp` | `apps/design-demo-webapp` | Vite + Vue 3 | 디자인 시스템 데모 웹앱 |
| `design-storybook-mobile` | `apps/design-storybook-mobile` | Storybook + RN Web | React Native 컴포넌트 Storybook |

### Packages

| Workspace | 경로 | 설명 |
|---|---|---|
| `@imjohnkoo/design-tokens` | `packages/design-tokens` | 색상/타이포/스페이싱 등 디자인 토큰 (CSS 변수 + JS 상수) |
| `@imjohnkoo/design-vue` | `packages/design-vue` | Vue 3 컴포넌트 라이브러리 (Reka UI 기반) |
| `@imjohnkoo/design-mobile` | `packages/design-mobile` | React Native 컴포넌트 라이브러리 |

## Prerequisites

- Node.js `>= 22`
- Corepack 활성화 (Yarn 4.5.3 자동 설치)

```bash
corepack enable
corepack prepare yarn@4.5.3 --activate
```

## Getting Started

```bash
# 의존성 설치
yarn install

# 전체 빌드 (토폴로지컬 순서: design-tokens → design-vue → apps)
yarn build

# 개별 앱 개발 서버
yarn workspace nomacom-admin dev
yarn workspace nomacom-client dev
yarn workspace design-showcase dev

# 모바일 앱 (Expo)
yarn workspace nomacom-mobile dev:web       # 브라우저 프리뷰 (http://localhost:8081)
yarn workspace nomacom-mobile dev:ios       # iOS Simulator (Xcode 필요)
yarn workspace nomacom-mobile dev:android   # Android Emulator (Android Studio 필요)
yarn workspace nomacom-mobile dev           # 대화형 (QR 코드, Expo Go 앱으로 스캔)

# 디자인 시스템 watch 빌드 (앱 개발과 병행)
yarn workspace @imjohnkoo/design-vue dev
```

## Turborepo Scripts

루트에서 실행:

```bash
yarn build        # turbo run build
yarn dev          # turbo run dev (persistent, cache 없음)
yarn lint         # turbo run lint
yarn test         # turbo run test
yarn typecheck    # turbo run typecheck
yarn clean        # turbo run clean
```

`^build` 의존성 덕분에 앱 빌드 전 디자인 시스템이 자동으로 먼저 빌드됩니다.

## Structure

```
esmn-frontend/
├── apps/
│   ├── admin/                    # Nuxt 4 admin
│   ├── client/                   # Nuxt 4 client (eSIMMany)
│   ├── mobile/                   # Expo SDK 55 (iOS/Android)
│   ├── design-showcase/          # 디자인 시스템 개발 환경
│   ├── design-demo/
│   ├── design-demo-webapp/
│   └── design-storybook-mobile/
├── packages/
│   ├── design-tokens/            # 디자인 토큰
│   ├── design-vue/               # Vue 3 컴포넌트
│   └── design-mobile/            # React Native 컴포넌트
├── package.json                  # 루트 workspace
├── turbo.json                    # Turbo pipeline
├── tsconfig.base.json
├── eslint.config.js              # flat config
├── .prettierrc
└── .yarnrc.yml                   # nodeLinker: node-modules
```

## Dependency Strategy

- 모든 내부 패키지 참조는 `workspace:*` 프로토콜을 사용합니다. 예: `apps/admin` 의 `"@imjohnkoo/design-tokens": "workspace:*"`.
- 루트 `node_modules` 로 호이스팅 (Yarn workspace 기본).
- 단일 `yarn.lock` 이 전체 monorepo 의존성을 관리합니다.

## 원본 프로젝트 (통합 전)

- `../nomacom-admin` → `apps/admin`
- `../nomacom-client-nuxt3` → `apps/client` (Nuxt 3 → 4 마이그레이션)
- `../nomacom-design-system` → `packages/design-*`, `apps/design-*`

통합 후에도 원본 디렉토리는 검증이 끝날 때까지 보존합니다.

## 비포함 (향후 작업)

- GitHub Actions CI/CD 워크플로우
- Dockerfile, CodeDeploy appspec.yml
- `@imjohnkoo/design-*` 의 GitHub Packages 배포 파이프라인 유지 여부 결정
