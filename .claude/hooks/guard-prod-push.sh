#!/usr/bin/env bash
# Block prod-affecting commands. Returns block decision via JSON to Claude Code.
#
# ⭐ 2026-09-02 개정 (프로세스 v2 이식 W0-4). 이전 판은 29줄 substring 매칭이었고
#    문서(CLAUDE.md · rules/claude-code-assets.md)가 «prod push / aws ssm put 차단» 이라
#    기술하는데 실제로는 **둘 다 없었다**. 문서를 믿고 행동하면 안 막히는 상태였다.
#    m8-frontend 의 판정 로직(세그먼트 분리 · 단어 경계 · heredoc 제외 · fail-closed)을
#    이식하되, **prod 차단은 유지**한다 — m8 은 게이트를 Dockerfile 로 옮겨서 해제했지만
#    nomacom 은 Dockerfile 게이트가 없고 prod push = 즉시 CodeDeploy 배포다.
# ⭐ 2026-10-05 개정 (구멍 · 오탐 수정 — QA ⑥ 세 회차).
#    앞단 = 따옴표를 아는 스캐너(awk): 작은따옴표 안은 글자 그대로 · 큰따옴표 · 맨 글자의 $(…) · `…` 는 명령으로 뽑아 따로 본다 ·
#    공백이 든 따옴표 문자열(메시지 · 본문 · 쿼리)은 자리표시 «Q» 로(graphql ref · 머지 mutation 이름이 있으면 표식) ·
#    한 단어 따옴표는 벗긴다(«"HEAD:prod"» → HEAD:prod) · bash -c '…' · eval "…" 의 문자열은 명령으로 다시 본다.
#    그 위에서 명령 경계(; && || | & ( ) 줄바꿈)로 쪼개고, 세그먼트 **어디든** git push · gh api · gh pr · gh workflow 가 있으면 본다
#    (if · then · until · { · ! · timeout · nice · /usr/bin/git 같은 접두에 막히지 않게 — 따옴표 안 글자는 이미 걷혀 오탐이 없다).
#    막는 것: 목적지 prod(bare · heads/ · refs/heads/ · 따옴표 · + · 리다이렉트) · force 3형태 · --mirror · --all · 글롭 · -c remote.*.push ·
#    xargs push · gh api 의 prod ref 쓰기(메서드 대소문자 무관 · 필드 -f/-F 붙여 쓰기 · --input) · 머지(base=prod) · production workflow 실행 ·
#    prod base PR · graphql ref 변경 · 머지 mutation(refId 로는 대상을 못 가려 전부).
# ⭐ 2026-10-05 4회차(QA ⑥): 공백 없이 줄인 graphql · JSON 표식 · bash -o pipefail -c / sh -c -- / watch · flock -c · env -S 문자열 ·
#    따옴표 친 옵션(git push "--force" · gh pr "--base=prod") · \git · HEAD:pr\od · ${X:-prod} · 공백 여럿 · branch=prod · /graphql ·
#    gh run rerun · JSON force:true · docker image push · buildx --push · reset -q --hard · aws --profile … ssm · 주석 끝 «\» ·
#    따옴표 안 «)» · $'…\'…' · ${…#…} · 닫히지 않은 heredoc(되살린다) · 인터프리터 본문의 짝 없는 따옴표 · awk/sed 실패는 fail-closed.
#    못 보는 길(실수 방지용이지 악의적 우회 방어선이 아니다): 변수에 담은 목적지(git push $DST · for t in prod; … "HEAD:$t") ·
#    현재 브랜치가 prod 일 때 목적지 없는 push · «git push origin HEAD» · 원격 upstream · push.default 설정 · gh pr merge ·
#    ID 나 변수로 부르는 workflow · 표준 입력으로 받은 셸 스크립트(echo … | sh) · 이어 붙인 따옴표(bash -c '…'"HEAD:prod") ·
#    파일에서 읽는 쿼리 · JSON(-F query=@file · --input file — 같은 명령 안 heredoc 으로 쓴 파일은 본다).
# ⭐ 5회차(QA ⑥): heredoc 판정을 따옴표 · $(…) · 백틱 · 주석 · $((…)) 를 스택으로 아는 awk 하나로(heredoc_split) · 따옴표 없는 구분자 본문은
#    큰따옴표 문자열처럼(안의 $(…) · 백틱 = 명령) · 같은 명령에서 heredoc 으로 쓴 스크립트를 실행하면 본문도 명령 · 공백 든 JSON 의 prod ref 표식 ·
#    래퍼 확대(trap · su/npx/script -c · tmux · ssh · rebase -x · submodule foreach · git -c alias · bash <<< · orca --text) · push-option 값 걷기 ·
#    긴 옵션 접두(--mirr · --al) · 중괄호 {dev,prod} · 2>&1 · &> 리다이렉트 · REST run 재실행 · subtree push · send-pack · buildx type=registry · docker 하위 명령 자리.
#    더 못 보는 길: 읽어 들인 변수(while read b; … "HEAD:$b") · python 등 다른 언어 코드 안의 셸 문자열(python -c · subprocess) · 따옴표 안 탭 ·
#    $'…' 의 8진수 이스케이프.
#    알고 두는 오탐(안전 쪽): 닫는 줄 없는 heredoc 본문의 명령 글자 · 줄 이음 «\» 뒤 공백 · gh api 판정이 세그먼트를 넘어 섞이는 경우.
# ⭐ 6회차(QA ⑥): 래퍼 판정은 같은 줄 · 단어 경계 · 공백 든 문자열만(앞 줄 gh run watch 가 뒤 줄 따옴표를 숨기던 퇴행) · docker build/builder --push ·
#    compose 는 하위 명령 자리 · workflow 옵션 값 · heredoc 처리기 선형화(바로 출력 · 4KB 창 검색) · 줄 이음 뒤 heredoc 종류 · ssh/fish heredoc.
#    더 못 보는 길: $'…' 의 16진 이스케이프 · REST PR 머지(PUT pulls/N/merge — gh pr merge 와 같다) · case 패턴의 «)» 가 든 $(…).
# ⭐ 7회차(QA ⑥ blocker 1 · major 1 · minor 12): heredoc 받는 쪽은 «<<» 가 든 명령(+ 같은 파이프라인)만 — 앞 명령의 bash x.sh · ssh 가
#    커밋 메시지를 셸 본문으로 만들던 퇴행 · 셸 · 인터프리터 본문은 밖 글과 따로 판정(본문의 don't · it's · 12" 가 닫는 줄 뒤 명령을 숨기지 않게) ·
#    닫는 줄은 bash 처럼 정확히(<<- 면 앞 탭만) · 인터프리터 본문은 셸 기준 짝(이스케이프 따옴표) · 논리 줄 뒤부터 본문(줄 이음 «\») · 한 줄 heredoc 여럿 ·
#    here-string · heredoc 으로 쓴 그 파일을 실행할 때만 본문이 명령(git add . · bash <다른 스크립트> 오탐 — major) · 줄 이음 뒤 bash -c 문자열 ·
#    이음 직후 # · --text= · compose -f/-p · docker-compose · buildx imagetools create · curl 은 쓰는 메서드 · 본문일 때만 · 변수에 담은 graphql mutation ·
#    pipefail(awk 가 일부만 내고 죽어도 차단) · LC_ALL=C(macOS awk 가 한글 한 글자 중간에서 자른 창에 match 하다 죽던 잠복 결함) ·
#    긴 줄 성능(macOS awk 의 substr 는 부를 때마다 원래 글 길이를 다시 센다 — 창 검색 · 큰따옴표 본문 gsub 한 번 · 닫히지 않은 $( 는 같은 단계에서).
#    성능(macOS bash 5): 일상형 230–420KB 1–3.5초 · 따옴표 친 heredoc 2MB 0.5초 안 · 따옴표 없는 heredoc 의 한 줄 JSON 1.7MB 약 4초 ·
#    $(…) 안 따옴표 없는 heredoc 1.9MB 약 8초 · python heredoc 1MB 약 18초 · 꾸민 입력(닫히지 않은 $( 3000개 27KB) 약 11초.
#    기본 훅 제한(600초) 안이지만, 넘치면 Claude Code 는 판정 없이 진행한다(fail-open) — 큰 글은 파일로.
# ⭐ 8회차(QA ⑥ blocker 2 · major 2 · minor 7): heredoc 받는 쪽 판정을 다시 넓혔다 — 7회차의 «<<» 앞 명령만 보던 판정이 2>&1 · &> · ${VAR} ·
#    중괄호에서 셸 본문을 데이터로 놓친 퇴행. 지금: 같은 파이프라인 뒤가 셸이면 셸 · 받는 명령이 데이터 소비자(git · gh · cat · tee · jq …)면 데이터 ·
#    받는 명령이 셸 · 인터프리터면 그것 · 그 밖에는 논리 줄 어디든 셸 낱말이면 셸(dev 판 넓이 — 본문은 따로 판정하니 따옴표가 새지 않는다).
#    heredoc 처리기도 ANSI-C 문자열($ + 작은따옴표 · 안의 \' — 스캐너와 같게) · \bash · "$SHELL" · trap · watch · send-keys · --text 받는 쪽을 안다.
#    따옴표 없는 구분자의 인터프리터 본문은 밖 셸이 $(…) · 백틱을 실행하니 명령으로도 본다 · python · node 본문의 백틱은 글자(ruby · perl · php 만 명령) ·
#    따옴표 친 구분자는 따옴표 안 글자 전부(EOF:1 · END!). 래퍼 앞 글 창 1KB(긴 ssh 옵션) · $SHELL -c · parallel · push 목적지 자리표시({}) ·
#    workflow dispatch 는 ci · design-system-publish 밖 전부(숫자 ID · curl 포함) · curl 의 dispatch · rerun · aws deploy create-deployment ·
#    --input 판정은 ref · 머지 · PR · contents · graphql 엔드포인트만(이슈 댓글 본문 오탐) · «base» 왼쪽 경계(database:) · bash -n 은 실행 아님 ·
#    «.» 실행은 명령 자리만(git add .) · 경로로 적은 workflow 이름. 테스트: sed 출력 뒤 실패(pipefail) · 인터프리터 본문 짝 맞추기 변이 지킴 · 중복 17건 정리.
#    알고 두는 것: | ssh 뒤 따옴표 원격 명령('cat > f')은 읽지 못해 셸 본문으로(안전 쪽 오탐) · bash 5 만 받는 «EOF)» 닫는 줄(이 환경 zsh · bash 3.2 는
#    문법 오류로 거부) · python -c · subprocess 문자열 안 명령(못 보는 길 — 위 5회차).
# ⭐ 9회차(QA ⑥ blocker 1 · major 1 · minor 7): 셸 낱말 경계를 넓혔다 — (bash) · bash; · (cd x && bash) · { …; bash; } · bash>log · /bin/bash ·
#    따옴표 친 짧은 낱말("bash" · "$SHELL")도 받는 쪽 글에 · $(…) 안 heredoc 은 안쪽 명령으로(안쪽이 cat 이면 바깥 bash -c · eval 이 받는다) ·
#    파이프 뒤 남은 글 어디든 셸(| (cd x && bash) · | while … eval · | parallel · | at) · 프로세스 치환 >(bash) · zsh =(…) · gh codespace ssh ·
#    일부만 따옴표 친 구분자(E + 따옴표 OF) · 인터프리터가 스크립트 · -c 를 받으면 heredoc 은 데이터 · 파일 | bash <스크립트> 는 그 파일 실행 아님 ·
#    gh 하위 명령 앞 -R · curl 본문 @- heredoc · graphql PR mutation 의 변수 base · git config remote.*.push · npm exec -c · $(which bash) -c ·
#    ${SHELL:-bash} -c · 써서 실행하는 스크립트(bash -- f · env X=1 /p/f · timeout 60 /p/f). 테스트: 장치를 지키는 변이 케이스(ANSI-C 안 \' 둘 ·
#    열린 따옴표 뒤 본문 · 따옴표 없는 본문의 큰따옴표 · 셸 본문 2단) · awk 빈 출력 fail-closed · 8 · 9회차 탐침 편입 · 라벨 바로잡기.
#    더 못 보는 길: 여러 줄로 연 중괄호 묶음 뒤 } | bash · 치환에 담은 push 목적지(git push origin "$(cat <<EOF … EOF)" — 변수 목적지와 같은 부류).
# ⭐ 10회차(QA ⑥ blocker 3 · major 2 · minor): 써서 실행하는 스크립트 — /bin/bash · /bin/zsh · "$BASH" · 값 받는 옵션(-o pipefail · -euo pipefail) ·
#    2>&1 · f>log · "$PWD/f" · "$(pwd)/f" · eval/bash -c "$(cat f)" · cat >| f · | tee f · | sudo tee f · 스캐너 ${…} 는 안의 따옴표 · 중첩을 안다(heredoc
#    처리기 · bash 와 같게 — 기본값 안 따옴표의 } 로 일찍 닫혀 뒤 명령을 숨기던 것) · 받는 쪽 글에 넣는 따옴표 낱말은 이름 글자만(a;cat 이 경계로
#    읽히지 않게) · $(…) 바깥은 명령 낱말로(--title "ssh" 가 PR 본문을 명령으로 만들던 오탐 — orca --text · tmux send-keys 는 그대로) · 묶음
#    ({ …; } <<EOF)은 첫 명령으로 · 산술식 1 << 3(맨 구분자는 글자로 시작) · jq 실패 · 쓰는 파일 200개 초과는 fail-closed(꾸민 입력이 600초를 넘겨
#    판정 없이 통과하지 않게) · enablePullRequestAutoMerge · git config set remote.*.push · 따옴표 없는 별칭 git -c alias.p=push.
#    더 못 보는 길(dev 판도 놓친다): printf > f 로 쓴 스크립트 · echo … | bash · for 목록 · exec 3<<EOF; bash <&3 · heredoc 을 변수로 읽어 eval ·
#    echo "$(cat <<EOF)" | bash · $(cat <<EOF) 를 명령 자리에 · push-option 안 이스케이프 & · 낱말 중간 줄 이음(pro\ ⏎ d).
set +e
# 파이프라인 어느 단계가 실패해도 실패로(awk 가 일부만 내고 죽으면 통과시키지 않는다 — fail-closed)
set -o pipefail
# 글자는 바이트로 다룬다 — macOS awk(20200816)는 substr · index 가 바이트 단위인데 match 는 넓은 글자로 바꿔 비교해서, 창 검색이
#   한글 한 글자 중간을 자르면 «towc: multibyte conversion failure» 로 죽는다(4KB 를 넘는 한글 입력 — 7회차 수정 중 발견). awk 마다 같게
export LC_ALL=C

input=$(cat)

# ⭐ fail-closed — jq 가 없으면 «통과» 가 아니라 «차단» 이다.
# jq 는 입력 파싱과 block() 출력 양쪽의 하드 의존이다. 없으면 cmd 가 빈 문자열이 되어
# 모든 명령이 조용히 통과한다. 안전장치가 조용히 사라지는 것보다 시끄럽게 막히는 편이 낫다.
if ! command -v jq >/dev/null 2>&1; then
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"guard 훅의 의존성(jq)이 없어 판정할 수 없습니다 — fail-closed 로 차단합니다. `brew install jq` 후 재시도하세요."}}'
  exit 0
fi

cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null) || {
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"guard 훅이 입력을 읽지 못했습니다(jq 실패) — fail-closed 로 차단합니다."}}'
  exit 0
}

[[ -z "$cmd" ]] && exit 0

block() {
  jq -n --arg r "$1" '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": $r}}'
  exit 0
}

# ⭐ heredoc 본문은 «데이터» 라 판정에서 뺀다 — 커밋 메시지 · 문서의 명령 «예시» 가 실행으로 오인되지 않게.
#   셸이 먹는 본문(받는 쪽이 bash · sh · ssh · eval · source · | bash)은 명령이다 — 밖 글과 **따로** 판정한다(judge_cmd 가 다시 부른다).
#   다른 인터프리터(python · node …) 본문은 줄마다 셸 기준으로 짝이 안 맞는 따옴표를 지워 따로 본다(백틱 · $(…) 는 셸이 실행한다).
#   gh api 입력 등 데이터 본문은 걷어 bodies 로 넘긴다.
# ⭐ 2026-10-05 5회차(QA ⑥): 줄 단위 bash 판정 → awk 하나로. 줄을 넘는 따옴표 · 주석 · $((…)) 상태를 알고 «<<» 를 판정한다
#   (여러 줄 커밋 메시지 · 주석 안 «<<EOF» 글자가 뒤 줄을 삼키지 않게) · 따옴표 없는 구분자(<<EOF)의 본문은 큰따옴표 문자열처럼
#   다룬다 — 안의 $(…) · 백틱은 bash 가 실행하므로 명령으로 본다 · 구분자 줄이 끝내 없으면 heredoc 이 아니었다 — 되살린다.
#   줄마다 sed 를 띄우지 않는다(큰 입력 성능). 인터프리터 이름은 단어 경계로(evaluation.md · node-22 오탐 0).
# ⭐ 7회차(QA ⑥ B1 · M1 · minor 2 · 3): 받는 쪽은 «<<» 가 든 명령만 본다(앞 명령의 bash x.sh · ssh 가 커밋 메시지를 셸 본문으로 만들지 않게) ·
#   셸 · 인터프리터 본문은 밖 글과 따로(본문의 짝 없는 따옴표 — don't · it's · 12" — 가 닫는 줄 뒤 명령을 숨기지 않게) ·
#   닫는 줄은 bash 처럼 정확히(<<- 면 앞 탭만 지운다 — 들여 쓴 EOF 는 닫지 않는다) · 논리 줄(줄 이음 «\» · 열린 따옴표)이 끝난 뒤부터 본문 ·
#   한 줄의 heredoc 여럿은 차례로 · here-string «<<<» 는 heredoc 이 아니다 · heredoc 으로 쓰는 파일 이름을 낸다(그 파일을 실행할 때만 본문이 명령).
#   $1 = text(판정할 밖 글) | bodies(데이터 본문 — gh api --input · -F x=@- 판정용) | shell · interp(셸 · 인터프리터 본문, \004 로 나눔) |
#        written(쓰는 파일 \001 데이터 본문 \004)
heredoc_split() {
  awk -v mode="$1" '
  # 받는 쪽 판정(8회차 — 좁게 보던 7회차 판정이 2>&1 · ${VAR} · 중괄호에서 셸 본문을 데이터로 놓쳤다): 본문은 이제 밖 글과 따로 판정하므로
  #   넓게 봐도 따옴표가 새지 않는다. ① 같은 파이프라인 뒤가 셸 · 인터프리터면 그것 ② 받는 명령(리다이렉트 · ${…} · 중괄호를 걷고 sudo · env
  #   접두를 건너뛴 첫 낱말)이 데이터 소비자(git · gh · cat · tee · jq …)면 데이터 ③ 받는 명령이 셸 · 인터프리터면 그것 ④ 그 밖에는 논리 줄
  #   어디든 셸 낱말이 있으면 셸 본문(dev 판과 같은 넓이 — dev 보다 덜 막는 경우가 없게)
  # 셸 낱말 — 앞뒤가 이름 글자(영숫자 _ . -)가 아니면(bash) · bash; · (bash · bash> · /bin/bash — 9회차 B1). run.sh · push · ssh 안의 sh 는 아니다
  function isshell(t) { return t ~ /(^|[^A-Za-z0-9_.-])(bash|sh|zsh|dash|ksh|fish|ssh|eval|source|trap|watch|send-keys|\$SHELL|\$\{SHELL[^}]*\}|--text)([^A-Za-z0-9_.-]|$)/ }
  function isinterp(t) { return t ~ /(^|[^A-Za-z0-9_.-])(python[0-9.]*|node|nodejs|deno|bun|ruby|perl|php|osascript)([^A-Za-z0-9_.-]|$)/ }
  # 인터프리터 종류 — 2 백틱이 셸 명령인 언어(ruby · perl · php) · 4 그 밖(python · node … — 백틱은 글자)
  function ik(t) { return (t ~ /(^|[^A-Za-z0-9_.-])(ruby|perl|php)([^A-Za-z0-9_.-]|$)/) ? 2 : 4 }
  # 인터프리터가 스크립트 파일 · -c/-e/-m 코드를 받으면 표준 입력(heredoc)은 데이터다(python3 scripts/x.py <<EOF — 9회차 m1)
  function iarg(seg, w,   a, n, k, x, seen) {
    n = split(seg, a, /[ \t]+/); seen = 0
    for (k = 1; k <= n; k++) {
      x = a[k]
      if (!seen) { sub(/^\\/, "", x); sub(/^.*\//, "", x); if (x == w) seen = 1; continue }
      if (x == "" || x == "R" || x == "V") continue
      if (x ~ /^(<<|<<<|>|>>|<|[0-9]>)/) { if (x ~ /^(>|>>|<|[0-9]>)$/) k++; continue }
      if (x == "-") return 0
      if (x ~ /^-[a-zA-Z]*[cem]$/) return 1
      if (x ~ /^-/) continue
      return 1
    }
    return 0
  }
  # 리다이렉트(2>&1 · &> · >&2) · ${…} 는 명령 경계가 아니다
  function nrm(t) { gsub(/[0-9]*>&[0-9]*-?|&>>?|<&[0-9]*-?/, " R ", t); gsub(/\$\{[^}]*\}/, " V ", t); return t }
  function lastseg(t) {
    gsub(/(^|[ \t])[{}]([ \t]|$)/, " ; ", t)      # 낱말로 선 중괄호만 묶음 경계({ cmd; }) — {a,b} 확장은 아니다
    while (match(t, /[;&|()]/)) t = substr(t, RSTART + 1)
    return t
  }
  # 받는 명령의 첫 낱말 — 대입 · ! · sudo/env/command/time/nice/nohup/exec 접두(그 옵션까지)는 건너뛴다 · 경로 · 앞 «\» 는 뗀다
  function recv(seg,   a, n, k, w) {
    n = split(seg, a, /[ \t]+/); k = 1
    while (k <= n) {
      w = a[k]
      if (w == "" || w == "!" || w ~ /^[A-Za-z_][A-Za-z0-9_]*=/) { k++; continue }
      sub(/^\\/, "", w); sub(/^.*\//, "", w)
      if (w ~ /^(sudo|doas|env|command|time|nice|nohup|exec)$/) { k++; while (k <= n && a[k] ~ /^-/) k++; continue }
      return w
    }
    return ""
  }
  # 같은 파이프라인의 뒤 명령(| bash · } | bash · ) | bash · 2>&1 | bash) — 셸 0 · 인터프리터 2/4 · 없으면 -1. 줄 끝 «|» 는 셸로 본다(받는 쪽이 본문 뒤 줄).
  #   파이프 뒤 남은 글 어디든 셸 낱말이면 셸(| (cd x && bash) · | while read c; do eval "$c"; done — 9회차 B1 · 안전 쪽)
  function pipek(p) {
    while (match(p, /\|/)) {
      if (substr(p, RSTART + 1, 1) == "|") { p = substr(p, RSTART + 2); continue }
      p = substr(p, RSTART + 1); sub(/^&/, "", p)
      if (p !~ /[^ \t]/) return 0
      if (isshell(p) || p ~ /(^|[^A-Za-z0-9_.-])(parallel|at|batch)([^A-Za-z0-9_.-]|$)/) return 0   # | parallel · | at now 도 줄을 명령으로 실행한다
      if (isinterp(p)) return ik(p)
      return -1
    }
    return -1
  }
  # 0 셸 본문 · 1 데이터(따옴표 친 구분자) · 2 · 4 인터프리터 본문 · 3 데이터(따옴표 없는 구분자 — 안의 $(…) · 백틱은 밖 셸이 실행한다)
  #   outer = heredoc 이 $(…) 안이면 그 $( 앞 글 — 안쪽 받는 명령으로 정하되, 안쪽이 데이터 소비자(cat)면 바깥(bash -c · eval)이 받는다(9회차 B1)
  function kindof(pre, post, pq, outer,   k, p1, w, all, seg) {
    pre = nrm(pre); post = nrm(post); outer = nrm(outer)
    all = outer " " pre " " post
    k = pipek(post); if (k >= 0) return k
    if (all ~ /PSUB/ && isshell(all)) return 0                   # 프로세스 치환 >(bash) · =(…)
    p1 = post; if (match(p1, /[;&|()]/)) p1 = substr(p1, 1, RSTART - 1)
    seg = lastseg(pre) " " p1
    # 묶음({ …; } <<EOF · ( … ) <<EOF)이 받으면 표준 입력은 묶음의 첫 명령이 먹는다 — 그 명령으로(10회차 N03)
    if (lastseg(pre) !~ /[^ \t]/ && pre ~ /[})][ \t]*$/ && match(pre, /[({][^({]*$/)) {
      seg = substr(pre, RSTART + 1); if (match(seg, /[;&|]/)) seg = substr(seg, 1, RSTART - 1)
    }
    w = recv(seg)
    if (w ~ /^(git|gh|cat|tee|jq|yq|psql|mysql|sqlite3|wc|grep|egrep|head|tail|sort|uniq|base64|xxd|pbcopy|diff|tr|cut|column|curl|openssl|gpg)$/) {
      if (outer != "") { k = recv(lastseg(outer)); if (k == "." || isshell(k) || lastseg(outer) ~ /(^|[^A-Za-z0-9_.-])(--text|send-keys)([^A-Za-z0-9_.=-]|=|$)/) return 0 }   # 바깥 명령 낱말 · 다른 터미널에 쳐 넣는 것(orca --text · tmux send-keys)
      if (w == "gh" && seg ~ /(codespace|cs)[ \t]+ssh/) return 0   # gh codespace ssh = 원격 셸
      return pq ? 1 : 3
    }
    if (w == "." || isshell(w)) return 0
    if (isinterp(w)) return iarg(seg, w) ? (pq ? 1 : 3) : ik(w)
    if (isshell(all)) return 0
    if (isinterp(all)) return ik(all)
    return pq ? 1 : 3
  }
  # heredoc 으로 쓰는 파일(cat > f <<EOF · cat <<EOF > f · tee f <<EOF) — 시작 줄의 «<<» 가 든 명령에서(따옴표는 벗긴다)
  function target(l, p,   a, t, f, b) {
    gsub(/>\|/, ">", l)                                           # >| (noclobber 무시) 는 파이프가 아니다
    a = substr(l, 1, p - 1); while (match(a, /[;&|]/)) a = substr(a, RSTART + 1)
    b = substr(l, p + 2, 1024)
    # 같은 파이프라인 뒤의 tee 파일(cat <<EOF | tee f · | sudo tee -a f)
    if (match(b, /\|[ \t]*(sudo[ \t]+)?tee([ \t]+-[^ \t]+)*[ \t]+("[^"]*"|\047[^\047]*\047|[^ \t;&|<>()"\047]+)/)) {
      f = substr(b, RSTART, RLENGTH); sub(/^.*tee([ \t]+-[^ \t]+)*[ \t]+/, "", f); gsub(/["\047]/, "", f); return f
    }
    t = b; if (match(t, /[;&|]/)) t = substr(t, 1, RSTART - 1)
    t = a " " t
    while (match(t, />>?\|?[ \t]*("[^"]*"|\047[^\047]*\047|[^ \t;&|<>()"\047]+)/)) {
      f = substr(t, RSTART, RLENGTH); t = substr(t, RSTART + RLENGTH)
      sub(/^>>?\|?[ \t]*/, "", f); gsub(/["\047]/, "", f)
      if (f != "/dev/null") return f
    }
    a = a " "
    if (match(a, /(^|[ \t\/])tee([ \t]+-[^ \t]+)*[ \t]+("[^"]*"|\047[^\047]*\047|[^ \t;&|<>()"\047]+)/)) {
      f = substr(a, RSTART, RLENGTH); sub(/^.*tee([ \t]+-[^ \t]+)*[ \t]+/, "", f); gsub(/["\047]/, "", f); return f
    }
    return ""
  }
  # 셸 기준으로 줄 안에서 따옴표가 닫히는가 — 이스케이프 · 주석을 안다(개수만 세면 x = 짝수 개 이스케이프 따옴표를 놓친다 — 7회차 B1)
  function shopen(l,   n, k, c, q) {
    n = length(l); q = 0
    for (k = 1; k <= n; k++) {
      c = substr(l, k, 1)
      if (q == 1) { if (c == "\047") q = 0; continue }
      if (c == "\\") { k++; continue }
      if (q == 2) { if (c == "\"") q = 0; continue }
      if (q == 3) { if (c == "`") q = 0; continue }
      if (c == "#" && (k == 1 || substr(l, k - 1, 1) ~ /[ \t;&|(]/)) break
      if (c == "\047") q = 1; else if (c == "\"") q = 2; else if (c == "`") q = 3
    }
    return q
  }
  # 인터프리터 본문 한 줄 — 셸 기준으로 짝이 안 맞으면 문자열을 Q 로 걷고 남은 따옴표 · 백틱을 지운다(글자는 남는다)
  function neut(l, kd) {
    if (kd == 4) gsub(/`[^`]*`/, " Q ", l)
    if ((index(l, SQ) || index(l, "\"") || index(l, "`")) && shopen(l)) {
      gsub(RE_DQS, " Q ", l); gsub(RE_SQS, " Q ", l); gsub(/["\047`]/, "", l)
    }
    return l
  }
  function qclose(j,   m) {
    if (qn[sp + 1] != NR || st[sp] == "D" || st[sp] == "Q" || st[sp] == "A") return
    m = substr(line, qb[sp + 1], j - qb[sp + 1])
    if (m != "" && length(m) <= 64 && (m ~ /^[A-Za-z0-9_.\/$@%+:=,-]+$/ || m ~ /^\$\{[A-Za-z_][A-Za-z0-9_]*\}$/)) addu(" " m " ")   # 셸 구분 글자가 든 것은 넣지 않는다(10회차 B3)
  }
  function out(x) { if (mode == "text") printf "%s", x }
  function chunk(x) { gsub(/[\001\004]/, " ", x); printf "%s\n", x }
  # 긴 줄에서 i 부터 정규식 · 글자를 찾는다 — 작은 창부터 키워 간다(substr(line, i) 로 나머지 전부를 복사하지 않게 ·
  #   특수 글자가 촘촘한 큰 JSON 에서 매번 4KB 를 복사하지 않게). 여러 글자 찾기는 창을 겹친다(경계에 걸친 «))» 를 놓치지 않게)
  function findre(l, i, n, re,   w, z) {
    z = 64
    while (i <= n) { w = substr(l, i, z); if (match(w, re)) return i + RSTART - 1; i += z; if (z < 4096) z += z }
    return 0
  }
  function findch(l, i, n, ch,   w, j, z, m) {
    z = 64; m = length(ch) - 1
    while (i <= n) { w = substr(l, i, z + m); j = index(w, ch); if (j) return i + j - 1; i += z; if (z < 4096) z += z }
    return 0
  }
  # 받는 쪽 판정용 글(따옴표 밖 글자만) — u 는 끝 2KB 만 · pv 는 첫 heredoc 뒤 글(같은 파이프라인의 받는 쪽 판정용)
  function addu(x) {
    u = u x; if (length(u) > 4096) u = substr(u, length(u) - 2047)
    if (np && length(pv) < 8192) pv = pv x
  }
  # 따옴표 없는 heredoc 본문 한 줄 → 큰따옴표 문자열 안 글자로 낸다 — 본문의 큰따옴표는 글자라 작은따옴표로(큰따옴표 안에서 작은따옴표는 글자 —
  #   스캐너가 보기에 같은 뜻) · \$ \` \\ 는 그대로 두면 스캐너도 이스케이프로 본다. gsub 한 번(긴 줄에서 substr 를 되풀이하지 않게 —
  #   macOS awk 의 substr 는 부를 때마다 원래 글 길이를 다시 센다)
  function dqline(l) { gsub(/"/, SQ, l); return l }
  function openq() { indoc = 1; kind = qk[hq]; delim = qd[hq]; dstrip = qs[hq]; nb = 0 }
  function closeq(   k, x) {
    if ((kind == 3 || ((kind == 2 || kind == 4) && !qq[hq])) && mode == "text") { out("\""); for (k = 1; k <= nb; k++) out(dqline(rawl[k]) "\n"); out("\"\n") }
    if (kind == 1 || kind == 3) {
      if (mode == "bodies") for (k = 1; k <= nb; k++) printf "%s\n", rawl[k]
      if (mode == "written" && qf[hq] != "") {
        x = qf[hq]; gsub(/[\001\004]/, " ", x); printf "%s\001", x
        for (k = 1; k <= nb; k++) chunk(rawl[k])
        printf "\004"
      }
    }
    if (kind == 0 && mode == "shell") { for (k = 1; k <= nb; k++) chunk(rawl[k]); printf "\004" }
    if ((kind == 2 || kind == 4) && mode == "interp") { for (k = 1; k <= nb; k++) chunk(neut(rawl[k], kind)); printf "\004" }
    nb = 0; hq++
    if (hq <= np) openq(); else { indoc = 0; np = 0; pv = "" }
  }
  BEGIN {
    sp = 1; st[1] = "S"; indoc = 0; nb = 0; carry = ""; np = 0; pv = ""
    SQ = sprintf("%c", 39)
    RE_DQS = "\"([^\"\\\\]|\\\\.)*\""
    RE_SQS = SQ "([^" SQ "\\\\]|\\\\.)*" SQ
  }
  {
    line = $0; sub(/\r$/, "", line)
    if (indoc) {
      t = line; if (dstrip) sub(/^\t+/, "", t)
      if (t == delim) closeq(); else rawl[++nb] = line
      next
    }
    # 따옴표 · 주석 · $(…) · 백틱 상태를 스택으로 이어 가며 «<<» 를 찾는다 — S 셸 · C $(…) 안(셸) · B 백틱 안(셸) · D 큰따옴표 · Q 작은따옴표.
    #   "$(cat <<EOF … EOF )" 처럼 큰따옴표 안 $(…) 의 heredoc 은 진짜 heredoc 이다(bash 가 $(…) 안을 셸로 읽는다)
    #   줄 이음(«\» 로 끝난 줄)은 같은 명령이다 — 앞 줄의 글을 이어 받아 받는 쪽을 정한다(bash \ ⏎ -s <<EOF) ·
    #   이음 직후의 «#» 는 앞 글자에 붙은 글자다(주석이 아니다 — 7회차 minor 9)
    if (carry != "") { u = carry; pc = cprev } else { u = ""; pc = " " }
    carry = ""; n = length(line); i = 1; cont = 0
    while (i <= n) {
      t = st[sp]
      if (t == "Q") { j = findch(line, i, n, "\047"); if (j == 0) { i = n + 1; break } if (sp > 1) sp--; qclose(j); i = j + 1; continue }
      # ANSI-C 문자열($ + 작은따옴표) — 안의 백슬래시는 다음 글자를 이스케이프한다(스캐너와 같게 — 8회차 B1)
      if (t == "A") {
        j = findre(line, i, n, "[\\\\\047]"); if (j == 0) { i = n + 1; break }
        if (substr(line, j, 1) == "\\") { i = j + 2; continue }
        if (sp > 1) sp--; i = j + 1; continue
      }
      if (t == "D") {
        j = findre(line, i, n, "[\\\\\"$`]"); if (j == 0) { i = n + 1; break }
        i = j; c = substr(line, i, 1)
        if (c == "\\") { i += 2; continue }
        if (c == "\"") { if (sp > 1) sp--; qclose(i); i++; continue }
        if (c == "`") { st[++sp] = "B"; i++; continue }
        if (substr(line, i, 2) == "$(" && substr(line, i, 3) != "$((") { st[++sp] = "C"; cd[sp] = 0; cu[sp] = length(u); addu(" "); i += 2; continue }
        i++; continue
      }
      j = findre(line, i, n, "[\\\\\047\"`#$<()]")
      if (j == 0) { addu(substr(line, i, 4096)); break }
      if (j > i) { addu(substr(line, i, j - i)); i = j }
      c = substr(line, i, 1)
      if (c == "\\") {
        if (i == n) { cont = 1; addu(" "); i++; continue }
        x = substr(line, i + 1, 1); addu(x ~ /[[:alnum:]_]/ ? x : substr(line, i, 2)); i += 2; continue   # \bash = bash
      }
      if (c == "\047") { st[++sp] = "Q"; qb[sp] = i + 1; qn[sp] = NR; i++; continue }
      if (c == "\"") {
        st[++sp] = "D"; qb[sp] = i + 1; qn[sp] = NR; i++; continue
      }
      if (c == "`") { if (t == "B") { if (sp > 1) sp-- } else st[++sp] = "B"; addu(" "); i++; continue }
      if (c == "#") {
        p = (i == 1) ? pc : substr(line, i - 1, 1)
        if (p ~ /[ \t;&|(]/) break
        addu(c); i++; continue
      }
      # «<(» · «>(» · zsh «=(» (프로세스 치환)의 괄호는 명령 경계가 아니다(bash <(cat <<EOF) 의 받는 쪽이 bash 로 보이게 · tee >(bash) 는 셸)
      if (c == "(") { if (t == "C") cd[sp]++; p = (i > 1) ? substr(line, i - 1, 1) : ""; addu((p == "<" || p == ">" || p == "=") ? " PSUB " : c); i++; continue }
      if (c == ")") {
        if (t == "C") { if (cd[sp] == 0) { if (sp > 1) sp--; addu(" "); i++; continue } cd[sp]-- }
        addu(c); i++; continue
      }
      if (c == "$") {
        if (substr(line, i, 3) == "$((") { j = findch(line, i, n, "))"); if (j) { addu(" ARITH "); i = j + 2; continue } }
        if (substr(line, i, 2) == "$" SQ) { st[++sp] = "A"; i += 2; continue }
        if (substr(line, i, 2) == "$(") { st[++sp] = "C"; cd[sp] = 0; cu[sp] = length(u); addu(" "); i += 2; continue }
        addu(c); i++; continue
      }
      # c == "<" — here-string «<<<» 은 세 글자를 한 번에 건너뛴다(둘째 «<» 부터 heredoc 으로 읽지 않게 — 7회차 minor 3)
      if (substr(line, i, 3) == "<<<") { addu(" <<< "); i += 3; continue }
      if (substr(line, i, 2) == "<<") {
        rest = substr(line, i + 2, 512)
        # 구분자 — 따옴표 친 것은 따옴표 안 글자 전부(EOF:1 · END!), 맨 것은 메타 글자 전까지, 이어 붙인 조각(E + 따옴표 OF)은 이어서
        if (match(rest, /^-?[ \t]*(\047[^\047]*\047|"[^"]*"|\\?[A-Za-z_][^ \t;&|<>()"\047\\$`]*)(\047[^\047]*\047|"[^"]*"|[^ \t;&|<>()"\047\\$`]+)*/)) {
          tok = substr(rest, 1, RLENGTH)
          d = tok; sub(/^-?[ \t]*/, "", d); gsub(/["\047\\]/, "", d)   # 일부만 따옴표 친 구분자(E + 따옴표 OF = EOF)
          np++; qd[np] = d; qq[np] = (tok ~ /["\047\\]/); qs[np] = (tok ~ /^-/); qoff[np] = length(pv)
          if (st[sp] == "C" && cu[sp] <= length(u)) { qout[np] = substr(u, 1, cu[sp]); qpre[np] = substr(u, cu[sp] + 1) } else { qout[np] = ""; qpre[np] = u }
          qf[np] = (mode == "written") ? target(line, i) : ""
          addu(" << "); i += 2 + RLENGTH; continue
        }
      }
      addu(c); i++
    }
    out(line "\n")
    t = st[sp]
    # 논리 줄이 끝나야 본문이 시작된다 — 줄 이음 · 열린 따옴표면 다음 줄로 이어 간다(bash 와 같다 — 7회차 minor 2)
    if (cont || t == "Q" || t == "D" || t == "A") {
      carry = (u == "") ? " " : u
      cprev = cont ? substr(line, n - 1, 1) : " "; if (cprev == "") cprev = " "
    } else if (np) {
      for (k = 1; k <= np; k++) qk[k] = kindof(qpre[k], substr(pv, qoff[k] + 1), qq[k], qout[k])
      hq = 1; openq()
    }
  }
  END {
    if (indoc) for (k = 1; k <= nb; k++) out(rawl[k] "\n")   # 닫는 줄이 끝내 없었다 = heredoc 이 아니었다 — 되살린다(명령으로 본다)
  }'
}

# 따옴표를 아는 스캐너 — 정리한 글 다음에 뽑아 낸 명령($(…) · `…` · bash -c · eval)을 줄로 잇는다
scan_shell() {
  awk '
  # 긴 글에서 i 부터 정규식 · 글자를 찾는다 — 작은 창부터 키워 간다(substr(s, i) 로 나머지 전부를 복사하지 않게 · 촘촘한 큰 JSON 에서
  #   매번 4KB 를 복사하지 않게). 여러 글자 찾기는 창을 겹친다
  function findre(l, i, n, re,   w, z) {
    z = 64
    while (i <= n) { w = substr(l, i, z); if (match(w, re)) return i + RSTART - 1; i += z; if (z < 4096) z += z }
    return 0
  }
  function findch(l, i, n, ch,   w, j, z, m) {
    z = 64; m = length(ch) - 1
    while (i <= n) { w = substr(l, i, z + m); j = index(w, ch); if (j) return i + j - 1; i += z; if (z < 4096) z += z }
    return 0
  }
  # 앞 글의 끝 256자(out 은 이어 붙이는 비용을 줄이려 큰 조각 + 작은 조각 둘로 쌓는다)
  function otail(a, b,   L) { if (length(b) >= 1024) return b; L = length(a); return ((L > 1024) ? substr(a, L - 1023) : a) b }
  # ${…} 의 짝 «}» — 안의 따옴표(기본값 안 따옴표 속 } 에서 닫지 않게) · 백슬래시는 건너뛰고 ${ 중첩을 센다. 없으면 0
  function matchbrace(s, p,   n, k, lvl, ch, j) {
    n = length(s); k = p; lvl = 1
    while (k <= n) {
      k = findre(s, k, n, "[\\\\\047\"$}]"); if (k == 0) return 0
      ch = substr(s, k, 1)
      if (ch == "\\") { k += 2; continue }
      if (ch == "\047") { j = findch(s, k + 1, n, "\047"); if (j == 0) return 0; k = j + 1; continue }
      if (ch == "\"") {
        k++
        while (k <= n) { k = findre(s, k, n, "[\\\\\"]"); if (k == 0) return 0; if (substr(s, k, 1) == "\\") { k += 2; continue } break }
        k++; continue
      }
      if (ch == "$") { if (substr(s, k + 1, 1) == "{") { lvl++; k += 2 } else k++; continue }
      lvl--; if (lvl == 0) return k
      k++
    }
    return 0
  }
  # $(…) 의 짝 «)» — 안쪽 따옴표 · 백슬래시는 건너뛴다(따옴표 안의 «)» 로 일찍 닫히지 않게)
  function matchparen(s, p,   lvl, k, ch, n, j) {
    lvl = 0; n = length(s); k = p
    while (k <= n) {
      k = findre(s, k, n, "[\\\\\047\"()]"); if (k == 0) return n + 1
      ch = substr(s, k, 1)
      if (ch == "\\") { k += 2; continue }
      if (ch == "\047") { j = findch(s, k + 1, n, "\047"); if (j == 0) return n + 1; k = j + 1; continue }
      if (ch == "\"") {
        k++
        while (k <= n) { k = findre(s, k, n, "[\\\\\"]"); if (k == 0) return n + 1; if (substr(s, k, 1) == "\\") { k += 2; continue } break }
        k++; continue
      }
      if (ch == "(") lvl++
      else { lvl--; if (lvl == 0) return k }
      k++
    }
    return n + 1
  }
  function quoted(buf, before, depth,   t, mid, r, gm, tail, L, j) {
    # 앞 글은 끝 1KB 만 본다 — 따옴표마다 앞 글 전체에 정규식을 돌리면 큰 입력에서 제곱으로 느려진다(긴 ssh 옵션 뒤 문자열 — 8회차 M1)
    L = length(before); tail = (L > 1024) ? substr(before, L - 1023) : before
    # 래퍼 판정은 같은 줄에서만(앞 줄의 gh run watch · ssh 가 뒤 줄 따옴표를 숨기지 않게 — QA ⑥ 6회차 B1)
    while ((j = index(tail, "\n")) > 0) tail = substr(tail, j + 1)
    gsub(/\001/, " ", tail)   # 줄 이음 뒤 문자열(bash -c 다음 줄의 문자열 — 7회차 minor 1)
    # 문자열을 명령으로 받는 것 — bash/sh/fish -c(앞에 -o pipefail · -O extglob · --login · 묶음 옵션, 뒤에 -x · -- 가 껴도) · eval · trap ·
    #   watch · flock/su/npx/script … -c · env -S · tmux · ssh <호스트> · git rebase -x/--exec · git submodule foreach ·
    #   orca … --text(다른 터미널에 쳐 넣는다). 따로 뽑아 다시 본다(5단까지)
    if (depth < 6 && buf ~ /[[:space:]]/ && tail ~ /(^|[[:space:];&|(!{\/])((bash|sh|zsh|dash|ksh|fish|SUBST|\$SHELL|\$\{SHELL[^}]*\})([[:space:]]+[^[:space:];&|]+)*[[:space:]]+-[[:alnum:]]*c[[:alnum:]]*([[:space:]]+-[^[:space:];&|]*)*|eval|trap|watch([[:space:]]+[^[:space:];&|]+)*|(flock|su|npx|npm|script)([[:space:]]+[^[:space:];&|]+)*[[:space:]]+-c|env([[:space:]]+[^[:space:];&|]+)*[[:space:]]+-S|tmux([[:space:]]+[^[:space:];&|]+)*|parallel([[:space:]]+[^[:space:];&|]+)*|ssh([[:space:]]+[^[:space:];&|]+)+|git([[:space:]]+[^[:space:];&|]+)*[[:space:]]+(-x|--exec|foreach)|orca([[:space:]]+[^[:space:];&|]+)*[[:space:]]+--text=?|(bash|sh|zsh|dash|ksh)([[:space:]]+[^[:space:];&|]+)*[[:space:]]*<<<)[[:space:]]*$/) {
      r = scan(buf, depth + 1); INNERS = INNERS "\n" r
      return " SUBST "
    }
    # git -c alias.<이름>=<git 하위 명령> — 별칭 본문은 git 명령이다(별칭 값에 push … prod 를 넣고 별칭을 부르는 형태)
    if (depth < 6 && tail ~ /alias\.[^[:space:]=]+=$/) {
      r = scan((buf ~ /^!/) ? substr(buf, 2) : "git " buf, depth + 1); INNERS = INNERS "\n" r
      return "SUBST "
    }
    # 표식을 먼저 단다 — 공백 없이 줄인(minified) graphql · JSON 도 잡히게(QA ⑥ 4회차 M1)
    gm = ""
    if (buf ~ /(createRef|updateRef|updateRefs|deleteRef|mergeBranch|mergePullRequest|createCommitOnBranch|enablePullRequestAutoMerge)/) gm = gm " GQLMUT"
    if (buf ~ /(createPullRequest|updatePullRequest)/ && buf ~ /(baseRefName|base)[^[:alnum:]]*(refs\/heads\/)?prod([^[:alnum:]_-]|$)/) gm = gm " GQLPRBASE"
    if (buf ~ /(createPullRequest|updatePullRequest)/ && gm !~ /GQLPRBASE/) gm = gm " GQLPR"   # base 를 변수로(-f b=prod) 줄 때 — gh api 판정이 필드와 대조
    if (buf ~ /force"?[[:space:]]*:[[:space:]]*true/) gm = gm " JSONFORCE"
    # 공백 든 JSON · jq 식 안의 prod ref(--input 판정용 — 따옴표 문자열은 Q 로 걷혀 글자가 안 보인다)
    if (buf ~ /refs\/heads\/prod([^[:alnum:]_.-]|$)/ || buf ~ /(^|[^[:alnum:]_])(ref|base|branch|new_name)"?[[:space:]]*[:=][[:space:]]*"?(refs\/heads\/)?prod([^[:alnum:]_.-]|$)/) gm = gm " PRODREF"
    mid = (tail ~ /[^[:space:]]$/)
    # 한 단어는 따옴표만 벗긴다(refspec · 브랜치 이름) — 셸 구분 글자(괄호 · ; & | < > 백틱)가 든 것은 값(쿼리 · JSON)이라 Q 로
    #   1KB 넘는 한 단어는 refspec · 이름일 수 없다 — Q 로(큰 입력에서 뒤 정규식이 느려지지 않게)
    if (buf !~ /[[:space:]()<>;&|`]/ && length(buf) <= 1024) {
      if (buf !~ /^-/) return (gm == "" ? buf : buf gm " ")
      # «-» 로 시작하는 한 단어 = 따옴표 친 옵션일 수도 값일 수도(--body "-Bprod") — «Q» 를 붙여 남긴다(git push · gh pr 판정이 따로 본다)
      if (!mid && length(buf) <= 64) return "Q" buf gm " "
    }
    # 단어 중간의 따옴표(core.sshCommand="ssh -i k" · user.name="John Koo")는 공백 없이 — 한 단어로 남아야 옵션 값으로 걷힌다
    t = (mid ? "Q" : " Q") gm
    return (mid && gm == "") ? t : t " "
  }
  function scan(s, depth,   out, op, i, n, c, j, k, buf, bp, inner, r, closed, p) {
    out = ""; op = ""; n = length(s); i = 1
    while (i <= n) {
      if (length(op) > 8192) { out = out op; op = "" }
      # 특수 글자(\ # $ 따옴표 백틱) 전까지는 한 번에 붙인다 — 한 글자씩 이으면 큰 입력에서 느리다
      j = findre(s, i, n, "[\\\\#$\047\"`]")
      if (j == 0) { op = op substr(s, i); break }
      if (j > i) { op = op substr(s, i, j - i); i = j }
      if (i > n) break
      c = substr(s, i, 1)
      # 따옴표 밖 «\글자» 는 그 글자 — 영숫자면 백슬래시를 뺀다(«\git push» · «HEAD:pr\od» 가 그대로 보이게)
      if (c == "\\") {
        if (substr(s, i + 1, 1) ~ /[[:alnum:]_]/) op = op substr(s, i + 1, 1)
        else op = op substr(s, i, 2)
        i += 2; continue
      }
      # 주석 — 따옴표 밖에서 단어 첫머리의 # 부터 줄 끝까지(줄바꿈은 남긴다). 줄 이음 표식(\001)에서도 끝난다 —
      #   bash 는 주석 끝의 «\» 로 다음 줄을 잇지 않는다(«# C:\» 다음 줄의 push 가 주석에 먹히지 않게).
      #   이음 바로 뒤의 # 는 이음 앞 글자로 판정한다(a\ ⏎ #; … 는 a# 라 주석이 아니다 — 7회차 minor 9)
      if (c == "#") {
        p = (i > 1) ? substr(s, i - 1, 1) : " "
        if (p == "\001") p = (i > 2) ? substr(s, i - 2, 1) : " "
        if (p ~ /[[:space:];&|(]/) {
          j = findre(s, i, n, "[\n\001]")
          if (j == 0) break
          i = j; continue
        }
      }
      if (c == "$" && substr(s, i + 1, 1) == "\"") { i++; continue }   # $"…" = 큰따옴표(로캘 번역 문자열)
      if (c == "$" && substr(s, i + 1, 1) == "{") {             # ${…} — 안의 «#» 는 주석이 아니다(${MSG:- #none}) · 안의 따옴표 · 중첩을 안다(10회차 B2)
        j = matchbrace(s, i + 2)
        if (j == 0) { op = op substr(s, i); break }
        op = op substr(s, i, j - i + 1); i = j + 1; continue
      }
      if (c == "$" && substr(s, i + 1, 1) == "\047") {          # ANSI-C 문자열($ + 작은따옴표) — 안의 백슬래시 따옴표는 닫는 따옴표가 아니다
        buf = ""; bp = ""; j = i + 2; closed = 0
        while (j <= n) {
          if (length(bp) > 4096) { buf = buf bp; bp = "" }
          k = findre(s, j, n, "[\\\\\047]")
          if (k == 0) { bp = bp substr(s, j); j = n + 1; break }
          if (k > j) bp = bp substr(s, j, k - j)
          if (substr(s, k, 1) == "\\") { bp = bp substr(s, k + 1, 1); j = k + 2; continue }
          closed = 1; j = k; break
        }
        buf = buf bp
        if (!closed) { op = op " " buf; break }
        i = j + 1
        op = op quoted(buf, otail(out, op), depth); continue
      }
      if (c == "\047") {                                          # 작은따옴표 — 치환 없이 글자 그대로
        j = findch(s, i + 1, n, "\047")
        if (j == 0) { op = op substr(s, i + 1); break }           # 짝 없음 — 나머지를 그대로 본다(fail-safe)
        buf = substr(s, i + 1, j - i - 1); i = j + 1
        op = op quoted(buf, otail(out, op), depth); continue
      }
      if (c == "\"") {                                            # 큰따옴표 — 안쪽 $(…) · `…` 는 명령
        buf = ""; bp = ""; i++; closed = 0
        while (i <= n) {
          if (length(bp) > 4096) { buf = buf bp; bp = "" }
          j = findre(s, i, n, "[\\\\\"$`]")
          if (j == 0) { bp = bp substr(s, i); i = n + 1; break }
          if (j > i) { bp = bp substr(s, i, j - i); i = j }
          c = substr(s, i, 1)
          if (c == "\\") { bp = bp substr(s, i + 1, 1); i += 2; continue }
          if (c == "\"") { i++; closed = 1; break }
          if (c == "$" && substr(s, i + 1, 1) == "(" && substr(s, i + 2, 1) != "(") {
            j = matchparen(s, i + 1); if (j > n) { bp = bp " "; i += 2; continue }
            inner = substr(s, i + 2, j - i - 2)
            r = scan(inner, depth + 1); INNERS = INNERS "\n" r; bp = bp "SUBST"; i = j + 1; continue
          }
          if (c == "`") {
            j = findch(s, i + 1, n, "`")
            if (j == 0) { bp = bp substr(s, i + 1); i = n + 1; break }
            inner = substr(s, i + 1, j - i - 1)
            r = scan(inner, depth + 1); INNERS = INNERS "\n" r; bp = bp "SUBST"; i = j + 1; continue
          }
          bp = bp c; i++
        }
        buf = buf bp
        if (!closed) { op = op " " buf; break }                   # 짝 없음 — 나머지를 그대로 본다(fail-safe)
        op = op quoted(buf, otail(out, op), depth); continue
      }
      if (c == "$" && substr(s, i + 1, 1) == "(" && substr(s, i + 2, 1) != "(") {
        # 닫히지 않은 $( 는 나머지를 안쪽으로 다시 훑지 않고 같은 단계에서 이어 본다(bash 는 실행하지 않는다 · 글자는 그대로 판정 — 큰 입력이 제곱으로)
        j = matchparen(s, i + 1); if (j > n) { op = op " "; i += 2; continue }
        inner = substr(s, i + 2, j - i - 2)
        r = scan(inner, depth + 1); INNERS = INNERS "\n" r; op = op " SUBST "; i = j + 1; continue
      }
      if (c == "`") {
        j = findch(s, i + 1, n, "`")
        if (j == 0) { op = op substr(s, i + 1); break }
        inner = substr(s, i + 1, j - i - 1)
        r = scan(inner, depth + 1); INNERS = INNERS "\n" r; op = op " SUBST "; i = j + 1; continue
      }
      op = op c; i++
    }
    return out op
  }
  BEGIN {
    RS = "\003"; SQ = sprintf("%c", 39)
    RE_DQS = "\"([^\"\\\\]|\\\\.)*\""
    RE_SQS = SQ "([^" SQ "\\\\]|\\\\.)*" SQ
  }
  { ALL = ALL (NR > 1 ? RS : "") $0 }
  END { INNERS = ""; RES = scan(ALL, 0); gsub(/\001/, " ", RES); gsub(/\001/, " ", INNERS); printf "%s\n%s\n", RES, INNERS }
  '
}

PROD_MSG="prod 푸시 차단 — admin/client production 배포가 즉시 트리거됩니다. nomacomfe-prod-push-check 스킬로 pre-flight 를 마치고 사용자 명시 승인을 받으세요."

check_git_push() { # $1 = «git push» 뒤 인자(스캐너가 정리한 글)
  local args=" $1 "
  # push-option 값은 원격에 넘기는 글자다(-o 'prod' · -o ci.variable="GLOB=*.ts" · --push-option "+1") — 판정 전에 걷는다
  local re_po='[[:space:]](-o|Q-o|--push-option|Q--push-option)([[:space:]]+|=)[^[:space:]]+'
  while [[ "$args" =~ $re_po ]]; do args="${args/"${BASH_REMATCH[0]}"/ }"; done
  # 따옴표 친 옵션은 스캐너가 «Q-…» 로 남긴다(git push "--force" · '-f')
  case "$args" in
    *" --force"*|*" -f "*|*" Q--force"*|*" Q-f "*)
      block "force push 차단. 진짜 필요하면 사용자에게 명시적 확인 받고 hook 우회하세요." ;;
  esac
  # 짧은 옵션 묶음(-fu · -uf) 안의 f 도 force 다
  if [[ "$args" =~ [[:space:]]Q?-[a-zA-Z]*f[a-zA-Z]*[[:space:]] ]]; then
    block "force push(-f 묶음) 차단. 진짜 필요하면 사용자에게 명시적 확인 받고 hook 우회하세요."
  fi
  # «+refspec» 은 --force 없이도 force push 다(+HEAD:dev · +dev)
  if [[ "$args" =~ [[:space:]]\+[^[:space:]] ]]; then
    block "force push(+refspec) 차단 — «+» 가 붙은 refspec 은 강제 덮어쓰기입니다. 진짜 필요하면 사용자 명시 확인 후 hook 우회."
  fi
  # --mirror(강제 + 삭제) · --all · --branches · 글롭 refspec 은 prod 를 함께 밀 수 있다
  # git 은 긴 옵션의 고유 접두를 받는다(--mirr · --al) · 따옴표 친 옵션은 «Q--…»
  local re_many='[[:space:]]Q?--(m|mi|mir|mirr|mirro|mirror|al|all|b|br|bra|bran|branc|branch|branche|branches)([[:space:]=]|$)'
  if [[ "$args" =~ $re_many ]]; then
    block "git push --mirror / --all 차단 — prod 를 포함한 여러 ref 를 한꺼번에 밉니다. 필요한 브랜치만 이름으로 push 하세요."
  fi
  # 자리표시 목적지({} · {1} — xargs -I · parallel · find -exec)는 판정할 수 없다(8회차 M1)
  if [[ "$args" == *"{}"* || "$args" =~ \{[0-9]+\} ]]; then
    block "git push 목적지가 자리표시({})라 판정할 수 없습니다 — 브랜치를 이름으로 적어 push 하세요."
  fi
  if [[ "$args" == *"*"* ]]; then
    block "글롭 refspec(*) push 차단 — prod 까지 함께 밀 수 있습니다. 필요한 브랜치만 이름으로 push 하세요."
  fi
  # ⭐ prod 는 막는다 (m8-frontend 와 다른 지점) — prod push = admin/client production 즉시 배포.
  # ⚠️ 단어 경계 — feat/product-detail · fix/reproduce-issue · imjohnkoo/prod-x · x/prod 는 통과.
  #    목적지 = bare «prod» · «heads/prod» · «refs/heads/prod» — 앞은 공백 · «:» · «+» · 따옴표, 뒤는 따옴표 · 공백 · 리다이렉트 · 끝
  if [[ "$args" =~ (^|[[:space:]:+\'\"])(refs/)?(heads/)?prod[\'\"]?([[:space:]\<\>#]|$) ]]; then
    block "$PROD_MSG"
  fi
  # 중괄호 확장({dev,prod} · HEAD:{dev,prod})
  if [[ "$args" =~ [{,](refs/)?(heads/)?prod[,}] ]]; then
    block "$PROD_MSG"
  fi
  # 변수 기본값으로 적은 prod(HEAD:${TARGET:-prod})
  local re_default='\$\{[A-Za-z_][A-Za-z0-9_]*:?[-=](refs/)?(heads/)?prod\}'
  if [[ "$args" =~ $re_default ]]; then
    block "$PROD_MSG"
  fi
}

check_gh_api() { # $1 = «gh api» 부터 세그먼트 끝까지(정리한 글)
  local s=" $1 " low
  low=$(printf '%s' "$s" | tr 'A-Z' 'a-z')
  # workflow 수동 실행(dispatch) — ci · design-system-publish 밖(production · 숫자 ID · 변수)은 막는다(gh workflow run 과 같은 규칙 — 8회차 minor 1)
  if [[ "$low" =~ /actions/workflows/([^/[:space:]]+)/dispatches ]]; then
    case "${BASH_REMATCH[1]}" in
      ci|ci.yml|design-system-publish|design-system-publish.yml) : ;;
      *) block "workflow 수동 실행(dispatch) 차단 — production workflow 는 그 ref 를 prod 서버에 바로 배포합니다(이름 · ID 로 가릴 수 없어 ci · design-system-publish 외 전부). prod 브랜치 승격 경로(nomacomfe-prod-push-check)로." ;;
    esac
  fi
  # workflow run · job 재실행(REST) — gh run rerun 과 같다(production run 재실행 = 재배포)
  if [[ "$low" =~ /actions/(runs|jobs)/[^[:space:]/]+/(rerun|rerun-failed-jobs)([^[:alnum:]_-]|$) ]]; then
    block "workflow run 재실행(REST) 차단 — production run 재실행은 그 커밋을 prod 에 다시 배포합니다(옛 run 이면 되감기). 사용자에게 run 을 확인받으세요."
  fi
  # graphql 엔드포인트는 읽기 쿼리도 필드로 POST 한다 — REST 판정에서 빼고 아래 mutation 표식으로만 본다
  local is_graphql=0
  [[ "$s" =~ [[:space:]/]graphql([[:space:]]|$) ]] && is_graphql=1
  # prod 를 가리키는 것: ref 경로 · ref= · base= · new_name= · branch=(contents PUT 은 prod 에 직접 커밋 · merge-upstream) · /branches/prod
  if (( ! is_graphql )) && [[ "$s" =~ refs/heads/prod([^[:alnum:]_.-]|$) || "$s" =~ (ref|new_name|base|branch)=(refs/heads/)?prod([^[:alnum:]_.-]|$) || "$s" =~ /branches/prod(/|[^[:alnum:]_.-]|$) ]]; then
    local write=0
    if [[ "$low" =~ (-x|--method)[[:space:]=]*(patch|post|put|delete) ]]; then
      write=1
    elif ! [[ "$low" =~ (-x|--method)[[:space:]=]*get([^[:alnum:]]|$) ]] &&
      [[ "$s" =~ [[:space:]]Q?-[fF][^[:space:]]*[[:space:]] || "$s" =~ [[:space:]]Q?(--field|--raw-field|--input)([[:space:]=]|$) ]]; then
      write=1   # gh api 는 필드를 주면 -X 없이도 POST
    fi
    (( write )) && block "gh api 로 prod ref 직접 변경 차단 — git push 와 동등한 배포 트리거입니다. 사용자 명시 승인 필요."
  fi
  # ref 되감기 — GitHub 은 force 없는 비-fast-forward 를 422 로 거부한다. 뚫리는 길은 명시적 force 하나뿐
  case "$s" in
    *"refs/heads/"*"force=true"*|*"refs/heads/"*"force= true"*|*"force=true"*"refs/heads/"*|*"refs/heads/"*" JSONFORCE"*|*" JSONFORCE"*"refs/heads/"*)
      block "gh api 로 ref 를 force 이동하는 것은 차단합니다 — 배포를 되돌리고 커밋이 소실됩니다. 정말 필요하면 사용자 명시 승인을 받으세요." ;;
  esac
  # graphql — ref 변경 · 머지 mutation(쿼리는 따옴표 안이라 스캐너 표식으로) · prod base PR
  if (( is_graphql )); then
    [[ "$s" == *" GQLMUT"* ]] && block "gh api graphql 의 ref 변경 · 머지 mutation 차단 — 대상(prod 여부)을 판정할 수 없습니다. REST(gh api …/git/refs/heads/<브랜치>)로 이름을 적어서 하세요."
    [[ "$s" == *" GQLPRBASE"* ]] && block "gh api graphql 로 prod base PR 차단 — 머지하면 prod 가 바로 배포됩니다."
    # 변수로 준 base(createPullRequest(… baseRefName: $b …) -f b=prod — 9회차 m4)
    [[ "$s" == *" GQLPR"* && "$s" =~ [[:space:]]Q?-[fF][[:space:]]*[A-Za-z_]+=(refs/heads/)?prod([[:space:]]|$) ]] &&
      block "gh api graphql 로 prod base PR 차단(변수로 준 base) — 머지하면 prod 가 바로 배포됩니다."
  fi
}

check_segment() { # $1 = 세그먼트(정리한 글)
  local seg="$1" s rest
  [[ "$seg" =~ [^[:space:]] ]] || return
  # 볼 명령 이름이 하나도 없으면 정규식 전에 끝(글롭 비교는 큰 입력에서도 빠르다)
  [[ "$seg" == *git* || "$seg" == *"gh "* || "$seg" == *docker* || "$seg" == *aws* || "$seg" == *api.github.com* ]] || return
  # git 전역 옵션은 쪼개기 전에 글 전체에서 한 번에 걷었다(아래 GITOPTS) · -c remote.*.push 는 그 전에 따로 봤다
  s="$seg"

  # gh 하위 명령 앞의 -R/--repo 는 걷는다(gh pr -R o/r create --base prod · gh workflow -R o/r run … — 9회차 m2)
  if [[ "$s" == *"gh "* ]]; then
    while [[ "$s" =~ (gh([[:space:]]+[a-z]+)?)[[:space:]]+(-R|--repo)([[:space:]]+|=)[^[:space:]]+ ]]; do s="${s/"${BASH_REMATCH[0]}"/${BASH_REMATCH[1]}}"; done
  fi
  # git config 로 push refspec 에 prod 를 넣는 것(뒤의 맨 git push 가 prod 로 간다 — -c remote.*.push 와 같은 일 · 9회차 m5)
  if [[ "$s" =~ (^|[[:space:]/!{])git[[:space:]]+config([[:space:]]+-[^[:space:]]+)*([[:space:]]+set)?[[:space:]]+remote\.[^[:space:]]+\.(push|mirror)[[:space:]]+[^[:space:]]*(prod|\*|true) ]]; then
    block "$PROD_MSG"
  fi

  # --- git push(세그먼트 어디든 — if · then · timeout · nice · /usr/bin/git 접두 포함) ---
  if [[ "$s" =~ (^|[[:space:]/!{])git[[:space:]]+push([[:space:]].*)?$ ]]; then
    rest="${BASH_REMATCH[2]}"
    if [[ "$s" =~ (^|[[:space:]])xargs[[:space:]] ]]; then
      block "xargs 로 git push 차단 — 목적지(표준 입력)를 판정할 수 없습니다. 브랜치를 이름으로 적어 push 하세요."
    fi
    check_git_push "$rest"
  fi

  # git subtree push · git send-pack 도 원격 ref 를 민다 — 같은 판정
  if [[ "$s" =~ (^|[[:space:]/!{])git[[:space:]]+(subtree[[:space:]]+push|send-pack)([[:space:]].*)?$ ]]; then
    check_git_push "${BASH_REMATCH[3]}"
  fi

  # --- gh api · gh pr · gh workflow (세그먼트 어디든) ---
  if [[ "$s" =~ (^|[[:space:]/!{])gh[[:space:]]+api([[:space:]].*)?$ ]]; then
    check_gh_api "gh api${BASH_REMATCH[2]}"
    # 표준 입력 · 파일로 본문을 넘기는 ref · 머지 · PR · 파일 커밋(contents) · graphql 호출만(이슈 댓글 -F body=@- 본문의 refs/heads/prod 글자로 막지 않게 — 8회차 minor 4)
    [[ "$s" =~ (/git/|/branches|/merges|/merge-upstream|/pulls|/contents/|[[:space:]/]graphql([[:space:]]|$)) ]] &&
      [[ "$s" =~ [[:space:]]--input([[:space:]=]|$) || "$s" =~ [[:space:]](-[fF]|--field|--raw-field)([[:space:]]*|=)[a-zA-Z_]+=@ ]] && HAS_INPUT_API=1
    [[ "$s" =~ [[:space:]/]graphql([[:space:]]|$) ]] && HAS_GRAPHQL_API=1
    # 변수 · 치환에 담은 쿼리(-f query="$QUERY") — 같은 명령 글 어디든 mutation 이 보이면 막는다(7회차 minor 6)
    [[ "$s" =~ [[:space:]/]graphql([[:space:]]|$) && "$s" =~ query=(\$|SUBST) ]] && HAS_GRAPHQL_VAR=1
  fi
  # workflow run 재실행 — production run 을 다시 돌리면 재배포(옛 run 이면 되감기). ID 로는 가릴 수 없어 전부
  if [[ "$s" =~ (^|[[:space:]/!{])gh[[:space:]]+run[[:space:]]+rerun([[:space:]]|$) ]]; then
    block "gh run rerun 차단 — production run 재실행은 그 커밋을 prod 에 다시 배포합니다(옛 run 이면 되감기). CI 재실행이 필요하면 사용자에게 run 을 확인받으세요."
  fi
  if [[ "$s" =~ (^|[[:space:]/!{])gh[[:space:]]+pr[[:space:]]+(create|new|edit)([[:space:]].*)?$ ]]; then
    # --base prod · --base=prod · -B prod · -Bprod · 묶음 -dB prod · 따옴표 친 '--base' · '-B'(뒤에 띄어 쓴 prod 만 — --body "-Bprod" 는 값)
    if [[ " ${BASH_REMATCH[3]} " =~ [[:space:]](Q?--base[[:space:]=]+|-[a-zA-Z]*B[[:space:]=]*|Q-B[[:space:]=]+)prod([[:space:]]|$) ]]; then
      block "prod 를 base 로 하는 PR 차단 — 머지하면 prod 가 바로 배포됩니다. PR base 는 dev, 승격은 nomacomfe-prod-push-check 뒤 사용자 승인으로."
    fi
  fi
  # workflow 수동 실행 — 배포가 아닌 것(ci · design-system-publish)만 이름으로 허용. 변수 · ID · 표시 이름 · production 은 막는다
  if [[ "$s" =~ (^|[[:space:]/!{])gh[[:space:]]+workflow[[:space:]]+(run|r)([[:space:]]+(.*))?$ ]]; then
    local wf="" tok
    local skipnext=0
    for tok in ${BASH_REMATCH[4]}; do
      if (( skipnext )); then skipnext=0; continue; fi
      case "$tok" in
        --ref|-r|--repo|-R|--field|-f|--raw-field|-F|--json) skipnext=1; continue ;;
        -*) continue ;;
      esac
      wf="${tok##*/}"; break   # 경로로 적어도 파일 이름으로(.github/workflows/ci.yml)
    done
    case "$wf" in
      ci|ci.yml|design-system-publish|design-system-publish.yml) : ;;
      *) block "workflow 수동 실행 차단 — production workflow 는 그 ref(기본 dev)를 prod 서버에 바로 배포합니다(이름 · ID · 변수로 가릴 수 없어 ci · design-system-publish 외 전부). prod 브랜치 승격 경로(nomacomfe-prod-push-check)로." ;;
    esac
  fi

  # curl 이 표준 입력(heredoc)으로 본문을 보내면 gh api --input 과 같이 본다(curl -d @- <<EOF {"ref": "refs/heads/prod"} — 9회차 m3)
  if [[ "$s" =~ (^|[[:space:]/!{])(curl|wget|http|https)[[:space:]] && "$s" == *api.github.com* &&
    "$s" =~ (/git/|/branches|/merges|/merge-upstream|/pulls|/contents/|graphql) && "$s" =~ (@-([[:space:]]|$)|-T[[:space:]]+-([[:space:]]|$)) ]]; then
    HAS_INPUT_API=1
  fi
  # curl · wget · http 로 GitHub API 를 직접 불러 ref 를 바꾸기(gh api 와 같은 일) — 조회(GET)는 두고, 쓰는 메서드 · 본문을 줄 때만
  #   (curl -X/--request · -d/--data* · -F/--form · -T · --json · wget --method · --post-data · httpie 메서드 낱말 — 7회차 minor 5)
  if [[ "$s" =~ (^|[[:space:]/!{])(curl|wget|http|https)[[:space:]] && "$s" == *api.github.com* ]] &&
    [[ "$s" =~ refs/heads/prod([^[:alnum:]_.-]|$) || "$s" =~ /branches/prod(/|[^[:alnum:]_.-]|$) || "$s" =~ /merges([^[:alnum:]_-]|$) || "$s" == *" PRODREF"* ||
      "$s" =~ /actions/workflows/[^/[:space:]]+/dispatches || "$s" =~ /actions/(runs|jobs)/[^[:space:]/]+/(rerun|rerun-failed-jobs)([^[:alnum:]_-]|$) ]]; then
    local low
    low=$(printf '%s' "$s" | tr 'A-Z' 'a-z')
    if [[ "$low" =~ (-x|--request|--method)[[:space:]=]*q?(patch|post|put|delete) ||
      "$s" =~ [[:space:]]Q?(-d|-F|-T|--data[a-z-]*|--form[a-z-]*|--upload-file|--json|--post-data|--post-file|--body-data|--body-file)([[:space:]=]|$) ||
      "$s" =~ [[:space:]](-d|-F|-T)[^[:space:]] ||
      "$low" =~ (^|[[:space:]/!{])https?[[:space:]]+(-[^[:space:]]+[[:space:]]+)*(patch|post|put|delete)[[:space:]] ]]; then
      block "GitHub API 직접 호출로 prod ref · 머지 변경 차단 — git push 와 동등한 배포 트리거입니다. 사용자 명시 승인 필요."
    fi
  fi

  # --- 나머지 파괴적 명령 — 사이에 옵션 · 하위 명령이 껴도(docker image push · buildx --push · reset -q --hard · aws --profile … ssm) ---
  # docker: push 는 하위 명령 자리에서만(docker exec … git push 는 docker push 가 아니다) · buildx 는 --push · type=registry · push=true
  local re_docker='(^|[[:space:]/!{])docker([[:space:]]+(--(context|host|config|log-level|tlscacert|tlscert|tlskey)[[:space:]]+[^[:space:]]+|-(H|c|l)[[:space:]]+[^[:space:]]+|-[^[:space:]]+))*[[:space:]]+((image|manifest|trust)[[:space:]]+([^[:space:]]+[[:space:]]+)*|compose[[:space:]]+((-f|-p|--file|--project-name|--project-directory|--env-file|--profile|--ansi|--progress|--parallel)[[:space:]]+[^[:space:]]+[[:space:]]+|-[^[:space:]]+[[:space:]]+)*)?push([[:space:]]|$)'
  # docker-compose(옛 단독 실행 파일) push · compose 의 값 받는 옵션(-f · -p — 7회차 minor 4) · buildx imagetools create(레지스트리 재태그 — minor 8)
  local re_compose1='(^|[[:space:]/!{])docker-compose([[:space:]]+((-f|-p|--file|--project-name|--project-directory|--env-file|--profile|--ansi)[[:space:]]+[^[:space:]]+|-[^[:space:]]+))*[[:space:]]+push([[:space:]]|$)'
  local re_imgtools='(^|[[:space:]/!{])docker[[:space:]](.*[[:space:]])?buildx[[:space:]](.*[[:space:]])?imagetools[[:space:]]+create([[:space:]]|$)'
  local re_buildx='(^|[[:space:]/!{])docker[[:space:]](.*[[:space:]])?(buildx|builder|build)[[:space:]](.*[[:space:],=])?(--push|type=registry|push=true)([[:space:],=]|$)'
  local re_reset='(^|[[:space:]/!{])git[[:space:]]+reset([[:space:]].*)?[[:space:]]Q?--(ha|har|hard)([[:space:]]|$)'
  local re_ssm='(^|[[:space:]/!{])aws[[:space:]](.*[[:space:]])?ssm[[:space:]]+(put-parameter|delete-parameter|delete-parameters)([[:space:]]|$)'
  # CodeDeploy 직접 배포 — prod 브랜치 push 와 같은 일(8회차 minor 7)
  local re_deploy='(^|[[:space:]/!{])aws[[:space:]](.*[[:space:]])?deploy[[:space:]]+create-deployment([[:space:]]|$)'
  if [[ "$s" =~ $re_docker || "$s" =~ $re_buildx || "$s" =~ $re_compose1 || "$s" =~ $re_imgtools ]]; then
    block "수동 docker push 금지. 배포는 GitHub Actions(prod 브랜치 push)로 트리거 — nomacom-admin / nomacom-client 이미지는 .github/workflows/*-production.yml 이 빌드."
  fi
  if [[ "$s" =~ $re_reset ]]; then
    block "git reset --hard 차단. 잃을 수 있는 작업 확인 후 사용자 승인 받으세요."
  fi
  if [[ "$s" =~ $re_ssm ]]; then
    block "SSM 변경 차단. 시크릿 변경은 콘솔 또는 사용자 명시 승인 필요 (.claude/rules/ssm-paths.md)."
  fi
  if [[ "$s" =~ $re_deploy ]]; then
    block "CodeDeploy 직접 배포 차단 — prod 브랜치 push 와 같은 배포입니다. nomacomfe-prod-push-check 뒤 사용자 명시 승인으로."
  fi
}

FAIL_MSG="guard 훅의 판정 도구(awk · sed)가 실패해 판정할 수 없습니다 — fail-closed 로 차단합니다."
# 명령 경계로 쪼개기(리다이렉트 2>&1 · &> 는 경계가 아니다)
SPLIT='{gsub(/[0-9]*>&[0-9]*-?|&>>?|<&[0-9]*-?/, " REDIR "); gsub(/&&|\|\||[;|()&]/, "\n"); print}'
# ⭐ git 과 서브커맨드 사이 전역 옵션을 걷는다(git -C <Orca 워크트리> push … 가 일상 형태) — 따옴표 든 값은 스캐너가 Q 로 바꿨다
GITOPTS='s/(^|[[:space:]/!{])git(([[:space:]]+(-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--super-prefix|--config-env|--attr-source)([[:space:]]+|=)[^[:space:]]+)|([[:space:]]+(--no-pager|-P|--paginate|-p|--bare|--no-replace-objects|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs|--no-optional-locks|--no-lazy-fetch|--no-advice)))+/\1git/g'
CLEAN=""
BODIES=""
HAS_INPUT_API=0
HAS_GRAPHQL_API=0
HAS_GRAPHQL_VAR=0

# 셸 글 하나(heredoc 을 걷은 뒤)를 판정한다 — 1) 줄 이음(\ + 줄바꿈)만 합치기(이음 자리는 \001 — 주석은 거기서 끝난다) · 탭 → 공백
#   2) 따옴표 스캐너 3) 명령 경계로 쪼개 세그먼트마다. 파이프라인 어느 단계가 실패해도 차단한다(pipefail — 7회차 minor 10)
judge_text() {
  local t c sg seg
  t=$(printf '%s' "$1" | tr '\r' ' ' | awk '{ sub(/[[:space:]]+$/, ""); if (sub(/\\$/, "")) printf "%s\001", $0; else print }' | tr '\t' ' ') || block "$FAIL_MSG"
  [[ "$1" =~ [^[:space:]] && ! "$t" =~ [^[:space:]] ]] && block "$FAIL_MSG"
  # ⭐ fail-closed — 스캐너(awk)가 죽으면(중첩 한계 · 문법 오류) 빈 글로 통과시키지 않는다
  c=$(printf '%s' "$t" | scan_shell) || block "$FAIL_MSG"
  # 공백 여럿은 하나로(git reset  --hard · docker  push)
  c=$(printf '%s' "$c" | tr -s ' ') || block "$FAIL_MSG"
  CLEAN+="$c"$'\n'
  # -c remote.<x>.push=… 판정은 전역 옵션을 걷기 전 글로 — 세그먼트마다(포크 없이)
  sg=$(printf '%s\n' "$c" | awk "$SPLIT") || block "$FAIL_MSG"
  while IFS= read -r seg; do
    if [[ "$seg" == *git* && "$seg" =~ (^|[[:space:]/])git[[:space:]] && "$seg" =~ [[:space:]]push([[:space:]]|$) && "$seg" =~ remote\.[^[:space:]=]+\.(push|mirror)=[^[:space:]]*(prod|\*|true) ]]; then
      block "$PROD_MSG"
    fi
    # 따옴표 없는 별칭 값(git -c alias.p=push p origin HEAD:prod) — 별칭이 push 면 그 줄의 prod 목적지를 본다
    if [[ "$seg" == *alias.* && "$seg" =~ -c[[:space:]]+alias\.[^[:space:]=]+=!?(git[[:space:]]+)?push && "$seg" =~ ([[:space:]:+]|^)(refs/heads/)?prod([[:space:]]|$) ]]; then
      block "$PROD_MSG"
    fi
  done <<< "$sg"
  sg=$(printf '%s\n' "$c" | sed -E "$GITOPTS" | awk "$SPLIT") || block "$FAIL_MSG"
  while IFS= read -r seg; do
    check_segment "$seg"
  done <<< "$sg"
}

# heredoc 으로 쓴 파일 $1 을 정리한 글에서 실행하는가 — bash|sh|zsh|dash|ksh|source|. [옵션] [<] 파일 · ./파일 · 경로 든 파일을 명령 자리에서 ·
#   파일 | sh. 그 파일일 때만 본문을 명령으로 본다(git add . · bash <다른 스크립트> 가 모든 데이터 heredoc 을 명령으로 만들던 오탐 — 7회차 M1)
ran_file() {
  local f="${1#./}" e re1 re2 re3 re4 re5 re6 nl=$'\n'
  [[ -n "$f" ]] || return 1
  e=$(printf '%s' "$f" | sed 's#[][\.*^$+?(){}|]#\\&#g') || block "$FAIL_MSG"
  # 옵션은 n 이 없는 짧은 옵션 · 긴 옵션만(bash -n = 문법 검사 — 실행하지 않는다)
  #   셸 이름 앞 경로(/bin/bash) · "$BASH" · 값을 받는 옵션(-o pipefail · -O extglob · -euo pipefail) · 리다이렉트(2>&1) · 파일 앞 $PWD/ · $(pwd)/ ·
  #   파일 바로 뒤 «>»(10회차 B1)
  re1="(^|[[:space:];&|(!{])([^[:space:];&|()]*/)?(bash|sh|zsh|dash|ksh|source|\\\$BASH|\\\$\\{BASH\\})([[:space:]]+(-[a-mo-zA-Z]*[oO]([[:space:]]+[a-z]+)?|-[a-mo-zA-Z]+|--[a-z-]+|--|[0-9]*>&[0-9]+|&?>[^[:space:]]+))*[[:space:]]+(<[[:space:]]*)?(\\./|\\\$PWD/|\\\$\\{PWD\\}/|SUBST/)?${e}([[:space:];&|)<>]|\$)"
  # eval "$(cat f)" · bash -c "$(cat f)" — 그 파일을 읽어 셸로 돌린다
  re6="(^|[[:space:]])cat[[:space:]]+(\\./)?${e}([[:space:];&|)]|\$)"
  re5="(^|[;&|(!{${nl}])[[:space:]]*\\.[[:space:]]+(\\./)?${e}([[:space:];&|)]|\$)"
  re2="(^|[[:space:];&|(!{])\\./${e}([[:space:];&|)]|\$)"
  re3="(^|[;&|(!{${nl}])[[:space:]]*((then|do|else|exec|sudo|nohup|time|command|env|timeout|nice)([[:space:]]+[^[:space:]/;&|]+)*[[:space:]]+)*${e}([[:space:];&|)]|\$)"
  # 파일 | bash — bash 뒤에 스크립트 인자가 없을 때만(파일 | bash x.sh 의 표준 입력은 데이터 — 9회차 m1)
  re4="(^|[[:space:]])(\\./)?${e}[[:space:]]*\\|[[:space:]]*(sudo[[:space:]]+)?(bash|sh|zsh|dash|ksh)([[:space:]]+-[^[:space:]]+)*[[:space:]]*([;&|)${nl}]|\$)"
  [[ "$CLEAN" =~ $re1 || "$CLEAN" =~ $re2 || "$CLEAN" =~ $re4 || "$CLEAN" =~ $re5 ]] && return 0
  [[ "$CLEAN" =~ $re6 && "$CLEAN" =~ (^|[[:space:]])(eval|-[a-zA-Z]*c)[[:space:]]+SUBST ]] && return 0
  [[ "$f" == */* && "$CLEAN" =~ $re3 ]]
}

# 명령 원문 하나를 판정한다 — 밖 글(데이터 heredoc 본문은 걷는다) · 셸 본문 · 인터프리터 본문 · 실행하는 파일의 본문을 각각 따로
judge_cmd() { # $1 = 원문 · $2 = 깊이(셸 본문 안의 셸 본문 — 4단까지)
  local raw="$1" d="$2" hs out chunk f
  hs=$(printf '%s' "$raw" | heredoc_split text) || block "$FAIL_MSG"
  [[ "$raw" =~ [^[:space:]] && ! "$hs" =~ [^[:space:]] ]] && block "$FAIL_MSG"
  judge_text "$hs"
  [[ "$raw" == *"<<"* ]] || return 0
  # 걷어 낸 데이터 본문 — gh api --input · -F x=@- 판정에만 쓴다(명령으로는 보지 않는다)
  out=$(printf '%s' "$raw" | heredoc_split bodies) || block "$FAIL_MSG"
  BODIES+="$out"$'\n'
  (( d < 4 )) || return 0
  # 셸이 먹는 본문(bash · ssh · eval · | bash) — 밖 글과 따로 판정한다(본문의 짝 없는 따옴표가 닫는 줄 뒤 명령을 숨기지 않게 — 7회차 B1)
  out=$(printf '%s' "$raw" | heredoc_split shell) || block "$FAIL_MSG"
  while IFS= read -r -d $'\004' chunk; do
    judge_cmd "$chunk" $((d + 1))
  done <<< "$out"
  # 인터프리터 본문(python · node · ruby …) — 줄마다 짝 없는 따옴표를 지운 글을 따로(백틱 · $(…) 는 셸 명령)
  out=$(printf '%s' "$raw" | heredoc_split interp) || block "$FAIL_MSG"
  while IFS= read -r -d $'\004' chunk; do
    judge_text "$chunk"
  done <<< "$out"
  # heredoc 으로 쓴 파일을 같은 명령에서 실행하면(cat > p.sh <<EOF … EOF; bash p.sh · . p.sh · ./p.sh) 그 본문도 명령이다
  out=$(printf '%s' "$raw" | heredoc_split written) || block "$FAIL_MSG"
  # 써 두는 파일이 아주 많으면(꾸민 입력) 파일마다 정리한 글 전체를 훑느라 600초를 넘겨 판정 없이 통과(fail-open)할 수 있다 — 판정 불가로 막는다
  if [[ $(printf '%s' "$out" | tr -cd '\004' | wc -c) -gt 200 ]]; then
    block "heredoc 으로 쓰는 파일이 200개를 넘어 판정할 수 없습니다 — fail-closed 로 차단합니다. 나눠서 실행하거나 스크립트 파일로 쓰세요."
  fi
  while IFS= read -r -d $'\004' chunk; do
    f="${chunk%%$'\001'*}"
    if ran_file "$f"; then judge_cmd "${chunk#*$'\001'}" $((d + 1)); fi
  done <<< "$out"
}

judge_cmd "$cmd" 0

flat=$(printf '%s %s' "$CLEAN" "$BODIES" | tr '\r\n\t' '   ')
# 표준 입력 · heredoc 으로 JSON 을 넘기는 gh api(--input) — 정리한 글 어디든 prod ref 가 보이면 막는다
if (( HAS_INPUT_API )) &&
  [[ "$flat" == *" PRODREF"* || "$flat" =~ refs/heads/prod([^[:alnum:]_.-]|$) || "$flat" =~ (^|[^[:alnum:]_])\"?(ref|base|branch|new_name)\"?[[:space:]]*:[[:space:]]*\"?(refs/heads/)?prod([^[:alnum:]_.-]|$) ]]; then
  block "gh api --input 으로 prod ref 변경 차단 — git push 와 동등한 배포 트리거입니다. 사용자 명시 승인 필요."
fi
# 표준 입력 · heredoc 으로 넘긴 JSON 의 force(ref 되감기 — echo '{"sha":"…","force":true}' | gh api -X PATCH …/refs/heads/x --input -)
if (( HAS_INPUT_API )) && [[ "$flat" == *refs/heads/* ]] &&
  [[ "$flat" == *" JSONFORCE"* || "$flat" =~ force\"?[[:space:]]*:[[:space:]]*true ]]; then
  block "gh api 로 ref 를 force 이동하는 것은 차단합니다 — 배포를 되돌리고 커밋이 소실됩니다. 정말 필요하면 사용자 명시 승인을 받으세요."
fi
# heredoc · 표준 입력으로 넘긴 graphql 쿼리(--input · -F query=@-) — 본문의 mutation(따옴표 표식이든 맨 글자든)
if (( HAS_GRAPHQL_API && HAS_INPUT_API )) &&
  [[ "$flat" == *" GQLMUT"* || "$flat" =~ (createRef|updateRef|updateRefs|deleteRef|mergeBranch|mergePullRequest|createCommitOnBranch|enablePullRequestAutoMerge) ]]; then
  block "gh api graphql 의 ref 변경 · 머지 mutation 차단 — 대상(prod 여부)을 판정할 수 없습니다. REST(gh api …/git/refs/heads/<브랜치>)로 이름을 적어서 하세요."
fi
# 변수에 담은 graphql 쿼리(QUERY='mutation { updateRef … }' · gh api graphql -f query="$QUERY") — 같은 명령 글 어디든 mutation 이 보이면
if (( HAS_GRAPHQL_VAR )) &&
  [[ "$flat" == *" GQLMUT"* || "$flat" =~ (createRef|updateRef|updateRefs|deleteRef|mergeBranch|mergePullRequest|createCommitOnBranch|enablePullRequestAutoMerge) ]]; then
  block "gh api graphql 의 ref 변경 · 머지 mutation 차단(변수에 담은 쿼리) — 대상(prod 여부)을 판정할 수 없습니다. REST(gh api …/git/refs/heads/<브랜치>)로 이름을 적어서 하세요."
fi

exit 0
