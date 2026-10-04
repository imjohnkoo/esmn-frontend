---
name: nomacomfe-worktree-setup
description: Create or finish bootstrapping a git worktree for nomacom-frontend — Orca-managed workspaces at ~/orca/workspaces/nomacom-frontend/<name>/ (standard) or manual sibling worktrees, with Yarn workspaces bootstrap and .env.local symlinking. Use when starting a session that needs isolation from other concurrent sessions, or before executing implementation plans.
---

# nomacom-frontend Worktree Setup

Create an isolated worktree for parallel-session work on nomacom-frontend.

**Announce at start:** "nomacomfe-worktree-setup 으로 격리 작업공간을 준비합니다."

## Fixed Conventions

| Setting          | Value                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| 표준 위치        | **`~/orca/workspaces/nomacom-frontend/<name>/`** (Orca 관리 — 실사용 규약)                  |
| 대체 위치        | `~/dev/worktrees/nomacom-frontend/<name>/` (Orca 밖에서 수동 생성할 때만)                   |
| Main clone       | `~/dev/current-projects/nomacom-frontend/` — 통합/기획/리뷰. 동시 세션이면 worktree 로 격리 |
| Base branch      | **`dev`** (2026-10-04 `main` 에서 이름 변경 — `main` 은 없다. `prod` 는 배포 트리거이지 개발 base 가 아니다)  |
| Branch naming    | `imjohnkoo/<topic>` 또는 `<type>/<topic>` (`feat/`·`fix/`·`refactor/`·`chore/`)             |
| Package manager  | **yarn** (Yarn 4.5.3, `nodeLinker: node-modules`)                                           |
| Baseline         | `yarn install` — DS 는 Turbo `^build` 가 빌드 시 처리(별도 build:shared 없음)               |
| doc/.claude only | `yarn install` **불필요**                                                                   |
| `.env.local`     | 심볼릭 링크로 메인 클론 파일 참조 (apps/admin, apps/client)                                 |

## ⭐ Orca 부트스트랩 모드 — nomacom 은 `--setup run` 이 정상

**m8-frontend 와 반대다.** nomacom-frontend 는 Orca repo 설정에 setup hook 이 등록돼 있다:

```
hookSettings.scripts.setup = "yarn install"   ·   setupRunPolicy = "run-by-default"
```

따라서 `orca worktree create ... --setup run` 이 맞고, **`yarn install` 은 Orca 가 이미 수행한 상태**로 세션이 시작된다. m8 스킬의 `--setup skip` 을 복사해 오면 부트스트랩이 누락돼 두 앱이 500 으로 뜬다.

`orca worktree create` 로 만들어진 워크트리 안에서 세션이 시작된 경우 (`orca worktree current --json` 이 워크트리를 반환 / 경로가 `~/orca/workspaces/...`):

1. Step 2~3 (worktree 생성) **skip** — 이미 존재한다
2. Step 5 (`yarn install`) **skip** — setup hook 이 이미 돌았다. 확인만: `[ -d node_modules ] || yarn install`
3. **Step 4 (symlink) 는 반드시 수행** — Orca setup hook 은 `.env.local` 을 만들지 않는다
4. base 확인: `git merge-base --is-ancestor origin/dev HEAD || echo "⚠️ base 가 origin/dev 가 아님 — 확인 필요"`
5. Step 6 보고 후 **칸반 상태 전환**: `orca worktree set --worktree current --workspace-status in-progress --json`

## Process (수동 생성 시)

### 1. Validate Inputs

- Branch/topic name 확보. 없으면 사용자에게 물어봄
- `MAIN=~/dev/current-projects/nomacom-frontend` · `WT=~/dev/worktrees/nomacom-frontend/<name>`

### 2. Pre-flight Checks

```bash
[ -d "$WT" ] && echo "이미 존재 — 다른 이름 요청 또는 기존 worktree 안내"
git -C "$MAIN" worktree list   # 같은 브랜치가 다른 worktree 에 체크아웃돼 있으면 기존 위치 안내 후 중단
```

### 3. Create Worktree

```bash
mkdir -p ~/dev/worktrees/nomacom-frontend
git -C "$MAIN" worktree add "$WT" -b "<type>/<topic>" origin/dev
cd "$WT"
```

### 4. Symlink `.env.local` (코드 작업 시 — Orca 모드에서도 필수)

```bash
for app in admin client; do
  src="$MAIN/apps/$app/.env.local"
  dst="$WT/apps/$app/.env.local"
  [ -f "$src" ] && { rm -f "$dst"; ln -s "$src" "$dst"; }
done
```

`.env.local` 은 gitignored → worktree checkout 시 없다. 링크로 공유하면 시크릿 로테이션이 자동 반영된다. **복사 금지.**

### 5. Install Dependencies (수동 생성 시만)

```bash
cd "$WT" && yarn install
```

**skip 조건**: 문서/`.claude/**` 만 변경하는 작업 · Orca 가 setup hook 으로 이미 설치한 경우.

### 6. Report Ready

```
Worktree ready:
  Path:   <경로>
  Branch: <branch>   (base: origin/dev)
  Status: yarn install ✓ (또는 Orca setup hook 수행 / skip: doc-only)
  Env:    admin, client symlinked

Next: 이 worktree 디렉토리에서 세션 진행.
```

Orca 워크트리면 마지막으로 칸반 전환 (스킬 관문 접합 — 중간 수동 갱신은 없다):

```bash
orca worktree set --worktree current --workspace-status in-progress --json
```

## Common Mistakes

- **❌ 메인 클론에서 직접 작업** — 동시 세션이면 worktree 로 격리. 메인 클론엔 기획 문서 작업이 상주할 수 있다
- **❌ `--setup skip` 사용** — nomacom 은 hook 이 등록돼 있어 skip 하면 의존성이 없다 (m8 규약을 복사한 실수)
- **❌ `.env.local` 복사** — 시크릿 로테이션 시 수동 업데이트 필요 → symlink
- **❌ base 를 `prod` 로** — prod 는 배포 트리거다. 개발 base 는 항상 `dev`
- **❌ doc/.claude only 인데 `yarn install`** — 불필요한 시간 낭비

## Gotchas — 이 리포에서 실제로 일어난 일

- ⛔ **워크트리가 통합되지 않고 고립된다.** 2026-08-18~26 사이 5개 워크트리에 **139커밋**이 쌓였고 main 최근 커밋은 5월이었다 (2026-09-02 일괄 통합으로 해소). 작업이 끝나면 `nomacomfe-finish-branch` 를 **반드시** 지나게 한다 — 워크트리는 작업 장소이지 보관소가 아니다
- ⛔ **미커밋 변경을 남긴 채 정리 금지.** 검증이 끝나면 묻기 전에 커밋한다. `git worktree remove` 는 미커밋 파일을 복구 불가로 날린다
- ⛔ **worktree 안에서 `git stash`/`stash pop` 금지** — 트리가 clean 이면 stash 가 생성되지 않아 남의 stash 를 pop 하게 된다
- ⚠️ **stale 생성물 주의** — 메인 클론의 `apps/mobile/.expo/types/router.d.ts` 가 4월자로 남아 있어 mobile typecheck 가 8건 실패한 적이 있다(2026-09-02). `.expo/` 는 gitignore 산출물이니 의심되면 지우고 재생성
- ⚠️ **새 워크스페이스는 의존성이 불완전할 수 있다** — 두 앱이 500 으로 뜨면 `yarn install` 부터 확인

## Cleanup

작업 완료 후 `nomacomfe-finish-branch` 가 처리 (⛔ **사용자 승인 후에만**). 수동:

```bash
# Orca 워크스페이스 — git + Orca 메타데이터를 함께 정리해야 유령 카드가 안 남는다
orca worktree rm --worktree id:<repoId>::<path> --json
# 수동 sibling worktree
git -C ~/dev/current-projects/nomacom-frontend worktree remove <path>
```

## Integration

**Pairs with:** `nomacomfe-finish-branch` (작업 완료 후 QA 게이트 → merge/PR → 정리)
**Related:** `nomacomfe-spec-session` (핸드오프가 이 스킬을 지시) · `.claude/rules/deployment.md`
