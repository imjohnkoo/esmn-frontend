# 배포 흐름 (CodeDeploy + GitHub Actions)

> **상태 (2026-09-02 갱신)**: 배포 자산은 **구축 완료**다 — `.github/workflows/{admin,client}-production.yml` · `appspec.yml` · `deploy/scripts/{before,after}_deploy.sh` · `apps/{admin,client}/Dockerfile` · `deploy/cloudfront/` 모두 실재한다. SSM 경로는 `.claude/rules/ssm-paths.md` 에서 확정됐다.
> ✅ **검증 3층(2026-09-02 · INF-1~3)**: 로컬 · PR/dev CI(`ci.yml` — pull_request + dev push) · Dockerfile typecheck 게이트. ⚠️ 단 게이트는 «타입» 만 본다 — 동작 검증은 `nomacomfe-prod-push-check` 의 UI 확인 몫이고, `guard-prod-push.sh` 의 prod 차단이 사람 승인을 강제한다(남은 갭: admin staging 부재 — INF-4).

```
GitHub push (prod branch)
  ↓
GitHub Actions (path filter로 admin/client 판별)
  ↓
Docker build (시크릿 미포함) → DockerHub `imjohnkoo/nomacom-{admin,client}:prod`
  ↓
CodeDeploy trigger (per-app application, 같은 repo)
  ↓
EC2: /app/nomacom-frontend에 repo 복사
  ↓
BeforeInstall: deploy/scripts/before_deploy.sh
  → /app/app-name.conf 읽어서 어떤 앱인지 판별
  → 기존 컨테이너 stop/rm
  ↓
AfterInstall: deploy/scripts/after_deploy.sh
  → SSM에서 /nomacom/shared/ + /nomacom/{app}/ 파라미터 fetch
  → .env.production 파일 생성
  → 컨테이너 레지스트리 로그인 (SSM 크레덴셜)
  → docker pull imjohnkoo/{app-name}:prod
  → docker run --env-file .env.production + 헬스체크
```

## app-name.conf

각 EC2 인스턴스에 미리 생성되어 있어야 합니다. 이 파일이 deploy scripts의 분기 기준입니다.

- admin EC2: `/app/app-name.conf` = `nomacom-admin`
- client EC2: `/app/app-name.conf` = `nomacom-client`

## GitHub Actions Path Filter

각 workflow는 해당 앱 경로 + design system 변경 시에만 트리거됩니다:

```yaml
paths:
  - 'apps/admin/**'                    # 또는 apps/client/**
  - 'packages/design-tokens/**'
  - 'packages/design-vue/**'
  - 'package.json'
  - 'yarn.lock'
```

→ design system만 변경해도 admin + client 두 workflow 모두 트리거됨.

> **mobile (`apps/mobile/**`) 은 별도 트리거**: Expo EAS 빌드 / OTA update 경로 — 본 CodeDeploy 파이프라인과 분리. 별도 workflow 필요 (현재 미구축).

## CodeDeploy Applications (확정 — 2026-09-02 실측)

| CodeDeploy Application | Deployment Group | Docker Image | EC2 |
|---|---|---|---|
| `nomacom-admin` | `prod` | `imjohnkoo/nomacom-admin:prod` (DockerHub) | admin EC2 (app-name.conf: `nomacom-admin`) |
| `nomacom-client` | `prod` | `imjohnkoo/nomacom-client:prod` (DockerHub) | client EC2 (app-name.conf: `nomacom-client`) |

각 application은 **같은 GitHub repo** (`imjohnkoo/nomacom-frontend`) 를 가리키지만, 서로 다른 EC2로 배포됩니다.

**확정값** (`.github/workflows/*-production.yml` · `deploy/scripts/after_deploy.sh` 실측):
- registry = **DockerHub** (`imjohnkoo/nomacom-{admin,client}:prod`). 크레덴셜은 GHA secret `PROD_DOCKER_ID/PW` + 런타임은 SSM `/nomacom/shared/docker/`
- repo = `imjohnkoo/nomacom-frontend` · CodeDeploy `--deployment-group-name prod` · config `CodeDeployDefault.OneAtATime`
- 구 레포(`nomacom-admin`, `nomacom-client-nuxt3`, `nomacom-design-system`) 는 2026-05-21 Archived

## 브랜치 전략 — **(b) 확정 (2026-09-02) · 통합 브랜치 이름 `main` → `dev` (2026-10-04)**

| 브랜치 | 역할 |
|---|---|
| `dev` | **개발 기본 base** + DS publish 트리거 (`design-system-publish.yml`) — GitHub 기본 브랜치 |
| `prod` | **배포 트리거** — `admin-production.yml` / `client-production.yml` |

- 1인 운영에 3분기(dev/prod/main)는 과잉이라 **(b) 단순화**를 채택했다 — 브랜치는 둘(통합 · 배포)뿐이다.
- **2026-10-04 John 결정**: 통합 브랜치 이름을 `main` → `dev` 로 바꿨다(GitHub branch rename — 이력 · PR 그대로, 기본 브랜치 = `dev`). backend(`dev` → `prod`)와 같은 어휘다. **`main` 브랜치는 없다** — 옛 문서 · 스크립트의 `main` · `origin/main` 은 `dev` · `origin/dev` 로 읽는다. 로컬 클론은 `git branch -m main dev && git fetch origin && git branch -u origin/dev dev && git remote set-head origin -a && git remote prune origin`.
- 승격은 **dev → prod 한 방향**이다 — **prod↔dev 동기화 단계는 존재하지 않는다**(m8-frontend 의 sync 규약을 복사하지 말 것).
- 모든 작업 브랜치/PR 의 base 는 **항상 `dev`**.

## prod push 정책

- prod push 는 `nomacomfe-prod-push-check` skill 로 pre-flight 검증 후, **사용자 명시 승인**을 받아 수행
- `.claude/hooks/guard-prod-push.sh` 가 `git push ... prod` 와 `gh api ... refs/heads/prod` 쓰기를 **실제로 차단**한다 (2026-09-02 부터 — 그 전에는 문서에만 있었다)
- `nomacomfe-finish-branch` Step 0 이 Tier·QA 증거를 검사한 뒤에야 머지 옵션이 열린다
