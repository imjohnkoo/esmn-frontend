---
name: nomacomfe-finish-branch
description: Complete nomacom-frontend worktree work — enforce the Tier/QA gate (Step 0), verify Turbo build/typecheck, present merge/PR options, and clean up the worktree after explicit approval. Use when implementation is done and you need to integrate the work.
---

# nomacom-frontend Finish Branch

Guide completion of worktree development. **Gate → Verify → options → execute → cleanup.**

**Announce at start:** "nomacomfe-finish-branch 로 작업을 마무리합니다."

## Core Principles

- **Step 0 를 건너뛰지 않는다** — 프로세스 v2 의 검증 규칙은 모든 트랙이 지나는 이 관문에서 집행된다
- **Verify before offering options** — no broken code gets merged
- **Paths-filter awareness** — `packages/design-tokens/**` 또는 `packages/design-vue/**` 변경은 **admin + client 둘 다** 배포 트리거. `packages/design-mobile/**` 은 mobile 전용
- ⛔ **삭제는 전부 사용자 명시 승인 후** — 브랜치·worktree·Orca 세션 중 **하나도** 승인 없이 지우지 않는다. 머지가 끝나 «정리하면 친절하겠지» 로 보이는 상황이 가장 위험하다 (Step 5)
- **Worktree 위치는 두 가지** — Orca 관리 `~/orca/workspaces/nomacom-frontend/<name>` (표준) 또는 수동 sibling `~/dev/worktrees/nomacom-frontend/<name>`. **정리 명령이 서로 다르다**

> ⛔ **이 스킬을 안 지나가면 작업은 고립된다.** 2026-08-18~26 사이 워크트리 5개에 **139커밋**이 쌓였고 main 최근 커밋은 5월이었다 (2026-09-02 일괄 통합으로 해소). 워크트리는 작업 장소이지 보관소가 아니다.

## Process

### Step 0: Tier / QA 게이트 확인 — 머지 옵션을 열기 전 검사 ⭐

0. **콘텐츠 자리표시자 게이트 — 모든 Tier(T0 포함) 먼저** — `env -u CONTENT_GATE_ROOT bash .github/scripts/content-pending-gate.sh` (머지할 **커밋** HEAD 를 본다 — 디스크 파일이 아니다. 미커밋 변경은 게이트 스크립트 포함 먼저 커밋할 것 — 판정 규칙은 디스크의 스크립트에서 읽는다)
   - `0` → 계속
   - `1` → 확정 전 문안(`P9_4_PENDING`)이 커밋에 남아 있다. **Step 3 에서 옵션 1(로컬 머지)을 빼고, 옵션 2 는 `--draft` 로만** 연다 (prod 승격에 실려 나가는 것 차단 — client W1-2 spec D-17). CI `content-gate` job 도 빨간불이다
   - `2` → 검사 불가. 통과로 보지 않는다 — 원인을 고치고 다시
   - spec DoD 에 **머지 선행조건**(예: client-shell 은 P6 #2 — 현재 통합 브랜치(dev)의 prod 승격)이 적혀 있으면 그것도 여기서 확인한다. 미충족이면 게이트 `1` 과 같이 취급
1. **Tier 확인** — spec/plan 헤더 pill 또는 핸드오프 브리프에서. 기록이 없으면 지금 판정해 plan 헤더에 기록.
   - T2 트리거: 신규 화면/플로우 · 외부연동(Maya·스마트스토어·Cafe24·PG) · Drizzle 스키마 · 과금/PII · 다중 파일 신규 기능 · mobile 신규 화면
   - 버그픽스는 **파일 수 무관 T1**
2. **T2/T3** — QA 증거 확인: 카드 코멘트(또는 plan as-built)의 `nomacomfe-qa-session` 결과
   - ⑥ 적대적 리뷰 **blocker/major 0**
   - 사용자 노출 화면 · 쓰기/과금/PII · 외부연동이면 **⑦ acceptance walk 결과**
   - **없으면 Step 3 옵션 제시 전 중단** — "QA 미수행. `nomacomfe-qa-session` 을 먼저 진행할까요?"
3. **T1** — 종결 diff 에 **회귀 증거** 동봉 여부 확인:
   - `packages/design-vue` 변경이면 vitest 회귀 테스트
   - `apps/client` 변경이면 순수 로직은 vitest 회귀 테스트, 화면·환경 의존이면 검증 커맨드 출력 or Orca 스크린샷
   - `apps/admin` 은 아직 테스트 0건 — 검증 증거로 대체하되 로직이 들어오는 트랙부터는 테스트 동봉
   - 둘 다 없으면 plan 에 불가 사유 1줄이 있는지 확인. 그것도 없으면 중단하고 확인 요청
4. **D 트랙** (`design/` 캔버스) — 오너 승인 여부 + **슬라이더 런타임 값이 아니라 소스 기본값에 반영됐는지** 확인
5. **T0** — 0번(콘텐츠 게이트) 외 검사 없음, Step 1 로

### Step 1: Verify Build + Affected Apps

변경 파일을 보고 영향 앱만 빌드 (Turbo 가 incremental 처리):

```bash
git fetch origin --quiet || exit 1   # origin/dev 가 없거나 낡으면 merge-base 가 비어 «영향 앱 0» 으로 잘못 판정된다
git diff --name-only $(git merge-base HEAD origin/dev)...HEAD
```

영향 앱 판정 룰 (GitHub Actions paths-filter 와 동일):

| 변경 경로                                                              | 영향 앱            |
| ---------------------------------------------------------------------- | ------------------ |
| `packages/design-tokens/**`, `packages/design-vue/**`                  | **admin + client** |
| `packages/design-mobile/**`                                            | mobile             |
| `apps/admin/**` / `apps/client/**` / `apps/mobile/**`                  | 해당 앱만          |
| root (`package.json`, `yarn.lock`, `turbo.json`, `tsconfig.base.json`) | admin + client     |
| `deploy/**`, `appspec.yml`, `.github/workflows/**`                     | admin + client     |

```bash
yarn turbo run lint typecheck test build --filter=... || exit 1
```

**하나라도 fail 이면 stop** — 실패 출력 보여주고 진행 금지.

> ✅ **2026-09-02 (INF-1) 부터 `typecheck`·`test`·`lint` 가 실제로 돈다.** 이전에는 admin/client 에
> script 가 없어 no-op 이었다. 현재 실체:
>
> - `typecheck` — `.github/scripts/typecheck-gate.sh` 가 **baseline 초과분만 차단** (admin 0 / client 4건 기준선 — 2026-09-23 7 → 4). 신규 타입 에러는 실패한다
> - `test` — design-vue 137 + client 1351(2026-10-04 W1-2 · W1-3 머지) 건. admin 은 아직 0건(`passWithNoTests: true`)
> - `lint` — 에러만 차단(경고는 통과). prettier 포맷은 PostToolUse 훅이 담당
>
> ✅ **INF-2(2026-09-02) 부터 PR·dev push 에서 CI 가 같은 검사를 강제한다** (`.github/workflows/ci.yml`). 로컬에서 돌리는 것은 여전히 빠른 피드백을 위해서다 — CI 실패를 기다리지 말 것.

### Step 2: Determine Base Branch

**base 는 `dev` 가 기본이다**(2026-10-04 `main` 에서 이름 변경 — `main` 브랜치는 없다). `prod` 는 배포 트리거다.

```bash
git merge-base HEAD origin/dev   # 후보 확인
```

사용자에게 확인: "Base branch로 `dev` 를 사용할까요?" — `prod` 를 base 로 잡는 것은 **배포 의도가 명시된 경우만**이고, 그 경로는 `nomacomfe-prod-push-check` 를 먼저 지나야 한다.

### Step 3: Present Options

> Step 0-0 콘텐츠 게이트가 `1` 이면 아래에서 **1 을 빼고**, 2 는 «draft PR» 로 제시한다.

```
Implementation complete. What would you like to do?

1. Merge locally to dev
2. Push and create PR to dev
3. Push branch as-is (keep open, I'll handle manually)
4. Discard this work

Which option?
```

### Step 4: Execute Choice

#### Option 1: Merge Locally to `dev`

```bash
cd ~/dev/current-projects/nomacom-frontend    # 메인 클론으로 이동 (worktree 에서 base 체크아웃 불가)
git fetch origin
git checkout dev && git pull --ff-only || exit 1   # 실패하면(다른 워크트리에 dev · dirty) 게이트 · 머지가 엉뚱한 브랜치에 일어난다
[ "${MERGE_PREREQ_OK:-}" = yes ] || exit 1   # spec 머지 선행조건(예: client-shell 은 P6 #2)을 확인하고 yes 로 둔 뒤에만
# 게이트 스크립트 — dev 에 아직 없으면(그 스크립트를 들여오는 첫 머지) 워크트리 것을 메인 클론 저장소에 대고 부른다
GATE=.github/scripts/content-pending-gate.sh
[ -f "$GATE" ] || GATE="<worktree>/.github/scripts/content-pending-gate.sh"
# 판정 대상 = 메인 클론(워크트리 HEAD 가 아니다) — CONTENT_GATE_ROOT 는 export 하지 말고 명령마다 앞에 붙인다(셸에 남으면 다른 저장소를 본다)
# 머지 **전에** 양쪽 부모를 본다 — 둘 다 0 이어야 머지한다(머지 뒤 실패하면 로컬 dev 에 커밋이 남는다)
CONTENT_GATE_ROOT="$(pwd)" bash "$GATE" HEAD && CONTENT_GATE_ROOT="$(pwd)" bash "$GATE" <feature-branch> || exit 1
git merge --no-ff <feature-branch> || exit 1   # 충돌이면 멈춘다 — 손으로 해결했다면 아래 게이트 재검사부터 다시
yarn install && yarn turbo run build --filter=nomacom-admin --filter=nomacom-client || exit 1
CONTENT_GATE_ROOT="$(pwd)" bash "$GATE" HEAD || exit 1   # 머지 결과를 다시(충돌 해결에서 들어온 경우)
git push origin dev
```

> 머지 뒤 게이트가 실패하면 **push 하지 않고** 사용자에게 보고한다. 로컬 dev 를 되돌리는 것(`git reset --keep origin/dev`)도 사용자 승인 뒤에만 — 그 전에 prod-push-check 를 돌리면 안 된다(로컬 dev 에 자리표시자 커밋이 있다).

> `dev` push 는 `packages/design-*` 변경이 포함되면 `design-system-publish.yml` 을 트리거한다 — **DS version bump 선행 여부**를 확인할 것.

#### Option 2: Push + PR

```bash
cd <worktree>
git push -u origin <feature-branch> || exit 1   # 실패하면 게이트가 본 HEAD 와 PR 의 원격 상태가 어긋난다
# 기본은 draft — ready 로 열면 GitHub UI 에서 바로 머지된다(dev 에 required check 없음).
# ready 는 콘텐츠 게이트 0 **이고** spec 의 머지 선행조건(예: client-shell 은 P6 #2)을 확인해 MERGE_PREREQ_OK=yes 로 둔 때만
DRAFT="--draft"
if env -u CONTENT_GATE_ROOT bash .github/scripts/content-pending-gate.sh >/dev/null 2>&1 && [ "${MERGE_PREREQ_OK:-}" = yes ]; then DRAFT=""; fi
# draft 를 ready 로 바꿀 때(`gh pr ready`)도 같은 두 조건을 **그때 다시** 확인한다 — PR 을 연 뒤 커밋이 늘었을 수 있다
gh pr create --base dev $DRAFT --title "<type>(<scope>): <title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets>

## Spec / Plan
- spec: nomacom-wiki wiki/frontend/specs/<app>/<file>.md
- plan: nomacom-wiki wiki/frontend/plans/<app>/<file>-plan.md
- Tier: T?

## QA 증거
- ⑥ 적대적 리뷰: blocker 0 / major 0 / minor <n>
- ⑦ acceptance walk: <n>/<n> pass (해당 시)
- 알고 넘어가는 목록: <minor 요약 or 없음>

## Affected apps
- [ ] admin (apps/admin)
- [ ] client (apps/client)
- [ ] mobile (apps/mobile)
- [ ] design-tokens / design-vue / design-mobile

## Test Plan
- [ ] yarn turbo run build (admin/client)
- [ ] design-vue vitest (DS 변경 시)
- [ ] mobile typecheck (mobile 변경 시)
- [ ] UI 수동 검증 — Orca 내장 브라우저로 golden path

## Deploy impact (paths filter)
- Changed: <경로>
- Triggered on prod merge:
  - [ ] admin-production.yml
  - [ ] client-production.yml
  - [ ] (mobile EAS — 별도 채널)

## DS version bump
- [ ] packages/design-*/package.json `version` 올림 (외부 consumer 영향 있으면)
EOF
)"
```

**Keep worktree** (PR 리뷰 중 수정 가능하도록). Step 5 스킵.

#### Option 3: Push As-Is

```bash
git push -u origin <feature-branch>
```

브랜치만 push, worktree 유지.

#### Option 4: Discard

**확인 프롬프트** — 무엇이 사라지는지 나열한다:

```
This will permanently delete:
- Branch:   <feature-branch>
- Commits:  <count> commits (미머지)
- Worktree: <경로>

Type 'discard' to confirm.
```

### Step 4.5: prod 승격 (별도 경로)

`prod` 로의 이동은 이 스킬이 자동으로 하지 않는다. **`nomacomfe-prod-push-check` 로 pre-flight 를 마치고 사용자 명시 승인** 후 진행한다.

- `.claude/hooks/guard-prod-push.sh` 가 `git push ... prod` 와 `gh api ... refs/heads/prod` 쓰기를 **차단**한다 (2026-09-02 부터 실제 동작 — 그 전에는 문서에만 있었다)
- 승격은 **dev → prod 한 방향**이다 — **prod↔dev sync 단계는 존재하지 않는다** (m8 규약을 복사하지 말 것)

### Step 4.7: 칸반 상태 전환 (Orca 워크트리인 경우)

Option 1 머지 완료 시:

```bash
orca worktree set --worktree <sel> --workspace-status completed --json
```

Option 2/3 은 `in-review` 유지 (PR 머지 후 completed). **상태 전환은 이 스킬 관문에서만** — 중간 수동 갱신은 요구하지 않는다.

### Step 5: Cleanup — ⛔ 승인 게이트 (브랜치 · worktree · 세션)

Option 1, 4 에서만 정리한다. Option 2, 3 은 유지.
**머지가 끝났다고 자동으로 정리하지 않는다 — 정리는 별도 승인 사항이다.**

순서 (건너뛰지 말 것):

1. **미커밋 확인** — worktree 에서 `git status`. 뭐라도 있으면 **먼저 커밋한다**. 정리가 미커밋 파일을 통째로 날리면 reflog·trash 어디에도 남지 않는다
2. **지울 목록을 그대로 제시하고 승인 요청** — 브랜치명 / 미머지 커밋 수 / worktree 경로 / Orca 세션 유무. "정리할까요?" 로 뭉뚱그리지 말 것
3. **승인 후에만 실행** — 세션 종료 → worktree 제거 → 브랜치 삭제 순

| 대상         | Orca 워크스페이스                                     | 수동 sibling worktree        |
| ------------ | ----------------------------------------------------- | ---------------------------- |
| 세션(터미널) | `orca terminal stop --worktree <sel>`                 | 해당 없음                    |
| worktree     | `orca worktree rm --worktree <sel>` (git + Orca 동시) | `git worktree remove <path>` |
| 브랜치       | `git branch -d <branch>`                              | 동일                         |

⛔ **`git branch -D` (대문자) 는 deny 규칙에 막혀 있다.** 머지된 브랜치는 `-d` 로 지워지고, `-d` 가 거부하면 그건 «아직 머지 안 됐다» 는 신호다. 강제 삭제하지 말고 사용자에게 보고한다.

## Decision Table

| Option           | Step 0 게이트                    | Build | Base push | Keep worktree       |
| ---------------- | -------------------------------- | ----- | --------- | ------------------- |
| 1. Merge locally | ✓ (콘텐츠 게이트 0 일 때만 제시) | ✓     | ✓ (dev)   | ✗ — **승인 후에만** |
| 2. Push + PR     | ✓ (게이트 1 이면 `--draft`)      | ✓     | — (PR)    | ✓                   |
| 3. Push as-is    | ✓                                | ✓     | ✗         | ✓                   |
| 4. Discard       | —                                | ✗     | ✗         | ✗ — **승인 후에만** |

## Red Flags

**절대 하지 말 것**:

- ⛔ **T2+ 트랙을 QA 증거(⑥ blocker/major 0) 없이 머지** — Step 0 에서 중단하고 `nomacomfe-qa-session` 안내
- ⛔ **구현 세션 자신의 "리뷰 통과" 자기 선언을 QA 증거로 인정**
- ⛔ **승인 없이 브랜치·worktree·Orca 세션 삭제**
- ⛔ **미커밋 변경을 남긴 채 정리** — `git status` 확인 없이 `worktree remove` 하면 복구 경로가 없다
- ⛔ `git branch -D` — deny 규칙. `-d` 가 거부하면 미머지 신호이니 보고
- 빌드 실패 상태로 Option 1~3 진행
- `--force` push / `--no-verify` commit
- **prod 로 직접 머지·push** — `nomacomfe-prod-push-check` 경유 + 사용자 승인이 필수
- 실제로 돌리지 않은 검사를 "통과" 라고 보고 — 출력 원문을 근거로만 보고한다

**반드시**:

- Step 0 → Step 1 순서 유지 (게이트가 빌드보다 먼저)
- Base branch 명시적 확인 (기본 `dev`)
- 영향 앱 파악: DS tokens/vue 변경은 admin+client 둘 다, design-mobile 은 mobile
- Orca 워크스페이스면 **세션(터미널)도 함께 정리** — `git worktree remove` 만 하면 Orca 카드가 유령으로 남는다
- DS 변경 시 외부 consumer 영향 + version bump 검토

## Gotchas

- **Worktree 에서 `git checkout dev` 금지**: dev 가 메인 클론에서 이미 체크아웃돼 있으면 실패. Option 1 은 반드시 메인 클론으로 이동 후 진행
- **`git worktree remove` 가 조용히 실패**: uncommitted 파일 또는 worktree 내 실행 중 프로세스(nuxt dev / expo)가 있으면 실패. `--force` 전에 원인 확인
- **Orca 워크스페이스는 `git worktree remove` 로 반만 지워진다**: `~/orca/workspaces/...` 경로면 Orca 가 메타데이터·터미널·카드를 따로 들고 있다. `orca worktree rm --worktree id:<repoId>::<path>` 가 git + Orca 를 함께 정리
- **`git worktree remove` 는 ask 규칙**: `.claude/settings.json` 의 `ask` 목록에 있어 승인 프롬프트가 뜬다. 정상이며 우회 대상이 아니다
- **stale 생성물이 검증을 오염시킨다**: 메인 클론의 `apps/mobile/.expo/types/router.d.ts` 가 4월자로 남아 mobile typecheck 8건이 실패한 적이 있다(2026-09-02). 원 워크트리에서는 통과했다 — 검증 실패 시 산출물 stale 여부부터 의심
- **mobile 의 EAS 배포는 본 skill 범위 밖**: `apps/mobile/**` 는 `eas build`/`eas update` 별도 채널. CodeDeploy 흐름과 분리

## Integration

**Pairs with:** `nomacomfe-qa-session` (Step 0 이 확인하는 QA 증거의 생산자) · `nomacomfe-prod-push-check` (prod 승격 전 pre-flight) · `verification-before-completion` (Step 1 전 증거 수집)

**Related:** `.claude/rules/deployment.md` (CodeDeploy 흐름·path filter) · `.claude/rules/design-system-publish.md` (DS bump 정책) · `.claude/rules/dev-process.md` (Tier·QA 규칙 정본)
