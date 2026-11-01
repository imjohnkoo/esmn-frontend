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
# 승인 예외는 훅 입력 cwd 의 origin 을 본다 — 어디서 돌려도 같게 이 리포 루트를 넘긴다
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
pass=0
fail=0

# 승인 예외 1단(2026-11 · ROLE-LAYER D21)의 허브 verify 는 스텁으로 돌린다 — 실 허브 · 원장을 건드리지 않게.
#   기본 스텁은 «verify ok» 를 내는 쪽(argv 가 정확한 꼴 — --consume 포함 — 일 때만 exit 0)이다: 전체 케이스가 «verify 가 승인해도» 그대로
#   판정되는지 — 예외가 정확한 한 형태 밖으로 새지 않는지 — 를 함께 증명한다. 스텁은 받은 argv · env 를 그 디렉터리의 calls 에 한 줄씩 남긴다.
#   실행 비트는 주지 않는다(훅은 python3 로 부른다 — [ -f ] 판정)
APH=$(mktemp -d)
mkstub() { # mkstub <디렉터리> <파이썬 본문>
  mkdir -p "$1/scripts"; printf '#!/usr/bin/env python3\nimport sys, re, time, os, json\na = sys.argv[1:]\nopen(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "calls"), "a").write(json.dumps({"argv": a, "env": {k: os.environ.get(k) for k in ("ESMN_APPROVAL_DIR", "ESMN_PM_REGISTRY", "ESMN_APPROVAL_POLICY", "NOMACOM_MANAGER")}}) + "\\n")\n%s\n' "$2" > "$1/scripts/approval.py"
}
mkstub "$APH/ok" 'ok = len(a) == 7 and a[0] == "verify" and re.fullmatch(r"AP-[A-Za-z0-9-]+", a[1]) and a[2:4] == ["--action", "prod-promote"] and a[4] == "--target" and re.fullmatch(r"esmn-frontend@[0-9a-f]{40}:prod", a[5]) and a[6] == "--consume"
sys.exit(0) if ok else (print("stub: 인자 불일치 %r" % a, file=sys.stderr), sys.exit(1))'
mkstub "$APH/deny" 'print("승인 아님: target 불일치", file=sys.stderr); sys.exit(1)'
mkstub "$APH/slow" 'time.sleep(30)'
mkstub "$APH/crash" 'raise RuntimeError("stub crash")'
mkdir -p "$APH/missing"
export GUARD_PROD_PUSH_HUB="$APH/ok"

run() { # run <expect: allow|block> <command>
  local expect="$1" cmd="$2" out actual
  # 훅은 이 테스트를 돌린 bash 로 부른다(/bin/bash test.sh 가 정말 3.2 로 돌게 — shebang 의 env bash 를 타지 않는다)
  out=$(jq -n --arg c "$cmd" --arg d "$REPO" '{cwd: $d, tool_input: {command: $c}}' | "$BASH" "$HOOK")
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
run block 'git -C ~/orca/workspaces/esmn-frontend/admin-ui-update push origin prod'   # 개명 뒤 새 워크트리 폴더(2026-10-09)
run block 'git --no-pager -c user.name=x push origin HEAD:prod'
# gh api 로 prod ref 직접 이동 = git push 와 동등
run block 'gh api -X PATCH repos/imjohnkoo/nomacom-frontend/git/refs/heads/prod -f sha=abc123'
run block 'gh api --method PATCH repos/imjohnkoo/nomacom-frontend/git/refs/heads/prod -f sha=abc123'
# 2026-10-09 nomacom-frontend → esmn-frontend 개명 — GitHub 가 옛 이름을 리다이렉트하므로 옛 · 새 이름 둘 다 막혀야 한다
run block 'gh api -X PATCH repos/imjohnkoo/esmn-frontend/git/refs/heads/prod -f sha=abc123'
run block 'gh api --method PATCH repos/imjohnkoo/esmn-frontend/git/refs/heads/prod -f sha=abc123'
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

echo "== 승인 예외 1단 (ESMN_APPROVAL_ID + 허브 verify 스텁) =="
AP_SHA=0123456789abcdef0123456789abcdef01234567
AP_CMD="ESMN_APPROVAL_ID=AP-20261102-001 git push origin $AP_SHA:prod"
ap_run() { # ap_run <허브 스텁> <expect> <command>
  GUARD_PROD_PUSH_HUB="$APH/$1" run "$2" "$3"
}
ap_calls() { wc -l < "$APH/ok/calls" 2>/dev/null | tr -d ' ' || echo 0; }
ap_run ok allow "$AP_CMD"                                                   # ① 허용 형태 · verify exit 0
# ① 스텁이 받은 argv = verify <ID> --action prod-promote --target esmn-frontend@<그 sha>:prod --consume
ap_last=$(tail -n 1 "$APH/ok/calls" 2>/dev/null)
if [[ "$(printf '%s' "$ap_last" | jq -c .argv)" == "[\"verify\",\"AP-20261102-001\",\"--action\",\"prod-promote\",\"--target\",\"esmn-frontend@$AP_SHA:prod\",\"--consume\"]" ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  ⛔ verify argv 가 다르다: $ap_last"; fi
# ⑥ 세션 env 의 저장소 · 정책 경로 · NOMACOM_MANAGER 는 verify 에 닿지 않는다(unset · 허브 고정 경로)
ESMN_APPROVAL_DIR=/tmp/x ESMN_PM_REGISTRY=/tmp/r ESMN_APPROVAL_POLICY=/tmp/p NOMACOM_MANAGER=/tmp/evil ap_run ok allow "$AP_CMD"
ap_last=$(tail -n 1 "$APH/ok/calls" 2>/dev/null)
if [[ "$(printf '%s' "$ap_last" | jq -c .env)" == "{\"ESMN_APPROVAL_DIR\":null,\"ESMN_PM_REGISTRY\":null,\"ESMN_APPROVAL_POLICY\":null,\"NOMACOM_MANAGER\":\"$APH/ok\"}" ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  ⛔ 세션 env 가 verify 에 샜다: $ap_last"; fi
ap_run ok allow "ESMN_APPROVAL_ID=AP-20261102-001 git push origin $AP_SHA:refs/heads/prod"
ap_run ok allow "  $AP_CMD  "                                                # 앞뒤 공백만은 같은 형태
ap_run deny block "$AP_CMD"                                                 # ② 같은 형태 · verify exit 1
ap_n=$(ap_calls)
ap_run ok block "git push origin $AP_SHA:prod"                              # ③ ID 없음 → 현행 차단
ap_run ok block "$AP_CMD && echo ok"                                        # ④ 세그먼트 추가 → 스캐너 차단
# ③ · ④ 는 예외 밖이라 verify 를 부르지도 않는다(--consume 으로 승인을 써 버리지 않게)
if [[ "$(ap_calls)" == "$ap_n" ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  ⛔ 예외 밖 형태가 verify 를 불렀다"; fi
ap_run missing block "$AP_CMD"                                              # ⑤ 허브 스크립트 없음
SECONDS=0
ap_run slow block "$AP_CMD"                                                 # verify 10초 초과 → 차단
if ((SECONDS > 20)); then fail=$((fail + 1)); echo "  ⛔ verify 시간 초과가 10초에 끊기지 않았다: ${SECONDS}초"; fi
# 예외 꼴이지만 verify 전에 막는 것 — 승인을 써 버리지 않는다(QA ⑥ minor 2 · 보안 리뷰): 끝 CR · NUL · 다른 리포 origin · GIT_DIR
ap_n=$(ap_calls)
ap_run ok block "$AP_CMD"$'\r'
out=$(printf '{"cwd":"%s","tool_input":{"command":"%s\\u0000"}}' "$REPO" "$AP_CMD" | GUARD_PROD_PUSH_HUB="$APH/ok" "$BASH" "$HOOK")
if [[ "$out" == *'"deny"'* ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  ⛔ NUL 든 승인 꼴이 통과했다"; fi
ap_origin() { # ap_origin <push URL…> — 그 origin 을 단 임시 리포에서 승인 꼴은 verify 전에 막혀야 한다
  local d u out; d=$(mktemp -d); git -C "$d" init -q; git -C "$d" remote add origin "$1"
  for u in "${@:2}"; do git -C "$d" config --add remote.origin.pushurl "$u"; done
  [[ $# -gt 1 ]] && git -C "$d" config --add remote.origin.pushurl "$1"
  out=$(jq -n --arg c "$AP_CMD" --arg d "$d" '{cwd: $d, tool_input: {command: $c}}' | GUARD_PROD_PUSH_HUB="$APH/ok" "$BASH" "$HOOK")
  if [[ "$out" == *'"deny"'*"origin push URL"* ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  ⛔ origin 이 $* 인데 승인 꼴이 통과했다: $out"; fi
}
ap_origin git@github.com:imjohnkoo/esmn-backend.git
ap_origin https://evil.example/imjohnkoo/esmn-frontend
ap_origin git@github.com:evil/imjohnkoo/esmn-frontend.git
ap_origin /tmp/x/imjohnkoo/nomacom-frontend
ap_origin git@github.com:imjohnkoo/esmn-frontend.git git@evil:x/y.git        # pushurl 둘 — git 은 둘 다에 민다
GIT_DIR=/tmp/x ap_run ok block "$AP_CMD"
if [[ "$(ap_calls)" == "$ap_n" ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  ⛔ verify 전에 막을 꼴이 verify 를 불렀다"; fi
# 끝 공백이 길어도 빨리 판정한다(256자 넘으면 예외 판정 자체를 하지 않는다 — 다듬기가 600초를 넘겨 판정 없이 통과하던 QA ⑥ major)
#   큰 글은 표준 입력으로 JSON 을 만든다(리눅스는 인자 하나가 128KB 를 넘지 못한다 — jq 가 못 떠 빈 출력이 «allow» 로 세지던 것)
SECONDS=0
out=$(printf 'git push origin HEAD:prod%*s' 200000 '' | jq -Rs '{tool_input: {command: .}}' | GUARD_PROD_PUSH_HUB="$APH/ok" "$BASH" "$HOOK")
if [[ "$out" == *'"deny"'* ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  ⛔ 끝 공백 20만 자 prod push 가 막히지 않았다"; fi
if ((SECONDS > 20)); then fail=$((fail + 1)); echo "  ⛔ 끝 공백 20만 자 판정이 느리다: ${SECONDS}초"; fi
# verify 가 죽으면 사유는 stderr 마지막 줄(Traceback 첫 줄 말고)
ap_reason=$(jq -n --arg c "$AP_CMD" --arg d "$REPO" '{cwd: $d, tool_input: {command: $c}}' | GUARD_PROD_PUSH_HUB="$APH/crash" "$BASH" "$HOOK" | jq -r '.hookSpecificOutput.permissionDecisionReason')
if [[ "$ap_reason" == *"RuntimeError: stub crash"* ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  ⛔ verify 크래시 사유가 마지막 줄이 아니다: $ap_reason"; fi
# 차단 사유에 verify stderr 한 줄이 실린다
ap_reason=$(jq -n --arg c "$AP_CMD" --arg d "$REPO" '{cwd: $d, tool_input: {command: $c}}' | GUARD_PROD_PUSH_HUB="$APH/deny" "$BASH" "$HOOK" | jq -r '.hookSpecificOutput.permissionDecisionReason')
if [[ "$ap_reason" == *"verify 실패"*"승인 아님: target 불일치"* ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "  ⛔ verify 실패 사유가 없다: $ap_reason"; fi

# 꾸민 큰 입력 — 600초 제한을 넘겨 판정 없이 통과(fail-open)하지 않는다(13회차 minor 8): heredoc 본문 400개 · 명령 치환 1만 개 ·
#   닫히지 않은 $( 64개 · 명령 512KB 를 넘으면 판정 불가로 막고, push-option · gh -R 2,000개는 빨리 판정한다(bash 3.2 에서 483초였다).
#   큰 글은 인자가 아니라 표준 입력으로 JSON 을 만든다(리눅스는 인자 하나가 128KB 를 넘지 못한다)
runbig() { # runbig <expect> <command> — run 과 같되 JSON 을 표준 입력으로 만든다
  local expect="$1" cmd="$2" out actual
  out=$(printf '%s' "$cmd" | jq -Rs '{tool_input: {command: .}}' | "$BASH" "$HOOK")
  if [[ -z "$out" ]]; then actual="allow"
  elif [[ "$(printf '%s' "$out" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null)" == deny ]]; then actual="block"
  else actual="bad-output"; fi
  if [[ "$actual" == "$expect" ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); printf '  ⛔ expected %-5s got %-5s : %s…(%d바이트)\n' "$expect" "$actual" "${cmd:0:60}" "${#cmd}"; fi
}
echo "== 꾸민 큰 입력 (상한 · 시간) =="
big=""; for ((k = 0; k < 401; k++)); do big+="bash <<EOF"$'\n'"echo $k"$'\n'"EOF"$'\n'; done
runbig block "$big"
big="echo "; for ((k = 0; k < 10001; k++)); do big+='$(a)'; done
runbig block "$big"
big="echo "; for ((k = 0; k < 65; k++)); do big+='$( '; done
runbig block "$big"
big=$(head -c 524289 /dev/zero | tr '\0' 'a')
runbig block "echo $big"
SECONDS=0
big="git push"; for ((k = 0; k < 2000; k++)); do big+=" -o ci.skip"; done
runbig allow "$big origin dev"
big="gh"; for ((k = 0; k < 2000; k++)); do big+=" -R o/r"; done
runbig allow "$big pr list"
if ((SECONDS > 60)); then fail=$((fail + 1)); echo "  ⛔ push-option · gh -R 걷기가 느리다: ${SECONDS}초"; fi

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
# jq 가 있지만 실패해도(크래시 · 깨진 입력) 통과시키지 않는다
mkdir -p "$FC/badjq"
for t in bash cat tr sed awk grep printf; do p=$(command -v "$t") && ln -sf "$p" "$FC/badjq/$t"; done
printf '#!/bin/sh\nexit 134\n' > "$FC/badjq/jq" && chmod +x "$FC/badjq/jq"
# 스캐너 awk 만 · heredoc 처리기 awk 만 죽어도 막는다(프로그램 글에 든 함수 이름으로 가려 실패시킨다 — 11회차 M1)
mkdir -p "$FC/scanfail" "$FC/hsfail"
for t in bash cat tr sed grep jq printf; do p=$(command -v "$t") && ln -sf "$p" "$FC/scanfail/$t" && ln -sf "$p" "$FC/hsfail/$t"; done
printf '#!/bin/sh\ncase "$*" in *matchparen*) exit 2 ;; esac\nexec "%s" "$@"\n' "$(command -v awk)" > "$FC/scanfail/awk" && chmod +x "$FC/scanfail/awk"
printf '#!/bin/sh\ncase "$*" in *kindof*) exit 2 ;; esac\nexec "%s" "$@"\n' "$(command -v awk)" > "$FC/hsfail/awk" && chmod +x "$FC/hsfail/awk"
# awk 가 아무것도 내지 않고 0 으로 끝나도(빈 글) 통과시키지 않는다
mkdir -p "$FC/emptyawk"
for t in bash cat tr sed grep jq printf; do p=$(command -v "$t") && ln -sf "$p" "$FC/emptyawk/$t"; done
printf '#!/bin/sh\ncat >/dev/null\nexit 0\n' > "$FC/emptyawk/awk" && chmod +x "$FC/emptyawk/awk"
mkdir -p "$FC/latesed"
for t in bash cat tr awk grep jq printf; do p=$(command -v "$t") && ln -sf "$p" "$FC/latesed/$t"; done
printf '#!/bin/sh\n"%s" "$@"\nexit 2\n' "$(command -v sed)" > "$FC/latesed/sed" && chmod +x "$FC/latesed/sed"
# tr · wc 가 실패해도 막는다 — 소문자 변환(gh api) · 마지막 평탄화(gh api --input 판정) · 써 두는 파일 수 세기(13회차 minor 3).
#   인자로 골라 그 호출만 실패시킨다(맨 앞 tr 실패가 먼저 막아 뒤 장치를 못 보는 일이 없게)
mkdir -p "$FC/trlow" "$FC/trflat" "$FC/badwc"
for t in bash cat sed awk grep jq printf wc; do p=$(command -v "$t") && ln -sf "$p" "$FC/trlow/$t" && ln -sf "$p" "$FC/trflat/$t"; done
for t in bash cat tr sed awk grep jq printf; do p=$(command -v "$t") && ln -sf "$p" "$FC/badwc/$t"; done
printf '#!/bin/sh\n[ "$1" = A-Z ] && exit 2\nexec "%s" "$@"\n' "$(command -v tr)" > "$FC/trlow/tr" && chmod +x "$FC/trlow/tr"
printf '#!/bin/sh\ncase "$1" in *n*t*) exit 2 ;; esac\nexec "%s" "$@"\n' "$(command -v tr)" > "$FC/trflat/tr" && chmod +x "$FC/trflat/tr"
printf '#!/bin/sh\nexit 2\n' > "$FC/badwc/wc" && chmod +x "$FC/badwc/wc"
fc() { # fc <이름> <PATH> [명령] — 정상 명령(기본 git status)도 막혀야 한다
  local o j; j=$(jq -n --arg c "${3:-git status}" '{tool_input: {command: $c}}')
  o=$(printf '%s' "$j" | PATH="$2" "$BASH" "$HOOK" 2>/dev/null)
  if [[ "$o" == *'"deny"'* ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); printf '  ⛔ fail-closed 아님: %s\n' "$1"; fi
}
echo "== fail-closed (jq 없음 · jq 실패 · awk 실패 · awk · sed 출력 뒤 실패 · awk 빈 출력 · 스캐너 · heredoc 처리기만 실패 · tr · wc 실패) =="
fc "jq 없음" "$FC/nojq"
fc "awk 실패" "$FC/badawk"
fc "awk 출력 뒤 실패" "$FC/lateawk"
fc "sed 출력 뒤 실패(pipefail)" "$FC/latesed"
fc "awk 빈 출력(종료 0)" "$FC/emptyawk"
fc "jq 실패(종료 134)" "$FC/badjq"
fc "스캐너 awk 만 실패" "$FC/scanfail"
fc "heredoc 처리기 awk 만 실패" "$FC/hsfail"
fc "tr 소문자 변환만 실패(gh api 판정)" "$FC/trlow" "gh api repos/o/r/pulls"
fc "tr 마지막 평탄화만 실패" "$FC/trflat"
fc "wc 실패(써 두는 파일 수 세기)" "$FC/badwc" "$(printf 'cat <<%sEOF%s\nhi\nEOF' "'" "'")"

rm -rf "$APH"
echo
printf 'pass=%d fail=%d\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]] || exit 1
