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
#    성능(macOS bash 5): 300KB 이하 일상 입력 1초 안팎 · 따옴표 친 1–2MB heredoc 1초 안 · 따옴표 없는 heredoc 의 큰 JSON 1.3MB 약 45초 · 1.9MB 약 90초
#    (큰따옴표 문자열 조각 잇기) · python heredoc 1.4MB 약 30초. 기본 훅 제한(600초) 안이지만, 넘치면 Claude Code 는 판정 없이 진행한다(fail-open) — 큰 글은 파일로.
set +e

input=$(cat)

# ⭐ fail-closed — jq 가 없으면 «통과» 가 아니라 «차단» 이다.
# jq 는 입력 파싱과 block() 출력 양쪽의 하드 의존이다. 없으면 cmd 가 빈 문자열이 되어
# 모든 명령이 조용히 통과한다. 안전장치가 조용히 사라지는 것보다 시끄럽게 막히는 편이 낫다.
if ! command -v jq >/dev/null 2>&1; then
  printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"guard 훅의 의존성(jq)이 없어 판정할 수 없습니다 — fail-closed 로 차단합니다. `brew install jq` 후 재시도하세요."}}'
  exit 0
fi

cmd=$(echo "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

[[ -z "$cmd" ]] && exit 0

block() {
  jq -n --arg r "$1" '{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny", "permissionDecisionReason": $r}}'
  exit 0
}

# ⭐ heredoc 본문은 «데이터» 라 판정에서 뺀다 — 커밋 메시지 · 문서의 명령 «예시» 가 실행으로 오인되지 않게.
#   단, 셸이 먹는 본문(bash · sh · zsh · eval …)은 명령이라 그대로 · 다른 인터프리터(python · node …) 본문은 짝이 안 맞는 줄만
#   따옴표를 지워 남기고(짝 없는 따옴표가 heredoc 밖까지 끌고 가지 않게) · gh api 입력 등 데이터 본문은 걷어 bodies 로 넘긴다.
# ⭐ 2026-10-05 5회차(QA ⑥): 줄 단위 bash 판정 → awk 하나로. 줄을 넘는 따옴표 · 주석 · $((…)) 상태를 알고 «<<» 를 판정한다
#   (여러 줄 커밋 메시지 · 주석 안 «<<EOF» 글자가 뒤 줄을 삼키지 않게) · 따옴표 없는 구분자(<<EOF)의 본문은 큰따옴표 문자열처럼
#   다룬다 — 안의 $(…) · 백틱은 bash 가 실행하므로 명령으로 본다 · 구분자 줄이 끝내 없으면 heredoc 이 아니었다 — 되살린다.
#   줄마다 sed 를 띄우지 않는다(큰 입력 성능). 인터프리터 이름은 단어 경계로(evaluation.md · node-22 오탐 0).
#   $1 = text(판정할 글) | bodies(걷어 낸 데이터 본문 — gh api --input · -F x=@- · 같은 명령에서 실행하는 스크립트 판정용)
heredoc_split() {
  awk -v mode="$1" '
  function settle(u) {
    if (u ~ /(^|[ \t\/|;&(!{])(bash|sh|zsh|dash|ksh|fish|ssh|eval)([ \t<]|$)/) return 0
    if (u ~ /(^|[ \t\/|;&(!{])(python[0-9.]*|node|nodejs|deno|bun|ruby|perl|php|osascript)([ \t<]|$)/) return 2
    return pq ? 1 : 3
  }
  function odd(l, ch,   t) { t = l; return gsub(ch, "", t) % 2 }
  # 출력 — 글(text)은 바로 낸다(큰 입력에서 문자열을 계속 이어 붙이면 제곱으로 느려진다)
  function out(x) { if (mode == "text") printf "%s", x }
  function body(x) { if (mode == "bodies") printf "%s", x }
  # 긴 줄에서 i 부터 정규식 · 글자를 찾는다 — substr(line, i) 로 나머지 전부를 복사하지 않고 4KB 창으로
  function findre(l, i, n, re,   w) {
    while (i <= n) { w = substr(l, i, 4096); if (match(w, re)) return i + RSTART - 1; i += 4096 }
    return 0
  }
  function findch(l, i, n, ch,   w, j) {
    while (i <= n) { w = substr(l, i, 4096); j = index(w, ch); if (j) return i + j - 1; i += 4096 }
    return 0
  }
  function keep(u) { return (length(u) > 4096) ? substr(u, length(u) - 2047) : u }
  # 따옴표 없는 heredoc 본문 한 줄 → 큰따옴표 문자열 안 글자(gsub 치환 문자열은 awk 마다 달라 글자를 직접 잇는다)
  #   bash 는 본문에서 \$ \` \\ 만 이스케이프로 본다 — 나머지 \ 는 글자 그대로 · 큰따옴표는 글자
  function dqesc(l,   o, c, x) {
    o = ""
    while (match(l, /[\\"]/)) {
      o = o substr(l, 1, RSTART - 1); c = substr(l, RSTART, 1); x = substr(l, RSTART + 1, 1)
      if (c == "\"") { o = o "\\\""; l = substr(l, RSTART + 1); continue }
      if (x == "$" || x == "`" || x == "\\") { o = o c x; l = substr(l, RSTART + 2); continue }
      o = o "\\\\"; l = substr(l, RSTART + 1)
    }
    return o l
  }
  BEGIN {
    sp = 1; st[1] = "S"; indoc = 0; nb = 0; carry = ""
    SQ = sprintf("%c", 39)
    RE_DQS = "\"([^\"\\\\]|\\\\.)*\""
    RE_SQS = SQ "([^" SQ "\\\\]|\\\\.)*" SQ
  }
  {
    line = $0; sub(/\r$/, "", line)
    if (indoc) {
      t = line; sub(/^[ \t]+/, "", t); sub(/[ \t]+$/, "", t)
      if (t == delim) {
        if (indoc == 3) { out("\""); for (k = 1; k <= nb; k++) out(dqesc(rawl[k]) "\n"); out("\"\n") }
        if (indoc == 1 || indoc == 3) for (k = 1; k <= nb; k++) body(rawl[k] "\n")
        if (indoc == 2) out(line "\n")
        indoc = 0; nb = 0; next
      }
      if (indoc == 2) {
        l = line
        if (odd(l, "\047") || odd(l, "\"") || odd(l, "`")) {
          gsub(RE_DQS, " Q ", l); gsub(RE_SQS, " Q ", l)
          gsub(/["\047`]/, "", l)
        }
        out(l "\n"); next
      }
      rawl[++nb] = line
      next
    }
    # 따옴표 · 주석 · $(…) · 백틱 상태를 스택으로 이어 가며 «<<» 를 찾는다 — S 셸 · C $(…) 안(셸) · B 백틱 안(셸) · D 큰따옴표 · Q 작은따옴표.
    #   "$(cat <<'EOF' … EOF )" 처럼 큰따옴표 안 $(…) 의 heredoc 은 진짜 heredoc 이다(bash 가 $(…) 안을 셸로 읽는다)
    #   줄 이음(«\» 로 끝난 줄)은 같은 명령이다 — 앞 줄의 글을 이어 받아 heredoc 종류를 정한다(bash \ ⏎ -s <<EOF)
    pend = ""; pq = 0; u = carry; carry = ""; n = length(line); i = 1
    while (i <= n) {
      t = st[sp]
      if (t == "Q") { j = findch(line, i, n, "\047"); if (j == 0) { i = n + 1; break } if (sp > 1) sp--; i = j + 1; continue }
      if (t == "D") {
        j = findre(line, i, n, "[\\\\\"$`]"); if (j == 0) { i = n + 1; break }
        i = j; c = substr(line, i, 1)
        if (c == "\\") { i += 2; continue }
        if (c == "\"") { if (sp > 1) sp--; i++; continue }
        if (c == "`") { st[++sp] = "B"; i++; continue }
        if (substr(line, i, 2) == "$(" && substr(line, i, 3) != "$((") { st[++sp] = "C"; cd[sp] = 0; i += 2; continue }
        i++; continue
      }
      j = findre(line, i, n, "[\\\\\047\"`#$<()]")
      if (j == 0) { u = keep(u substr(line, i, 4096)); break }
      if (j > i) { u = keep(u substr(line, i, j - i)); i = j }
      c = substr(line, i, 1)
      if (c == "\\") { u = u substr(line, i, 2); i += 2; continue }
      if (c == "\047") { st[++sp] = "Q"; i++; continue }
      if (c == "\"") { st[++sp] = "D"; i++; continue }
      if (c == "`") { if (t == "B") { if (sp > 1) sp-- } else st[++sp] = "B"; u = u " "; i++; continue }
      if (c == "#") {
        if (i == 1 || substr(line, i - 1, 1) ~ /[ \t;&|(]/) break
        u = u c; i++; continue
      }
      if (c == "(") { if (t == "C") cd[sp]++; u = u c; i++; continue }
      if (c == ")") {
        if (t == "C") { if (cd[sp] == 0) { if (sp > 1) sp--; u = u " ) "; i++; continue } cd[sp]-- }
        u = u c; i++; continue
      }
      if (c == "$") {
        if (substr(line, i, 3) == "$((") { j = findch(line, i, n, "))"); if (j) { u = u " ARITH "; i = j + 2; continue } }
        if (substr(line, i, 2) == "$(") { st[++sp] = "C"; cd[sp] = 0; u = u " "; i += 2; continue }
        u = u c; i++; continue
      }
      # c == "<"
      if (substr(line, i, 2) == "<<" && substr(line, i, 3) != "<<<" && pend == "") {
        rest = substr(line, i + 2, 512)
        if (match(rest, /^-?[ \t]*\\?["\047]?[A-Za-z_][A-Za-z0-9_.-]*["\047]?/)) {
          tok = substr(rest, 1, RLENGTH)
          pq = (tok ~ /["\047\\]/)
          d = tok; sub(/^-?[ \t]*\\?["\047]?/, "", d); sub(/["\047]$/, "", d)
          pend = d; u = u " << "; i += 2 + RLENGTH; continue
        }
      }
      u = u c; i++
    }
    out(line "\n")
    if (pend != "") { delim = pend; indoc = (u ~ /\|[ \t]*$/ && u !~ /\|\|[ \t]*$/) ? 0 : settle(u) }
    else if (st[sp] == "S" && line ~ /\\$/) carry = keep(u)
  }
  END {
    if (indoc == 1 || indoc == 3) for (k = 1; k <= nb; k++) out(rawl[k] "\n")   # 구분자가 끝내 없었다 = heredoc 이 아니었다 — 되살린다
  }'
}

# 따옴표를 아는 스캐너 — 정리한 글 다음에 뽑아 낸 명령($(…) · `…` · bash -c · eval)을 줄로 잇는다
scan_shell() {
  awk '
  # 긴 글에서 i 부터 정규식 · 글자를 찾는다 — substr(s, i) 로 나머지 전부를 복사하지 않고 4KB 창으로(큰 입력이 제곱으로 느려지지 않게)
  function findre(l, i, n, re,   w) {
    while (i <= n) { w = substr(l, i, 4096); if (match(w, re)) return i + RSTART - 1; i += 4096 }
    return 0
  }
  function findch(l, i, n, ch,   w, j) {
    while (i <= n) { w = substr(l, i, 4096); j = index(w, ch); if (j) return i + j - 1; i += 4096 }
    return 0
  }
  # $(…) 의 짝 «)» — 안쪽 따옴표 · 백슬래시는 건너뛴다(따옴표 안의 «)» 로 일찍 닫히지 않게)
  function matchparen(s, p,   lvl, k, ch, n, j) {
    lvl = 0; n = length(s)
    for (k = p; k <= n; k++) {
      ch = substr(s, k, 1)
      if (ch == "\\") { k++; continue }
      if (ch == "\047") { j = findch(s, k + 1, n, "\047"); if (j == 0) return n + 1; k = j; continue }
      if (ch == "\"") {
        for (k++; k <= n; k++) { ch = substr(s, k, 1); if (ch == "\\") { k++; continue } if (ch == "\"") break }
        continue
      }
      if (ch == "(") lvl++
      else if (ch == ")") { lvl--; if (lvl == 0) return k }
    }
    return n + 1
  }
  function quoted(buf, before, depth,   t, mid, r, gm, tail, L, j) {
    # 앞 글은 끝 256자만 본다 — 따옴표마다 앞 글 전체에 정규식을 돌리면 큰 입력에서 제곱으로 느려진다
    L = length(before); tail = (L > 256) ? substr(before, L - 255) : before
    # 래퍼 판정은 같은 줄에서만(앞 줄의 gh run watch · ssh 가 뒤 줄 따옴표를 숨기지 않게 — QA ⑥ 6회차 B1)
    while ((j = index(tail, "\n")) > 0) tail = substr(tail, j + 1)
    # 문자열을 명령으로 받는 것 — bash/sh/fish -c(앞에 -o pipefail · -O extglob · --login · 묶음 옵션, 뒤에 -x · -- 가 껴도) · eval · trap ·
    #   watch · flock/su/npx/script … -c · env -S · tmux · ssh <호스트> · git rebase -x/--exec · git submodule foreach ·
    #   orca … --text(다른 터미널에 쳐 넣는다). 따로 뽑아 다시 본다(5단까지)
    if (depth < 6 && buf ~ /[[:space:]]/ && tail ~ /(^|[[:space:];&|(!{\/])((bash|sh|zsh|dash|ksh|fish)([[:space:]]+[^[:space:];&|]+)*[[:space:]]+-[[:alnum:]]*c[[:alnum:]]*([[:space:]]+-[^[:space:];&|]*)*|eval|trap|watch([[:space:]]+[^[:space:];&|]+)*|(flock|su|npx|script)([[:space:]]+[^[:space:];&|]+)*[[:space:]]+-c|env([[:space:]]+[^[:space:];&|]+)*[[:space:]]+-S|tmux([[:space:]]+[^[:space:];&|]+)*|ssh([[:space:]]+[^[:space:];&|]+)+|git([[:space:]]+[^[:space:];&|]+)*[[:space:]]+(-x|--exec|foreach)|orca([[:space:]]+[^[:space:];&|]+)*[[:space:]]+--text|(bash|sh|zsh|dash|ksh)([[:space:]]+[^[:space:];&|]+)*[[:space:]]*<<<)[[:space:]]*$/) {
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
    if (buf ~ /force"?[[:space:]]*:[[:space:]]*true/) gm = gm " JSONFORCE"
    # 공백 든 JSON · jq 식 안의 prod ref(--input 판정용 — 따옴표 문자열은 Q 로 걷혀 글자가 안 보인다)
    if (buf ~ /refs\/heads\/prod([^[:alnum:]_.-]|$)/ || buf ~ /(ref|base|branch|new_name)"?[[:space:]]*[:=][[:space:]]*"?(refs\/heads\/)?prod([^[:alnum:]_.-]|$)/) gm = gm " PRODREF"
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
  function scan(s, depth,   out, i, n, c, j, buf, inner, r, closed) {
    out = ""; n = length(s); i = 1
    while (i <= n) {
      # 특수 글자(\ # $ 따옴표 백틱) 전까지는 한 번에 붙인다 — 한 글자씩 이으면 큰 입력에서 느리다
      j = findre(s, i, n, "[\\\\#$\047\"`]")
      if (j == 0) { out = out substr(s, i); break }
      if (j > i) { out = out substr(s, i, j - i); i = j }
      if (i > n) break
      c = substr(s, i, 1)
      # 따옴표 밖 «\글자» 는 그 글자 — 영숫자면 백슬래시를 뺀다(«\git push» · «HEAD:pr\od» 가 그대로 보이게)
      if (c == "\\") {
        if (substr(s, i + 1, 1) ~ /[[:alnum:]_]/) out = out substr(s, i + 1, 1)
        else out = out substr(s, i, 2)
        i += 2; continue
      }
      # 주석 — 따옴표 밖에서 단어 첫머리의 # 부터 줄 끝까지(줄바꿈은 남긴다). 줄 이음 표식(\001)에서도 끝난다 —
      #   bash 는 주석 끝의 «\» 로 다음 줄을 잇지 않는다(«# C:\» 다음 줄의 push 가 주석에 먹히지 않게)
      if (c == "#" && (i == 1 || substr(s, i - 1, 1) ~ /[[:space:];&|(\001]/)) {
        j = findre(s, i, n, "[\n\001]")
        if (j == 0) break
        i = j; continue
      }
      if (c == "$" && substr(s, i + 1, 1) == "\"") { i++; continue }   # $"…" = 큰따옴표(로캘 번역 문자열)
      if (c == "$" && substr(s, i + 1, 1) == "{") {             # ${…} — 안의 «#» 는 주석이 아니다(${MSG:- #none})
        j = findch(s, i + 2, n, "}")
        if (j == 0) { out = out substr(s, i); break }
        out = out substr(s, i, j - i + 1); i = j + 1; continue
      }
      if (c == "$" && substr(s, i + 1, 1) == "\047") {          # $'"'"'…'"'"' (ANSI-C) — 안의 백슬래시 따옴표는 닫는 따옴표가 아니다
        buf = ""; j = i + 2; closed = 0
        while (j <= n) {
          c = substr(s, j, 1)
          if (c == "\\") { buf = buf substr(s, j + 1, 1); j += 2; continue }
          if (c == "\047") { closed = 1; break }
          buf = buf c; j++
        }
        if (!closed) { out = out " " buf; break }
        i = j + 1
        out = out quoted(buf, out, depth); continue
      }
      if (c == "\047") {                                          # 작은따옴표 — 치환 없이 글자 그대로
        j = findch(s, i + 1, n, "\047")
        if (j == 0) { out = out substr(s, i + 1); break }         # 짝 없음 — 나머지를 그대로 본다(fail-safe)
        buf = substr(s, i + 1, j - i - 1); i = j + 1
        out = out quoted(buf, out, depth); continue
      }
      if (c == "\"") {                                            # 큰따옴표 — 안쪽 $(…) · `…` 는 명령
        buf = ""; i++; closed = 0
        while (i <= n) {
          j = findre(s, i, n, "[\\\\\"$`]")
          if (j == 0) { buf = buf substr(s, i); i = n + 1; break }
          if (j > i) { buf = buf substr(s, i, j - i); i = j }
          c = substr(s, i, 1)
          if (c == "\\") { buf = buf substr(s, i + 1, 1); i += 2; continue }
          if (c == "\"") { i++; closed = 1; break }
          if (c == "$" && substr(s, i + 1, 1) == "(" && substr(s, i + 2, 1) != "(") {
            j = matchparen(s, i + 1); inner = substr(s, i + 2, j - i - 2)
            r = scan(inner, depth + 1); INNERS = INNERS "\n" r; buf = buf "SUBST"; i = j + 1; continue
          }
          if (c == "`") {
            j = findch(s, i + 1, n, "`")
            if (j == 0) { buf = buf substr(s, i + 1); i = n + 1; break }
            inner = substr(s, i + 1, j - i - 1)
            r = scan(inner, depth + 1); INNERS = INNERS "\n" r; buf = buf "SUBST"; i = j + 1; continue
          }
          buf = buf c; i++
        }
        if (!closed) { out = out " " buf; break }                 # 짝 없음 — 나머지를 그대로 본다(fail-safe)
        out = out quoted(buf, out, depth); continue
      }
      if (c == "$" && substr(s, i + 1, 1) == "(" && substr(s, i + 2, 1) != "(") {
        j = matchparen(s, i + 1); inner = substr(s, i + 2, j - i - 2)
        r = scan(inner, depth + 1); INNERS = INNERS "\n" r; out = out " SUBST "; i = j + 1; continue
      }
      if (c == "`") {
        j = findch(s, i + 1, n, "`")
        if (j == 0) { out = out substr(s, i + 1); break }
        inner = substr(s, i + 1, j - i - 1)
        r = scan(inner, depth + 1); INNERS = INNERS "\n" r; out = out " SUBST "; i = j + 1; continue
      }
      out = out c; i++
    }
    return out
  }
  BEGIN { RS = "\003" }
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
  # production workflow 수동 실행(dispatch) — 그 ref 가 prod 서버에 그대로 배포된다
  if [[ "$low" =~ /actions/workflows/[^[:space:]]*production[^[:space:]]*/dispatches ]]; then
    block "production workflow 수동 실행(dispatch) 차단 — 그 ref 가 prod 서버에 바로 배포됩니다. prod 브랜치 승격 경로(nomacomfe-prod-push-check)로."
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
  fi
}

check_segment() { # $1 = 세그먼트(정리한 글)
  local seg="$1" s rest
  [[ "$seg" =~ [^[:space:]] ]] || return
  # 볼 명령 이름이 하나도 없으면 정규식 전에 끝(글롭 비교는 큰 입력에서도 빠르다)
  [[ "$seg" == *git* || "$seg" == *"gh "* || "$seg" == *docker* || "$seg" == *aws* || "$seg" == *api.github.com* ]] || return
  # git 전역 옵션은 쪼개기 전에 글 전체에서 한 번에 걷었다(아래 GITOPTS) · -c remote.*.push 는 그 전에 따로 봤다
  s="$seg"

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
    [[ "$s" =~ [[:space:]]--input([[:space:]=]|$) || "$s" =~ [[:space:]](-[fF]|--field|--raw-field)([[:space:]]*|=)[a-zA-Z_]+=@ ]] && HAS_INPUT_API=1
    [[ "$s" =~ [[:space:]/]graphql([[:space:]]|$) ]] && HAS_GRAPHQL_API=1
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
      wf="$tok"; break
    done
    case "$wf" in
      ci|ci.yml|design-system-publish|design-system-publish.yml) : ;;
      *) block "workflow 수동 실행 차단 — production workflow 는 그 ref(기본 dev)를 prod 서버에 바로 배포합니다(이름 · ID · 변수로 가릴 수 없어 ci · design-system-publish 외 전부). prod 브랜치 승격 경로(nomacomfe-prod-push-check)로." ;;
    esac
  fi

  # curl · wget · http 로 GitHub API 를 직접 불러 ref 를 바꾸기(gh api 와 같은 일)
  if [[ "$s" =~ (^|[[:space:]/!{])(curl|wget|http|https)[[:space:]] && "$s" == *api.github.com* ]] &&
    [[ "$s" =~ refs/heads/prod([^[:alnum:]_.-]|$) || "$s" =~ /branches/prod(/|[^[:alnum:]_.-]|$) || "$s" =~ /merges([^[:alnum:]_-]|$) || "$s" == *" PRODREF"* ]]; then
    block "GitHub API 직접 호출로 prod ref · 머지 변경 차단 — git push 와 동등한 배포 트리거입니다. 사용자 명시 승인 필요."
  fi

  # --- 나머지 파괴적 명령 — 사이에 옵션 · 하위 명령이 껴도(docker image push · buildx --push · reset -q --hard · aws --profile … ssm) ---
  # docker: push 는 하위 명령 자리에서만(docker exec … git push 는 docker push 가 아니다) · buildx 는 --push · type=registry · push=true
  local re_docker='(^|[[:space:]/!{])docker([[:space:]]+(--(context|host|config|log-level|tlscacert|tlscert|tlskey)[[:space:]]+[^[:space:]]+|-(H|c|l)[[:space:]]+[^[:space:]]+|-[^[:space:]]+))*[[:space:]]+((image|manifest|trust)[[:space:]]+([^[:space:]]+[[:space:]]+)*|compose[[:space:]]+(-[^[:space:]]+[[:space:]]+)*)?push([[:space:]]|$)'
  local re_buildx='(^|[[:space:]/!{])docker[[:space:]](.*[[:space:]])?(buildx|builder|build)[[:space:]](.*[[:space:],=])?(--push|type=registry|push=true)([[:space:],=]|$)'
  local re_reset='(^|[[:space:]/!{])git[[:space:]]+reset([[:space:]].*)?[[:space:]]Q?--(ha|har|hard)([[:space:]]|$)'
  local re_ssm='(^|[[:space:]/!{])aws[[:space:]](.*[[:space:]])?ssm[[:space:]]+(put-parameter|delete-parameter|delete-parameters)([[:space:]]|$)'
  if [[ "$s" =~ $re_docker || "$s" =~ $re_buildx ]]; then
    block "수동 docker push 금지. 배포는 GitHub Actions(prod 브랜치 push)로 트리거 — nomacom-admin / nomacom-client 이미지는 .github/workflows/*-production.yml 이 빌드."
  fi
  if [[ "$s" =~ $re_reset ]]; then
    block "git reset --hard 차단. 잃을 수 있는 작업 확인 후 사용자 승인 받으세요."
  fi
  if [[ "$s" =~ $re_ssm ]]; then
    block "SSM 변경 차단. 시크릿 변경은 콘솔 또는 사용자 명시 승인 필요 (.claude/rules/ssm-paths.md)."
  fi
}

FAIL_MSG="guard 훅의 판정 도구(awk · sed)가 실패해 판정할 수 없습니다 — fail-closed 로 차단합니다."
# 1) heredoc 본문(데이터) 걷기 · 2) 줄 이음(\ + 줄바꿈)만 합치기(이음 자리는 \001 — 주석은 거기서 끝난다) · 탭 → 공백 · 3) 따옴표 스캐너 · 4) 명령 경계로 쪼개기
text=$(printf '%s' "$cmd" | heredoc_split text | tr '\r' ' ' | awk '{ sub(/[[:space:]]+$/, ""); if (sub(/\\$/, "")) printf "%s\001", $0; else print }' | tr '\t' ' ')
[[ "$cmd" =~ [^[:space:]] && ! "$text" =~ [^[:space:]] ]] && block "$FAIL_MSG"
# ⭐ fail-closed — 스캐너(awk)가 죽으면(중첩 한계 · 문법 오류) 빈 글로 통과시키지 않는다
clean=$(printf '%s' "$text" | scan_shell) || block "$FAIL_MSG"
# 공백 여럿은 하나로(git reset  --hard · docker  push)
clean=$(printf '%s' "$clean" | tr -s ' ')
# 걷어 낸 heredoc 본문 — gh api --input · -F x=@- 판정에만 쓴다(명령으로는 보지 않는다)
bodies_raw=$(printf '%s' "$cmd" | heredoc_split bodies) || block "$FAIL_MSG"
bodies=$(printf '%s' "$bodies_raw" | tr '\r\n\t' '   ')
HAS_INPUT_API=0
HAS_GRAPHQL_API=0
# -c remote.<x>.push=… 판정은 전역 옵션을 걷기 전 글로 — 세그먼트마다(포크 없이)
while IFS= read -r seg; do
  if [[ "$seg" == *git* && "$seg" =~ (^|[[:space:]/])git[[:space:]] && "$seg" =~ [[:space:]]push([[:space:]]|$) && "$seg" =~ remote\.[^[:space:]=]+\.(push|mirror)=[^[:space:]]*(prod|\*|true) ]]; then
    block "$PROD_MSG"
  fi
done <<< "$(printf '%s\n' "$clean" | awk '{gsub(/[0-9]*>&[0-9]*-?|&>>?|<&[0-9]*-?/, " REDIR "); gsub(/&&|\|\||[;|()&]/, "\n"); print}')"
# ⭐ git 과 서브커맨드 사이 전역 옵션을 걷는다(git -C <Orca 워크트리> push … 가 일상 형태) — 따옴표 든 값은 스캐너가 Q 로 바꿨다
GITOPTS='s/(^|[[:space:]/!{])git(([[:space:]]+(-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--super-prefix|--config-env|--attr-source)([[:space:]]+|=)[^[:space:]]+)|([[:space:]]+(--no-pager|-P|--paginate|-p|--bare|--no-replace-objects|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs|--no-optional-locks|--no-lazy-fetch|--no-advice)))+/\1git/g'
segs=$(printf '%s\n' "$clean" | sed -E "$GITOPTS") || block "$FAIL_MSG"
segs=$(printf '%s\n' "$segs" | awk '{gsub(/[0-9]*>&[0-9]*-?|&>>?|<&[0-9]*-?/, " REDIR "); gsub(/&&|\|\||[;|()&]/, "\n"); print}') || block "$FAIL_MSG"
while IFS= read -r seg; do
  check_segment "$seg"
done <<< "$segs"
# 같은 명령 안에서 heredoc 으로 쓴 스크립트를 실행하면(cat > p.sh <<EOF … EOF; bash p.sh · . p.sh · ./p.sh) 그 본문도 명령이다
re_run='(^|[[:space:];&|(!{])((bash|sh|zsh|dash|ksh|source|\.)([[:space:]]+-[^[:space:]]+)*[[:space:]]+[^[:space:]-]|\.?\.?/[^[:space:]]*\.(sh|bash|zsh)([[:space:]]|$))'
if [[ -n "$bodies_raw" && "$clean" =~ $re_run ]]; then
  bclean=$(printf '%s' "$bodies_raw" | scan_shell) || block "$FAIL_MSG"
  bsegs=$(printf '%s\n' "$bclean" | tr -s ' ' | sed -E "$GITOPTS") || block "$FAIL_MSG"
  bsegs=$(printf '%s\n' "$bsegs" | awk '{gsub(/[0-9]*>&[0-9]*-?|&>>?|<&[0-9]*-?/, " REDIR "); gsub(/&&|\|\||[;|()&]/, "\n"); print}') || block "$FAIL_MSG"
  while IFS= read -r seg; do
    check_segment "$seg"
  done <<< "$bsegs"
fi

flat=$(printf '%s %s' "$clean" "$bodies" | tr '\n' ' ')
# 표준 입력 · heredoc 으로 JSON 을 넘기는 gh api(--input) — 정리한 글 어디든 prod ref 가 보이면 막는다
if (( HAS_INPUT_API )) &&
  [[ "$flat" == *" PRODREF"* || "$flat" =~ refs/heads/prod([^[:alnum:]_.-]|$) || "$flat" =~ \"?(ref|base|branch|new_name)\"?[[:space:]]*:[[:space:]]*\"?(refs/heads/)?prod([^[:alnum:]_.-]|$) ]]; then
  block "gh api --input 으로 prod ref 변경 차단 — git push 와 동등한 배포 트리거입니다. 사용자 명시 승인 필요."
fi
# 표준 입력 · heredoc 으로 넘긴 JSON 의 force(ref 되감기 — echo '{"sha":"…","force":true}' | gh api -X PATCH …/refs/heads/x --input -)
if (( HAS_INPUT_API )) && [[ "$flat" == *refs/heads/* ]] &&
  [[ "$flat" == *" JSONFORCE"* || "$flat" =~ force\"?[[:space:]]*:[[:space:]]*true ]]; then
  block "gh api 로 ref 를 force 이동하는 것은 차단합니다 — 배포를 되돌리고 커밋이 소실됩니다. 정말 필요하면 사용자 명시 승인을 받으세요."
fi
# heredoc · 표준 입력으로 넘긴 graphql 쿼리(--input · -F query=@-) — 본문의 mutation(따옴표 표식이든 맨 글자든)
if (( HAS_GRAPHQL_API && HAS_INPUT_API )) &&
  [[ "$flat" == *" GQLMUT"* || "$flat" =~ (createRef|updateRef|updateRefs|deleteRef|mergeBranch|mergePullRequest|createCommitOnBranch) ]]; then
  block "gh api graphql 의 ref 변경 · 머지 mutation 차단 — 대상(prod 여부)을 판정할 수 없습니다. REST(gh api …/git/refs/heads/<브랜치>)로 이름을 적어서 하세요."
fi

exit 0
