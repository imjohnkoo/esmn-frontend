#!/usr/bin/env bash
# guard-prod-push.sh 회귀 테스트.
#
# 실행: .claude/hooks/guard-prod-push.test.sh
#
# 훅을 완화할 때마다 «진짜 위험이 여전히 막히는지», 조일 때마다 «정상 작업이 통과하는지»
# 확인하기 위한 케이스 고정. ALLOW 케이스 다수는 m8-frontend 에서 2026-08-13 배포 중
# 실제로 오탐 차단됐던 명령 형태다 (같은 판정 로직을 이식했으므로 같은 덫이 있다).
#
# ⚠️ nomacom 은 m8 과 달리 **prod push 를 차단**한다 — Dockerfile 게이트가 없어
#    훅이 유일한 사전 방어선이기 때문. m8 판 테스트에서 이 부분만 반전돼 있다.
set -u

HOOK="$(cd "$(dirname "$0")" && pwd)/guard-prod-push.sh"
pass=0
fail=0

run() { # run <expect: allow|block> <command>
  local expect="$1" cmd="$2" out actual
  # 훅은 이 테스트를 돌린 bash 로 부른다(/bin/bash test.sh 가 정말 3.2 로 돌게 — shebang 의 env bash 를 타지 않는다)
  out=$(jq -n --arg c "$cmd" '{tool_input: {command: $c}}' | "$BASH" "$HOOK")
  # 차단 = permissionDecision deny 인 JSON 하나 · 통과 = 빈 출력. 그 밖의 출력은 실패로 센다
  if [[ -z "$out" ]]; then
    actual="allow"
  elif [[ "$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null)" == deny ]]; then
    actual="block"
  else
    actual="bad-output"
  fi
  if [[ "$actual" == "$expect" ]]; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    printf '  ⛔ expected %-5s got %-5s : %s\n' "$expect" "$actual" "$cmd"
  fi
}

echo "== ALLOW (정상 작업 — 막히면 안 됨) =="

# 복합 명령 오탐 ①: gh api 의 -f(field) 를 force push 로 오인하면 안 된다
run allow 'git push -q origin feat/client-toss 2>&1 | tail -3; SHA=$(git rev-parse HEAD); gh api -X PATCH repos/o/r/git/refs/heads/staging --field sha=$SHA'
# 복합 명령 오탐 ②: dev push 인데 뒤쪽 echo 의 prod 문자열로 차단되면 안 된다
run allow 'git fetch origin --quiet && git push -q origin HEAD:dev 2>&1 | tail -3; echo "prod = $(git log -1 --format=%h origin/prod)"'

# dev 는 nomacom 의 기본 개발 브랜치(2026-10-04 main 에서 이름 변경) — 막지 않는다
run allow 'git push origin dev'
run allow 'git push origin HEAD:dev'
run allow 'git push origin feat/my-branch'
run allow 'git push -u origin imjohnkoo/admin-ui-update'

# 단어 경계 판정 — prod 를 부분문자열로 포함하는 정상 브랜치
run allow 'git push origin feat/product-detail'
run allow 'git push origin fix/reproduce-esim-issue'
run allow 'git push origin chore/production-notes'

# 조회는 전부 안전
run allow 'git log -1 origin/prod'
run allow 'git diff --name-only origin/prod origin/dev -- apps/admin'
run allow 'gh api repos/o/r/git/refs/heads/prod --jq .object.sha'
run allow 'gh run list --branch prod --limit 4'
run allow 'aws deploy get-deployment --deployment-id d-ABC123'
run allow 'aws ssm get-parameter --name /nomacom/admin/APP_URL --with-decryption'
run allow 'aws ssm describe-parameters --max-results 50'
run allow 'docker pull imjohnkoo/nomacom-client:prod'
run allow 'git reset --soft HEAD~1'
run allow 'git checkout -- design/README.md'

# heredoc 본문 = 데이터. 커밋 메시지·문서에 담긴 명령 «예시» 로 막히면 안 된다
run allow "$(printf 'git commit -F - <<%s\nfix: 훅 오탐 정리\n\n  git push origin prod\n  gh api -X PATCH repos/o/r/git/refs/heads/prod -f sha=abc\n위 두 예시가 판정에 걸리면 안 된다.\nMSG' "'MSG'")"
run allow "$(printf 'cat > docs/note.md <<%s\n# 배포\ngit push origin prod 로 배포한다.\nEOF' "'EOF'")"

# 2026-10-04 구멍 수정과 함께 — 이름에 prod 가 든 정상 브랜치 · 조회 · dev base PR 은 통과해야 한다
run allow 'git push origin HEAD:refs/heads/dev'
run allow 'git push -u origin imjohnkoo/prod-push-check-fix'
run allow 'git push origin HEAD:refs/heads/imjohnkoo/hook-prod-refspec'
run allow 'git push origin x/prod'
run allow 'git push -u origin feat/x 2>&1 | grep -c "*"'
run allow 'gh api repos/o/r/git/refs/heads/prod'
run allow 'gh api repos/o/r/branches/prod --jq .commit.sha'
run allow 'gh api repos/o/r/git/refs/heads/production-notes -f sha=abc'
run allow 'gh pr create --base dev --title "fix(hook): prod refspec 구멍"'
run allow 'gh pr list --base prod'

echo "== BLOCK (진짜 위험 — 반드시 막혀야 함) =="

# prod 배포 트리거 — nomacom 은 Dockerfile 게이트가 없어 훅이 유일한 사전 방어선
run block 'git push origin prod'
run block 'git push origin HEAD:prod'
run block 'git push origin fa27295:prod'
# Orca 워크트리 상시 사용 → git -C 는 일상 형태. 전역 옵션이 껴도 잡혀야 한다
run block 'git -C ~/orca/workspaces/nomacom-frontend/admin-ui-update push origin prod'
run block 'git --no-pager -c user.name=x push origin HEAD:prod'
# gh api 로 prod ref 직접 이동 = git push 와 동등
run block 'gh api -X PATCH repos/imjohnkoo/nomacom-frontend/git/refs/heads/prod -f sha=abc123'
run block 'gh api --method PATCH repos/imjohnkoo/nomacom-frontend/git/refs/heads/prod -f sha=abc123'
# ref 되감기 — 배포를 되돌리고 커밋이 소실된다
run block 'gh api -X PATCH repos/o/r/git/refs/heads/dev -f sha=abc -F force=true'

# force push 는 어느 브랜치든 차단
run block 'git push --force origin dev'
run block 'git push -f origin feat/x'
run block 'git push --force-with-lease origin dev'

# 나머지 파괴적 명령
run block 'git reset --hard HEAD~3'
run block 'docker push imjohnkoo/nomacom-client:prod'
run block 'aws ssm put-parameter --name /nomacom/shared/db/DATABASE_URL --value x --type SecureString --overwrite'
run block 'aws ssm delete-parameter --name /nomacom/admin/APP_URL'
# 복합 명령 안에 섞여 있어도 잡힌다
run block 'yarn build && git push origin prod'

# 2026-10-04 구멍 수정 — 목적지가 «refs/heads/prod» · 따옴표 · «+» · 삭제여도 prod 다
run block 'git push origin HEAD:refs/heads/prod'
run block 'git push origin refs/heads/dev:refs/heads/prod'
run block 'git push origin "HEAD:prod"'
run block "git push origin 'prod'"
run block 'git push origin +prod'
run block 'git push origin --delete refs/heads/prod'
# «+refspec» · 짧은 옵션 묶음 = force
run block 'git push origin +HEAD:dev'
run block 'git push -fu origin feat/x'
# 여러 ref 를 한꺼번에(prod 포함 가능)
run block 'git push --mirror origin'
run block 'git push --all origin'
run block "git push origin 'refs/heads/*:refs/heads/*'"
# gh api 는 필드를 주면 -X 없이도 POST — ref 생성 · 갱신 · 이름 바꾸기
run block 'gh api repos/o/r/git/refs -f ref=refs/heads/prod -f sha=abc'
run block 'gh api repos/o/r/git/refs/heads/prod -f sha=abc'
run block 'gh api -X PUT repos/o/r/git/refs/heads/prod -f sha=abc'
run block 'gh api repos/o/r/branches/dev/rename -f new_name=prod'
run block 'gh api -X POST repos/o/r/branches/prod/rename -f new_name=old'
run block "gh api graphql -f query='mutation { createRef(input: {name: \"refs/heads/prod\", oid: \"abc\", repositoryId: \"R\"}) { ref { name } } }'"
# prod 를 base 로 하는 PR — 머지하면 prod 가 움직인다
run block 'gh pr create --base prod --title x --body y'
run block 'gh pr create -B prod'
run block 'gh pr edit 12 --base prod'

# 판정 케이스 파일(2026-10-05 QA ⑥ — 누락 · 오탐 · 따옴표 회귀 · 입력 깨짐) — 여러 줄 명령 그대로 · CRLF 판도 한 번 더
CASES="$(cd "$(dirname "$0")" && pwd)/guard-prod-push.cases.txt"
run_cases() { # run_cases <crlf: 0|1>
  local crlf="$1" line expect="" cmd="" have=0
  flush() {
    (( have )) || return
    cmd="${cmd%$'\n'}"
    (( crlf )) && cmd="$(printf '%s' "$cmd" | sed 's/$/\r/')"
    run "$expect" "$cmd"
    have=0; cmd=""
  }
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "=== "* ]]; then
      flush
      expect="${line#=== }"; expect="${expect%% *}"; have=1; cmd=""
    elif (( have )); then
      cmd+="$line"$'\n'
    fi
  done < "$CASES"
  flush
}
echo "== 케이스 파일 $(grep -c '^=== ' "$CASES")건 (LF · CRLF) =="
[[ -f "$CASES" ]] || { echo "  ⛔ 케이스 파일 없음: $CASES"; fail=$((fail + 1)); }
run_cases 0
run_cases 1

# fail-closed — jq 가 없거나 awk 가 죽으면 «통과» 가 아니라 «차단» 이다
FC=$(mktemp -d)
mkdir -p "$FC/nojq" "$FC/badawk"
for t in bash cat tr sed awk grep printf mktemp; do p=$(command -v "$t") && ln -sf "$p" "$FC/nojq/$t"; done
for t in bash cat tr sed grep jq printf; do p=$(command -v "$t") && ln -sf "$p" "$FC/badawk/$t"; done
printf '#!/bin/sh\nexit 2\n' > "$FC/badawk/awk" && chmod +x "$FC/badawk/awk"
# awk 가 제 할 일을 다 내고 실패 코드로 끝나도(일부만 내고 죽는 경우의 대역) 막는다 — pipefail(7회차 minor 10)
mkdir -p "$FC/lateawk"
for t in bash cat tr sed grep jq printf; do p=$(command -v "$t") && ln -sf "$p" "$FC/lateawk/$t"; done
printf '#!/bin/sh\n"%s" "$@"\nexit 2\n' "$(command -v awk)" > "$FC/lateawk/awk" && chmod +x "$FC/lateawk/awk"
mkdir -p "$FC/latesed"
for t in bash cat tr awk grep jq printf; do p=$(command -v "$t") && ln -sf "$p" "$FC/latesed/$t"; done
printf '#!/bin/sh\n"%s" "$@"\nexit 2\n' "$(command -v sed)" > "$FC/latesed/sed" && chmod +x "$FC/latesed/sed"
fc() { # fc <이름> <PATH> — 정상 명령(git status)도 막혀야 한다
  local o; o=$(printf '%s' '{"tool_input":{"command":"git status"}}' | PATH="$2" "$BASH" "$HOOK" 2>/dev/null)
  if [[ "$o" == *'"deny"'* ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); printf '  ⛔ fail-closed 아님: %s\n' "$1"; fi
}
echo "== fail-closed (jq 없음 · awk 실패 · awk · sed 출력 뒤 실패) =="
fc "jq 없음" "$FC/nojq"
fc "awk 실패" "$FC/badawk"
fc "awk 출력 뒤 실패" "$FC/lateawk"
fc "sed 출력 뒤 실패(pipefail)" "$FC/latesed"

echo
printf 'pass=%d fail=%d\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]] || exit 1
