# Design System Publish (GitHub Packages)

`@imjohnkoo/design-tokens` 와 `@imjohnkoo/design-vue` 는 모노리포 내부에서는 `workspace:*` 로 소비되지만, **장래의 외부 consumer** (별 레포 — 예: 마케팅 사이트, mobile EAS 빌드 분리 후 등) 를 위해 **GitHub Packages** 에 publish 됩니다. 현 시점 외부 consumer 는 부재 — 인프라만 미리 깔아둠 (C-1 결정 = (b) GH Packages, 2026-05-21).

| 항목 | 값 |
|---|---|
| Registry | `https://npm.pkg.github.com` (scope `@imjohnkoo`) |
| Workflow | `.github/workflows/design-system-publish.yml` |
| 트리거 | `dev` 브랜치 push + `packages/design-tokens/**` 또는 `packages/design-vue/**` 경로 변경, 또는 `workflow_dispatch` 수동 트리거 |
| 빌드 | `yarn workspace @imjohnkoo/design-tokens run build` → `yarn workspace @imjohnkoo/design-vue run build` (순차) |
| Publish 순서 | `design-tokens` → `design-vue` (Yarn Berry 가 `workspace:*` 를 자동 버전 치환) |
| 중복 처리 | `yarn npm publish --tolerate-republish || yarn npm publish` — 같은 버전이면 no-op 로 통과. fallback 은 사전 GET 이 403 으로 fatal 나는 경우 (권한 미부여 신규 패키지 등) 를 위한 안전망 — plain publish 는 GET 없이 바로 PUT 하고, 기존 버전 재발행은 서버가 거부하므로 이중 발행 위험 없음 |
| 인증 | `YARN_NPM_AUTH_TOKEN = secrets.GITHUB_TOKEN` (workflow `packages: write` 권한) |
| 브랜치 모델 | `dev` = DS publish 트리거 / `prod` = admin/client app 배포 트리거 (서로 분리) |

## 대상 패키지

| 패키지 | publish 대상? | 비고 |
|---|---|---|
| `@imjohnkoo/design-tokens` | ✅ Yes | tsx 스크립트로 token JSON → CSS 변수 + JS 상수 빌드 → `dist/` |
| `@imjohnkoo/design-vue` | ✅ Yes | Vite lib build + `vite-plugin-dts` → `dist/index.{js,cjs,d.ts}` |
| `@imjohnkoo/design-mobile` | ❌ No | `tsc --noEmit` 만 수행, `src/` 직접 export (dist 부재). EAS 빌드 흐름 정착 후 별도 검토 |

## 버전 관리 (수동 bump)

DS 변경 PR 에서 `packages/design-*/package.json` 의 `version` 필드를 직접 올립니다. 규칙:

- **외부 consumer 영향 있음** (API 변경, 신규 컴포넌트, 버그 수정 등) → bump 후 PR 에 포함
- **내부 리팩터/주석만** (외부 영향 없음) → bump 불필요, workflow 는 돌지만 `--tolerate-republish` 로 스킵

Semantic version 기준: breaking change 는 minor (0.x 단계), 그 외는 patch. (1.0 진입 후에는 semver 정식 적용)

> **현재 버전 (2026-08-18)**: `@imjohnkoo/design-tokens` 0.4.0 / `@imjohnkoo/design-vue` 0.4.0 — esmn-frontend 에서의 첫 publish 완료 (run 32145853523). 레지스트리에는 구 레포 시절 0.3.0 도 존재.

## 외부 consumer 세팅 예시 (미래용)

별 레포의 `.yarnrc.yml`:

```yaml
npmScopes:
  imjohnkoo:
    npmRegistryServer: "https://npm.pkg.github.com"
    npmAuthToken: "${GH_PACKAGES_TOKEN}"
```

`GH_PACKAGES_TOKEN` 은 `read:packages` 스코프를 가진 GitHub PAT. CI 에서는 해당 프로젝트의 repo secret 으로 주입.

## paths 필터 간섭 주의

`packages/design-tokens/**` + `packages/design-vue/**` 는 본 publish workflow 외에도 `admin-production.yml` / `client-production.yml` 의 paths 필터에도 잡혀 있습니다. 그래서 DS 변경 push:

- `dev` push → `design-system-publish.yml` 만 트리거 (admin/client workflow 는 `branches: [prod]` 만 트리거)
- `prod` 머지 → `admin-production.yml` + `client-production.yml` 둘 다 재배포 트리거. DS publish 는 별도 (dev 에서 이미 끝)

즉 **dev push 시 DS publish 단독 / prod 머지 시 app 재배포 단독** 으로 자연 분리됩니다.

## 첫 publish 완료 기록 (2026-08-18)

0.4.0 첫 publish 성공 (run 32145853523, 두 패키지 모두 "Package archive published"). 최초 시도 (2026-05-21, run 26197193842) 와 재시도가 실패했던 원인 두 가지를 기록:

1. **패키지가 이미 존재했음** — archived 구 레포 `nomacom-design-system` 이 2026-03-20 에 동일 이름 (`@imjohnkoo/design-tokens`, `@imjohnkoo/design-vue`) 0.3.0 을 publish 했고, 패키지가 그 레포의 권한을 **상속** 중이었음. repo-scoped GITHUB_TOKEN 은 타 레포에 연결된 패키지에 접근 불가 → GET 403 (404 아님), PUT 403 `permission_denied: write_package`.
2. **해결 (2026-08-18, john 수동 설정)** — 각 패키지 설정에서 "Inherit access from repository" 해제 → 나타나는 "Manage Actions access" 에 `esmn-frontend` 를 Role=Write 로 추가. 이후 패키지 권한은 레포 상속이 아닌 패키지 설정에서 직접 관리됨.

### 신규 패키지 추가 시 체크리스트

- 이름이 과거에 publish 된 적 있는지 확인 (`https://github.com/imjohnkoo?tab=packages` 로그인 상태로 확인)
- 완전 신규 이름이면: GitHub Packages 는 미존재 패키지 GET 에 404 대신 403 을 반환 → `--tolerate-republish` 가 fatal. workflow 의 `|| yarn npm publish` fallback 이 이 경우를 처리함
- 첫 publish 후 패키지가 레포에 자동 연결/상속되면 이후 publish 는 문제 없음. 타 레포 CI 에서 쓰려면 해당 레포를 Manage Actions access 에 추가

## 관련 문서

- `CLAUDE.md` "비포함 범위" — C-1 결정 기록
- `.claude/rules/deployment.md` — 브랜치 모델 (dev / prod) 전체 그림
- `packages/design-vue/CHANGELOG.md` — 버전별 변경 이력
