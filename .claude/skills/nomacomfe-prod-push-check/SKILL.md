---
name: nomacomfe-prod-push-check
description: Pre-flight checklist before pushing to nomacom-frontend prod or merging to the prod branch. Verifies clean working tree, paths-filter deploy impact, build for affected apps, manual UI verification, migration safety, DS version bump, and main->prod fast-forward. Use before any push that triggers admin/client prod deploy.
---

# nomacom-frontend Prod Push Check

Prevent broken/unsafe prod deployments by running a structured pre-flight check.

**Announce at start:** "I'm using the nomacomfe-prod-push-check skill to verify prod-push readiness."

> **상태 (2026-09-02)**: 배포 파이프라인은 **가동 중**이다 — prod push 가 `admin-production.yml`/`client-production.yml` 을 트리거해 DockerHub 빌드 → CodeDeploy 로 이어진다.
> ✅ 검증 3층 가동 중 (2026-09-02): 로컬(INF-1) · PR·main CI(INF-2, `ci.yml`) · **Dockerfile 게이트(INF-3)**.
> `prod` 브랜치에 CI 는 없지만, `apps/{admin,client}/Dockerfile` 이 `nuxt build` 직전에 typecheck 게이트를 돌리므로 **타입 에러면 이미지 자체가 안 만들어진다**.
> ⚠️ 단 게이트는 «타입» 만 본다. **동작이 맞는지는 아무도 안 본다** — Phase 4 의 UI 수동 검증이 여전히 유일한 기능 검증이다. 생략 금지.

## When to Use

**MUST use before:**

- `git push origin prod` (훅이 차단한다 — 사용자 명시 승인 필요)
- Merging any PR into `prod`
- Creating a PR targeting `prod`
- Any force-push involving `prod` (basically never — warn and stop)

**Not needed for:**

- Pushing to feature branches
- Pushing to `main` 또는 feature 브랜치
- Local merges that don't push

## Check Phases

### Phase 1 — Working Tree Hygiene

```bash
# 1.0 올릴 SHA 를 먼저 하나로 정하고, **그 SHA 가 체크아웃된 상태에서** 모든 Phase 를 돈다 (W1-2 D-17 · QA ⑥).
#     build · UI · paths-filter · 시크릿 검사는 HEAD 를, 게이트 · push 는 PROMOTE_SHA 를 보므로 둘이 같아야 한다.
#     fetch 가 실패하면 멈춘다(오래된 ref 로 판정하지 않는다). 다른 SHA 를 올린다면 여기서 그 SHA 로 바꾼다.
git fetch origin --quiet || exit 1
PROMOTE_SHA="$(git rev-parse origin/main)"
git merge-base --is-ancestor "$PROMOTE_SHA" origin/main || { echo "⛔ origin/main 에 없는 SHA — prod 는 main 의 한 SHA"; exit 1; }
[ "$(git rev-parse HEAD)" = "$PROMOTE_SHA" ] || { echo "⛔ HEAD ≠ PROMOTE_SHA — git checkout --detach $PROMOTE_SHA 뒤 다시"; exit 1; }
echo "PROMOTE_SHA=$PROMOTE_SHA"   # 보고 템플릿에 적어 두고, 뒤 Phase 의 셸마다 이 값으로 다시 둔다(셸 변수는 이어지지 않는다)
```

```bash
# 1.1 Clean?
git status --porcelain
```

비어있어야 함. 있으면 stash/commit 결정 필요.

```bash
# 1.2 Unpushed commits 파악
git log origin/<current-branch>..HEAD --oneline
```

```bash
# 1.3 .env / 시크릿 실수 포함 여부 (.env.example 은 제외)
git diff origin/prod...HEAD --name-only \
  | grep -E "\.env($|\.local|\.production)|credentials|secret|\.key$|\.pem$" \
  | grep -v '\.env\.example$'
```

매칭되면 **stop**. 시크릿이 staged/committed되면 안 됨.

### Phase 2 — Paths Filter 영향 분석

변경된 파일로 **어떤 앱이 재배포되는지** 판정 (`.github/workflows/admin-production.yml`, `client-production.yml` 룰 참조):

```bash
git diff origin/prod...HEAD --name-only
```

| 변경 경로                                                             | 트리거 workflow                                   |
| --------------------------------------------------------------------- | ------------------------------------------------- |
| `apps/admin/**`                                                       | admin-production.yml                              |
| `apps/client/**`                                                      | client-production.yml                             |
| `apps/mobile/**`                                                      | (별도 — Expo EAS / OTA, CodeDeploy 와 분리)       |
| `packages/design-tokens/**`                                           | **둘 다** (admin + client)                        |
| `packages/design-vue/**`                                              | **둘 다** (admin + client)                        |
| `packages/design-mobile/**`                                           | mobile only (EAS)                                 |
| `package.json`, `yarn.lock` (root)                                    | **둘 다** (admin + client)                        |
| `deploy/scripts/**`, `appspec.yml`                                    | **둘 다**                                         |
| `.github/workflows/admin-production.yml`                              | admin                                             |
| `.github/workflows/client-production.yml`                             | client                                            |
| `packages/design-*/**` (main 브랜치 + publish 정책 채택 시)           | + design-system-publish.yml                       |
| `turbo.json`, `tsconfig.base.json`, `.yarnrc.yml`, `apps/design-*/**` | **제외** (workflow paths 필터에 없음 — 확인 필요) |

**출력 포맷**:

```
Paths-filter 영향:
  ✓ admin   (reason: apps/admin/server/api/...)
  ✓ client  (reason: packages/design-vue/components/...)
  - mobile  (reason: 변경 없음)
  - DS publish: ✗ (prod 브랜치는 publish 안 함, main에서만)
```

### Phase 3 — Build + Typecheck 검증

Turbo로 전체 또는 영향 앱만:

```bash
yarn turbo run build --filter=nomacom-admin --filter=nomacom-client || exit 1
```

**Fail이면 stop**. 빌드 안 되는 코드 prod 금지.

```bash
# client 확정 전 문안(P9_4_PENDING) 0 — Phase 1.0 의 PROMOTE_SHA 를 본다 (W1-2 D-17).
PROMOTE_SHA=<Phase 1.0 값>
[ "$(git rev-parse HEAD)" = "$PROMOTE_SHA" ] || exit 1
# 게이트 스크립트가 없는 SHA(도입 전 main)는 «해당 없음» — 단 스크립트만 빠진 경우를 막으려 자리표시자 글자를 직접 찾는다
if [ -f .github/scripts/content-pending-gate.sh ]; then
  env -u CONTENT_GATE_ROOT bash .github/scripts/content-pending-gate.sh "$PROMOTE_SHA" || exit 1
else
  git grep -q -F -e P9_4_PENDING -e PENDING_LABEL -e '(확정' -e '（확정' "$PROMOTE_SHA" -- apps/client ':(exclude)*.md' ':(exclude)*.test.ts' ':(exclude)apps/client/app/content/pending.ts'
  case $? in
    1) echo "content gate: 해당 없음(게이트 도입 전 SHA · 자리표시자 0)" ;;
    0) echo "⛔ 게이트 스크립트가 없는데 자리표시자가 있다 — 중단"; exit 1 ;;
    *) echo "⛔ git grep 오류 — 검사 불가, 중단"; exit 1 ;;
  esac
fi
bash .github/scripts/typecheck-gate.sh admin || exit 1
bash .github/scripts/typecheck-gate.sh client || exit 1
```

> ✅ **INF-1(2026-09-02) 이후 `yarn turbo run typecheck` 는 실제로 돈다.** admin/client 는 `.github/scripts/typecheck-gate.sh` 를 거쳐 **기준선 초과분만** 실패한다(admin 0 / client 4건 — 2026-09-23 7 → 4). 신규 타입 에러가 있으면 여기서 걸린다 — 반드시 돌릴 것.

### Phase 4 — 영향 앱 테스트 + UI 검증

Phase 2에서 판정된 앱만 테스트:

```bash
yarn workspace @imjohnkoo/design-vue run test --run   # DS 변경 시 (17 files / 129 tests)
yarn workspace nomacom-mobile run typecheck           # mobile 변경 시
```

> ⚠️ client 는 순수 유닛 284건(2026-09-23 — shell · 흐름 가드 · 콘텐츠 포함), admin 은 아직 0건이다. 테스트가 커버하지 못하는 화면 동작이 많으므로 **UI 수동 검증은 여전히 필수**다 — 생략 금지.

`verification-before-completion` 의 iron law 적용 — 결과를 직접 확인.

**client 가 승격 대상이면 무조건 — 렌더 확인(확정 전 문안 0)** (W1-2 D-17 의 두 번째 겹 — 게이트는 소스 grep 이라 줄바꿈 · 엔티티 · 조립된 문자열을 놓칠 수 있다. `app/content/*.ts` 만 바뀐 P9-4 승격도 여기서 본다). Phase 3 에서 PROMOTE_SHA 로 빌드한 `.output` 을 봉투 prod 서버로 띄우고(`bash .claude/scripts/client-walk-server.sh prod <port>`):

```bash
BASE=http://127.0.0.1:<port>
want_build="$(sed -n 's/.*"id":"\([^"]*\)".*/\1/p' apps/client/.output/public/_nuxt/builds/latest.json)"
[ -n "$want_build" ] || { echo "⛔ 빌드 id 없음 — Phase 3 빌드부터"; exit 1; }
for p in / /my /my-esim /terms /privacy /refund /guide /search /checkout-preview /supported-devices; do   # /business 는 없다(W1-2 D-39 — 404)
  html="$(curl -fsS "$BASE$p")" || { echo "⛔ $p 응답 실패 — 중단"; exit 1; }       # 서버가 없거나 4xx · 5xx 면 0건으로 통과하지 않게
  printf '%s' "$html" | grep -q "buildId:\"$want_build\"" || { echo "⛔ $p 가 이 빌드($want_build)의 응답이 아니다 — 중단"; exit 1; }
  printf '%s' "$html" | grep -q '704-24-01747' || { echo "⛔ $p 에 푸터 사업자등록번호가 없다(양성 대조 실패) — 중단"; exit 1; }
  norm="$(printf '%s' "$html" | sed -e 's/&nbsp;/ /g' -e 's/&#160;/ /g' -e 's/&#xa0;/ /g' -e $'s/\xc2\xa0/ /g' -e $'s/\xe2\x80\x8b//g; s/\xe2\x80\x8c//g; s/\xe2\x80\x8d//g; s/\xe2\x81\xa0//g; s/\xef\xbb\xbf//g' | tr -s '[:space:]' ' ')"   # zero-width(U+200B~D · 2060 · FEFF)는 지운다
  n=$(printf '%s' "$norm" | grep -o -e '(확정 전)' -e '（확정 전）' -e '문안을 확정하고 있어요' -e 'data-pending' -e 'P9_4_PENDING' | wc -l | tr -d ' ')   # 법정 문서 본문의 값 자리는 글자 없이 data-pending 표식만(W1-2 D-47) — 클래스 이름은 인라인 CSS 에도 있어 세지 않는다
  # 글자로도 센다 — 렌더러가 괄호 낱말을 줄바꿈 방지 span 으로 나눠 감싸(«(확정» · «전)») 위 HTML 검사로는 원문에 직접 쓴 «(확정 전)» 이 안 보인다
  text="$(printf '%s' "$norm" | sed -e 's/<head>.*<\/head>//' -e 's/<[^>]*>//g' | tr -s ' ' ' ')"
  t=$(printf '%s' "$text" | grep -o -e '(확정 전)' -e '（확정 전）' -e '문안을 확정하고 있어요' -e 'P9_4_PENDING' | wc -l | tr -d ' ')
  [ "$n" -eq 0 ] && [ "$t" -eq 0 ] || { echo "⛔ $p 에 확정 전 문안 ${n}건(HTML) · ${t}건(글자) — 중단"; exit 1; }
done
code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/business")"   # W1-2 D-39 — 페이지가 없어야 한다(되살아나거나 3xx 로 돌리면 중단)
[ "$code" = 404 ] || { echo "⛔ /business 응답 $code — 404 여야 한다(D-39) — 중단"; exit 1; }
```

게이트 스크립트 · 봉투가 없는 SHA(도입 전 main — 예: P6 #2)는 봉투가 없으니 이 단계를 «해당 없음(자리표시자 도입 전)» 으로 적는다 — 그 SHA 의 소스에는 자리표시자 자체가 없다(Phase 3 폴백 grep 이 0).

**UI 변경이 포함된 경우** 추가로:

- 영향 앱 dev 서버 띄워서 golden path 수동 검증 — admin 은 `yarn workspace nomacom-admin run dev`. **client 는 로컬 walk 안전 봉투로만**(`bash .claude/scripts/client-walk-server.sh dev <port>` → `http://127.0.0.1:<port>` — prod DB · 벤더 키 없이. John 지시 2026-09-23 · client-shell spec D-18). 실발급 · 실주문 경로는 로컬에서 걷지 않고 승격 당일 operator AC 로

- 자동 테스트는 feature correctness 가 아닌 code correctness 만 검증함

### Phase 5 — 마이그레이션/DB 변경 안전성

nomacom-frontend 도 Drizzle 사용 (`apps/admin/server/`, `apps/client/server/`):

```bash
# 마이그레이션 파일
git diff origin/prod...HEAD --name-only | grep -E "migrations/|schema\.ts$|drizzle\.config\.ts$"

# 대규모 UPDATE / 인덱스 변경
git diff origin/prod...HEAD | grep -iE "CREATE INDEX|DROP INDEX|ALTER TABLE|UPDATE.*SET"
```

**매칭 시 체크**:

- nomacom 의 DB ownership 구조 확인 (admin vs client vs 공유). 현재 nomacom-admin / nomacom-client 가 동일 DB 공유 여부 결정 필요
- DDL: prod DB 에 적용 계획/타이밍 확인 (배포 전/후?), lock 시간 예측
- Maya 응답 schema 변경에 대응한 컬럼 추가 등은 client 결제/조회 흐름과 동시 cutover 필요

### Phase 6 — Design System Version Bump 확인

> DS publish 는 **`main` push 트리거** (`design-system-publish.yml`). prod 머지는 app 재배포만 트리거한다 — 두 경로는 분리돼 있다.

DS 패키지 변경이 있고 외부 consumer 에 영향 있으면 version bump 필수:

```bash
# DS 변경 여부
git diff origin/prod...HEAD --name-only \
  | grep -E "packages/design-(tokens|vue|mobile)/(src|components)"

# version bump 됐는지
git diff origin/prod...HEAD \
  packages/design-tokens/package.json \
  packages/design-vue/package.json \
  packages/design-mobile/package.json \
  | grep '"version"'
```

**판정**:

- DS src/components 변경 + version bump 없음 → 외부 consumer 영향 검토
  - 영향 있음 (API 변경, 신규 컴포넌트, 버그 수정) → version bump 후 재푸시
  - 내부 리팩터/주석만 → bump 불필요

### Phase 7 — main↔prod 관계 확인

> ⛔ **dev sync 단계는 존재하지 않는다.** nomacom 은 브랜치 모델 (b) 확정 — `main`(개발·DS publish) / `prod`(배포) 2분기이고 **`dev` 브랜치가 없다** (`.claude/rules/deployment.md`). m8-frontend 의 prod↔dev sync 규약을 복사하지 말 것.

확인할 것은 **prod 가 main 의 조상인가** — 즉 이 push 가 fast-forward 인가다.

```bash
git fetch origin --quiet || exit 1
PROMOTE_SHA=<Phase 1.0 값>          # 다시 구하지 않는다 — 게이트가 본 SHA 그대로
git log --oneline --graph origin/main origin/prod | head -20
git merge-base --is-ancestor origin/prod "$PROMOTE_SHA" && echo "✔ fast-forward 가능" || echo "⛔ prod 가 승격 SHA 에 없는 커밋을 갖고 있다 — 되감기 위험, 중단"
```

**prod 에만 있는 커밋이 있으면 중단하고 사용자에게 보고한다.** ref 되감기는 남의 배포를 되돌리고 커밋을 소실시킨다 — `guard-prod-push.sh` 가 force 이동을 차단하는 이유다.

### Phase 8 — CI/Deploy 확인

```bash
# 최근 prod deploy 상태 확인 (이전 푸시 성공 여부)
gh run list --branch prod --limit 5 --workflow "admin-production.yml"
gh run list --branch prod --limit 5 --workflow "client-production.yml"
```

**실패한 최근 run이 있으면**: 이전 배포가 불안정 — 사용자에게 확인.

## Final Report Template

```
nomacom-frontend prod push readiness check
==========================================

Working tree:
  ✓ Clean
  ✓ No secrets detected
  ✓ <N> unpushed commits

Paths-filter impact:
  ✓ admin   (reason: apps/admin/server/api/...)
  ✓ client  (reason: packages/design-vue/components/...)
  - mobile  (reason: 변경 없음)
  - DS publish: ✗ (prod 브랜치 — publish 는 main 에서만)

Build:        ✓ yarn turbo run build (admin, client) pass
Promote SHA:  <PROMOTE_SHA> (origin/main 에 있음 — push 는 `git push origin <PROMOTE_SHA>:prod`, 훅이 막으므로 사용자가)
Content gate: ✓ content-pending-gate.sh <PROMOTE_SHA> exit 0 (client 확정 전 문안 0)
Typecheck:    ✓ typecheck-gate.sh (admin 0 / client 4 기준선 초과 0)
Tests:        ✓ design-vue 129 · client <n> pass  /  — admin 0건
UI manual:    ✓ admin/client golden path 검증 완료 (유일한 기능 검증)
Migrations:   ✗ none
DDL:          ✗ none
DS bump:      ✗ N/A (DS 변경 없음)

main→prod:    ✓ fast-forward 가능 (prod 고유 커밋 0)

Recent prod deploys: all green (last 5)

READY to push. Proceed?
```

## Red Flags — Block Push

다음 중 하나라도 해당되면 **stop**:

- Working tree dirty
- Secrets/env 파일 variations committed (`.env.local`, `.env.production` 등)
- Build / Typecheck fail
- 콘텐츠 자리표시자 게이트 fail (`content-pending-gate.sh` exit 1 · 2 — 확정 전 사업자정보 · 약관 문안이 prod 에 나간다)
- Test fail
- UI 변경인데 수동 검증 미완료
- Migration 있는데 backend / DB 소유자와 합의/적용 계획 없음
- DS API 변경인데 version bump 누락
- prod 에만 있는 커밋이 있어 fast-forward 가 안 됨 (되감기 위험 — Phase 7)
- 최근 prod deploy 실패 히스토리
- **paths filter 에 안 걸리는 변경만 있는데 prod 푸시** — workflow 트리거 0 인데 사용자가 "배포됨" 으로 오인. Phase 1 에서 반드시 판정

## Integration

**Called by:**

- `nomacomfe-finish-branch` (Option 1 이 prod 를 target 으로 할 때 자동)
- 사용자 직접 호출 (PR 머지 전)

**Calls:**

- `verification-before-completion` — 각 verification step 에서 증거 원칙 적용

**Related docs:**

- `.claude/rules/deployment.md` (CodeDeploy 흐름, path filter, 브랜치 전략 (b) 확정)
- `.claude/rules/dev-process.md` (Tier·QA 게이트 — 이 skill 앞단의 `nomacomfe-finish-branch` Step 0)
- `.claude/rules/ssm-paths.md` (SSM 경로 + secret naming)
- `apps/admin/CLAUDE.md` (dual DB 구조, 운영자 인증 미구현 등 — Phase 5 DB ownership 판단의 1차 소스)
- `apps/client/CLAUDE.md` (Maya API 흐름, Nuxt 4 server import 규칙 등)

## Gotchas

Claude 가 실제로 실수했거나 빠질 수 있는 덫:

- **`.env.example` 과 `.env.local` 구분 실패**: Phase 1.3 의 grep 패턴이 `.env.example` 도 잡을 수 있어 false positive. 명시적 `grep -v '\.env\.example$'` 적용
- **DS publish 는 `main` push 트리거**: `design-system-publish.yml` 이 `main` 에서 돈다. prod 머지는 app 재배포만 트리거하고 DS publish 는 별개다
- **`--tolerate-republish` 함정** (publish 정책 채택 후): 같은 버전 republish 해도 CI 초록. "CI 초록 = 버전 올라간 것" 오판 금지. 실제 bump 는 `package.json` diff 로만 확인
- **Paths filter 에 없는 변경이 더 위험**: `turbo.json`, `tsconfig.base.json`, `.yarnrc.yml`, `apps/design-*/**` 은 workflow paths 필터에 없음 — 변경 시 **배포 안 되지만 로컬 dev 에서 깨질 수 있음**. PR 에 workflow paths 도 함께 수정해야 하는지 검토
- **dev sync 를 찾지 말 것**: nomacom 에는 `dev` 브랜치가 없다(브랜치 모델 (b) 확정). m8-frontend 스킬을 참조하다 prod↔dev sync 단계를 만들어내는 것이 대표적 오이식이다
- **DB ownership 미확정**: m8 는 main DB 가 backend 소유라 admin/client 가 schema 변경 시 backend 합의 필수. nomacom 은 backend 가 별도 service 인지 admin server 자체에서 owns 인지 audit 필요. Phase 5 에서 이 구분 모호하면 보수적으로 "변경 보류 + 확인 요청"
- **prod push hook 차단**: `.claude/hooks/guard-prod-push.sh` 가 `git push *prod*` 차단. 본 skill 완료 후에도 사용자 명시 승인 필요
- **mobile 경로는 본 skill 범위 밖**: `apps/mobile/**` 변경은 Expo EAS / OTA 경로로 별도. CodeDeploy 파이프라인 (admin/client) 과 분리. mobile prod 배포는 EAS 채널 기준 별도 절차 필요
- **확정된 환경값** (2026-09-02 실측): registry = DockerHub `imjohnkoo/nomacom-{admin,client}:prod` · CodeDeploy application = `nomacom-admin`/`nomacom-client`, deployment group = `prod` · SSM = `/nomacom/*` (`.claude/rules/ssm-paths.md`). 이제 placeholder 가 아니다
