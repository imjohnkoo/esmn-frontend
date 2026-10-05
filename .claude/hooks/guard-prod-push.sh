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
#    알고 두는 오탐(안전 쪽): 닫는 줄 없는 heredoc 본문의 명령 글자 · gh api 판정이 세그먼트를 넘어 섞이는 경우.
#    성능: 따옴표가 적은 수백 KB 는 1초 안팎, 따옴표 · 특수 글자가 아주 많은 수백 KB 는 수 초~수십 초(awk 부분 문자열 복사).
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

# ⭐ heredoc 본문은 «데이터» 라 판정에서 뺀다.
# 커밋 메시지·문서를 heredoc 으로 넘길 때 그 안의 명령 «예시» 가 실행으로 오인된다.
# 단, heredoc 을 셸/인터프리터 · gh api 가 먹으면 그건 실행 · 입력이므로 그 경우엔 본문을 남긴다.
# 시작 줄 판정은 따옴표 밖의 «<<» 만(커밋 메시지 안 «<<EOF» 글자로 뒤 줄을 삼키지 않게) · 구분자는 «-» «.» · «\EOF» 허용 · «<<<» 는 아니다.
#   $2 = bodies 면 걷어 낸 본문만 낸다(gh api --input · -F x=@- 판정용 — 명령으로는 보지 않는다)
#   ⭐ 2026-10-05 (QA ⑥ 4회차): ① 구분자 줄이 끝내 안 나오면 heredoc 이 아니었던 것으로 보고 본문을 되살린다
#      (커밋 메시지 안 «<<EOF» 글자 · $((x<<y)) · 파이썬 «1 << bits» 가 뒤 줄을 삼키지 않게)
#   ② 셸(bash · sh · zsh · eval …)이 먹는 본문은 그대로 · 다른 인터프리터(python · node …) 본문은 짝이 안 맞는 줄만 따옴표 · 백틱을 지워 남긴다
#      («// don't» 같은 짝 없는 따옴표가 heredoc 밖 줄까지 따옴표 안으로 끌고 가지 않게 — 짝이 맞는 문자열은 값이라 그대로)
#   ③ gh api 가 먹는 본문은 입력 데이터 — 명령으로 보지 않고 bodies 로만 넘긴다 ④ 인터프리터 이름은 단어 경계로(evaluation.md · node-22 오탐 0)
strip_heredoc_bodies() {
  local line delim="" indoc=0 out="" body="" bodies="" trimmed probe mode="${2:-text}" q1 q2 q3
  local re_start='(^|[^<])<<-?[[:space:]]*\\?['\''"]?([A-Za-z_][A-Za-z0-9_.-]*)['\''"]?'
  local re_sh='(^|[[:space:]/|;&(!{])(bash|sh|zsh|dash|ksh|eval)([[:space:]<]|$)'
  local re_interp='(^|[[:space:]/|;&(!{])(python[0-9.]*|node|nodejs|deno|bun|ruby|perl|php|osascript)([[:space:]<]|$)'
  local re_ghapi='(^|[[:space:]/|;&(!{])gh[[:space:]]+api([[:space:]]|$)'
  # «<<» 가 하나도 없으면 그대로(긴 한 줄에서 bash 글롭 · 접미 제거가 느려지는 것을 피한다 — 정규식은 선형)
  if ! [[ "$1" =~ \<\< ]]; then [[ "$mode" == bodies ]] || printf '%s' "$1"; return; fi
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ $'\r'$ ]] && line="${line:0:$((${#line} - 1))}"
    if (( indoc )); then
      trimmed="${line#"${line%%[![:space:]]*}"}"
      trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
      if [[ "$trimmed" == "$delim" ]]; then
        (( indoc == 2 )) && out+="$line"$'\n'
        (( indoc == 1 )) && bodies+="$body"
        indoc=0; body=""
      elif (( indoc == 2 )); then
        # 짝이 맞는 따옴표는 그대로(print("git push origin prod") 같은 문자열은 값이다) — 짝이 안 맞는 줄만 따옴표를 지운다
        q1="${line//[^\']/}"; q2="${line//[^\"]/}"; q3="${line//[^\`]/}"
        if (( ${#q1} % 2 || ${#q2} % 2 || ${#q3} % 2 )); then out+="${line//[\'\"\`]/}"$'\n'; else out+="$line"$'\n'; fi
      else
        body+="$line"$'\n'
      fi
      continue
    fi
    # «<<» 가 없는 줄은 볼 것이 없다(줄마다 sed 를 띄우지 않게 — 큰 스크립트 성능)
    if ! [[ "$line" =~ \<\< ]]; then out+="$line"$'\n'; continue; fi
    # 구분자 따옴표를 먼저 벗기고(<<'EOF' → <<EOF), 그다음 완결된 따옴표 문자열만 지운다(줄을 넘는 "$(cat <<'EOF' 는 남는다)
    probe=$(printf '%s' "$line" | sed -E \
      -e "s/<<(-?)[[:space:]]*\\\\?['\"]([A-Za-z_][A-Za-z0-9_.-]*)['\"]/<<\\1\\2/g" \
      -e "s/'[^']*'//g" -e 's/"([^"\\]|\\.)*"//g')
    if [[ "$probe" =~ $re_start ]]; then
      delim="${BASH_REMATCH[2]}"
      if [[ "$probe" =~ $re_sh ]]; then
        :                       # 셸이 먹는 본문 = 명령 — 그대로 본다
      elif [[ "$probe" =~ $re_interp ]]; then
        indoc=2                 # 다른 인터프리터 — 따옴표를 지우고 본다
      else
        indoc=1                 # 데이터(cat > 파일 · 커밋 메시지 · gh api 입력) — 걷는다
      fi
    fi
    out+="$line"$'\n'
  done <<< "$1"
  # 구분자가 끝내 없었다 = heredoc 이 아니었다 — 걷던 줄을 되살린다
  (( indoc == 1 )) && out+="$body"
  if [[ "$mode" == bodies ]]; then printf '%s' "$bodies"; else printf '%s' "$out"; fi
}

# 따옴표를 아는 스캐너 — 정리한 글 다음에 뽑아 낸 명령($(…) · `…` · bash -c · eval)을 줄로 잇는다
scan_shell() {
  awk '
  # $(…) 의 짝 «)» — 안쪽 따옴표 · 백슬래시는 건너뛴다(따옴표 안의 «)» 로 일찍 닫히지 않게)
  function matchparen(s, p,   lvl, k, ch, n, j) {
    lvl = 0; n = length(s)
    for (k = p; k <= n; k++) {
      ch = substr(s, k, 1)
      if (ch == "\\") { k++; continue }
      if (ch == "\047") { j = index(substr(s, k + 1), "\047"); if (j == 0) return n + 1; k += j; continue }
      if (ch == "\"") {
        for (k++; k <= n; k++) { ch = substr(s, k, 1); if (ch == "\\") { k++; continue } if (ch == "\"") break }
        continue
      }
      if (ch == "(") lvl++
      else if (ch == ")") { lvl--; if (lvl == 0) return k }
    }
    return n + 1
  }
  function quoted(buf, before, depth,   t, mid, r, gm, tail, L) {
    # 앞 글은 끝 256자만 본다 — 따옴표마다 앞 글 전체에 정규식을 돌리면 큰 입력에서 제곱으로 느려진다
    L = length(before); tail = (L > 256) ? substr(before, L - 255) : before
    # 문자열을 명령으로 받는 것 — bash/sh -c(앞에 -o pipefail · -O extglob · --login · 묶음 옵션 · 뒤에 -- 가 껴도) · eval ·
    #   watch · flock … -c · env -S. 따로 뽑아 다시 본다
    if (depth < 3 && tail ~ /(^|[^[:alnum:]_])((bash|sh|zsh|dash|ksh)([[:space:]]+[^[:space:];&|]+)*[[:space:]]+-[[:alnum:]]*c[[:alnum:]]*([[:space:]]+--)?|eval|watch([[:space:]]+[^[:space:];&|]+)*|flock([[:space:]]+[^[:space:];&|]+)*[[:space:]]+-c|env([[:space:]]+[^[:space:];&|]+)*[[:space:]]+-S)[[:space:]]*$/) {
      r = scan(buf, depth + 1); INNERS = INNERS "\n" r
      return " SUBST "
    }
    # 표식을 먼저 단다 — 공백 없이 줄인(minified) graphql · JSON 도 잡히게(QA ⑥ 4회차 M1)
    gm = ""
    if (buf ~ /(createRef|updateRef|updateRefs|deleteRef|mergeBranch|mergePullRequest)/) gm = gm " GQLMUT"
    if (buf ~ /(createPullRequest|updatePullRequest)/ && buf ~ /(baseRefName|base)[^[:alnum:]]*(refs\/heads\/)?prod([^[:alnum:]_-]|$)/) gm = gm " GQLPRBASE"
    if (buf ~ /force"?[[:space:]]*:[[:space:]]*true/) gm = gm " JSONFORCE"
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
      if (match(substr(s, i), /[\\#$\047"`]/)) {
        if (RSTART > 1) { out = out substr(s, i, RSTART - 1); i = i + RSTART - 1 }
      } else { out = out substr(s, i); break }
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
        if (match(substr(s, i), /[\n\001]/) == 0) break
        i = i + RSTART - 1; continue
      }
      if (c == "$" && substr(s, i + 1, 1) == "{") {             # ${…} — 안의 «#» 는 주석이 아니다(${MSG:- #none})
        j = index(substr(s, i + 2), "}")
        if (j == 0) { out = out substr(s, i); break }
        out = out substr(s, i, j + 2); i = i + j + 2; continue
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
        j = index(substr(s, i + 1), "\047")
        if (j == 0) { out = out substr(s, i + 1); break }         # 짝 없음 — 나머지를 그대로 본다(fail-safe)
        buf = substr(s, i + 1, j - 1); i = i + j + 1
        out = out quoted(buf, out, depth); continue
      }
      if (c == "\"") {                                            # 큰따옴표 — 안쪽 $(…) · `…` 는 명령
        buf = ""; i++; closed = 0
        while (i <= n) {
          if (match(substr(s, i), /[\\"$`]/)) {
            if (RSTART > 1) { buf = buf substr(s, i, RSTART - 1); i = i + RSTART - 1 }
          } else { buf = buf substr(s, i); i = n + 1; break }
          c = substr(s, i, 1)
          if (c == "\\") { buf = buf substr(s, i + 1, 1); i += 2; continue }
          if (c == "\"") { i++; closed = 1; break }
          if (c == "$" && substr(s, i + 1, 1) == "(" && substr(s, i + 2, 1) != "(") {
            j = matchparen(s, i + 1); inner = substr(s, i + 2, j - i - 2)
            r = scan(inner, depth + 1); INNERS = INNERS "\n" r; buf = buf "SUBST"; i = j + 1; continue
          }
          if (c == "`") {
            j = index(substr(s, i + 1), "`")
            if (j == 0) { buf = buf substr(s, i + 1); i = n + 1; break }
            inner = substr(s, i + 1, j - 1)
            r = scan(inner, depth + 1); INNERS = INNERS "\n" r; buf = buf "SUBST"; i = i + j + 1; continue
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
        j = index(substr(s, i + 1), "`")
        if (j == 0) { out = out substr(s, i + 1); break }
        inner = substr(s, i + 1, j - 1)
        r = scan(inner, depth + 1); INNERS = INNERS "\n" r; out = out " SUBST "; i = i + j + 1; continue
      }
      out = out c; i++
    }
    return out
  }
  { ALL = ALL (NR > 1 ? "\n" : "") $0 }
  END { INNERS = ""; RES = scan(ALL, 0); gsub(/\001/, " ", RES); gsub(/\001/, " ", INNERS); printf "%s\n%s\n", RES, INNERS }
  '
}

PROD_MSG="prod 푸시 차단 — admin/client production 배포가 즉시 트리거됩니다. nomacomfe-prod-push-check 스킬로 pre-flight 를 마치고 사용자 명시 승인을 받으세요."

check_git_push() { # $1 = «git push» 뒤 인자(스캐너가 정리한 글)
  local args=" $1 "
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
  case "$args" in
    *" --mirror"*|*" --all"*|*" --branches"*)
      block "git push --mirror / --all 차단 — prod 를 포함한 여러 ref 를 한꺼번에 밉니다. 필요한 브랜치만 이름으로 push 하세요." ;;
  esac
  if [[ "$args" == *"*"* ]]; then
    block "글롭 refspec(*) push 차단 — prod 까지 함께 밀 수 있습니다. 필요한 브랜치만 이름으로 push 하세요."
  fi
  # ⭐ prod 는 막는다 (m8-frontend 와 다른 지점) — prod push = admin/client production 즉시 배포.
  # ⚠️ 단어 경계 — feat/product-detail · fix/reproduce-issue · imjohnkoo/prod-x · x/prod 는 통과.
  #    목적지 = bare «prod» · «heads/prod» · «refs/heads/prod» — 앞은 공백 · «:» · «+» · 따옴표, 뒤는 따옴표 · 공백 · 리다이렉트 · 끝
  if [[ "$args" =~ (^|[[:space:]:+\'\"])(refs/)?(heads/)?prod[\'\"]?([[:space:]\<\>#]|$) ]]; then
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
  # graphql 엔드포인트는 읽기 쿼리도 필드로 POST 한다 — REST 판정에서 빼고 아래 mutation 표식으로만 본다
  local is_graphql=0
  [[ "$s" =~ [[:space:]/]graphql([[:space:]]|$) ]] && is_graphql=1
  # prod 를 가리키는 것: ref 경로 · ref= · base= · new_name= · branch=(contents PUT 은 prod 에 직접 커밋 · merge-upstream) · /branches/prod
  if (( ! is_graphql )) && [[ "$s" =~ refs/heads/prod([^[:alnum:]_.-]|$) || "$s" =~ (ref|new_name|base|branch)=(refs/heads/)?prod([^[:alnum:]_.-]|$) || "$s" =~ /branches/prod(/|[^[:alnum:]_.-]|$) ]]; then
    local write=0
    if [[ "$low" =~ (-x|--method)[[:space:]=]*(patch|post|put|delete) ]]; then
      write=1
    elif ! [[ "$low" =~ (-x|--method)[[:space:]=]*get([^[:alnum:]]|$) ]] &&
      [[ "$s" =~ [[:space:]]-[fF][^[:space:]]*[[:space:]] || "$s" =~ [[:space:]](--field|--raw-field|--input)([[:space:]=]|$) ]]; then
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
  [[ "$seg" == *git* || "$seg" == *"gh "* || "$seg" == *docker* || "$seg" == *aws* ]] || return
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

  # --- gh api · gh pr · gh workflow (세그먼트 어디든) ---
  if [[ "$s" =~ (^|[[:space:]/!{])gh[[:space:]]+api([[:space:]].*)?$ ]]; then
    check_gh_api "gh api${BASH_REMATCH[2]}"
    [[ "$s" =~ [[:space:]]--input([[:space:]=]|$) || "$s" =~ [[:space:]]-[fF][[:space:]]*[a-zA-Z_]+=@ ]] && HAS_INPUT_API=1
    [[ "$s" =~ [[:space:]/]graphql([[:space:]]|$) ]] && HAS_GRAPHQL_API=1
  fi
  # workflow run 재실행 — production run 을 다시 돌리면 재배포(옛 run 이면 되감기). ID 로는 가릴 수 없어 전부
  if [[ "$s" =~ (^|[[:space:]/!{])gh[[:space:]]+run[[:space:]]+rerun([[:space:]]|$) ]]; then
    block "gh run rerun 차단 — production run 재실행은 그 커밋을 prod 에 다시 배포합니다(옛 run 이면 되감기). CI 재실행이 필요하면 사용자에게 run 을 확인받으세요."
  fi
  if [[ "$s" =~ (^|[[:space:]/!{])gh[[:space:]]+pr[[:space:]]+(create|new|edit)([[:space:]].*)?$ ]]; then
    if [[ " ${BASH_REMATCH[3]} " =~ [[:space:]](Q?--base[[:space:]=]+|-B[[:space:]=]*)prod([[:space:]]|$) ]]; then
      block "prod 를 base 로 하는 PR 차단 — 머지하면 prod 가 바로 배포됩니다. PR base 는 dev, 승격은 nomacomfe-prod-push-check 뒤 사용자 승인으로."
    fi
  fi
  # workflow 수동 실행 — 배포가 아닌 것(ci · design-system-publish)만 이름으로 허용. 변수 · ID · 표시 이름 · production 은 막는다
  if [[ "$s" =~ (^|[[:space:]/!{])gh[[:space:]]+workflow[[:space:]]+(run|r)([[:space:]]+(.*))?$ ]]; then
    local wf="" tok
    for tok in ${BASH_REMATCH[4]}; do [[ "$tok" == -* ]] && continue; wf="$tok"; break; done
    case "$wf" in
      ci|ci.yml|design-system-publish|design-system-publish.yml) : ;;
      *) block "workflow 수동 실행 차단 — production workflow 는 그 ref(기본 dev)를 prod 서버에 바로 배포합니다(이름 · ID · 변수로 가릴 수 없어 ci · design-system-publish 외 전부). prod 브랜치 승격 경로(nomacomfe-prod-push-check)로." ;;
    esac
  fi

  # --- 나머지 파괴적 명령 — 사이에 옵션 · 하위 명령이 껴도(docker image push · buildx --push · reset -q --hard · aws --profile … ssm) ---
  local re_docker='(^|[[:space:]/!{])docker[[:space:]](.*[[:space:]])?(push|--push)([[:space:]=]|$)'
  local re_reset='(^|[[:space:]/!{])git[[:space:]]+reset([[:space:]].*)?[[:space:]]--hard([[:space:]]|$)'
  local re_ssm='(^|[[:space:]/!{])aws[[:space:]](.*[[:space:]])?ssm[[:space:]]+(put-parameter|delete-parameter|delete-parameters)([[:space:]]|$)'
  if [[ "$s" =~ $re_docker ]]; then
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
text=$(strip_heredoc_bodies "$cmd" | tr '\r' ' ' | awk '{ sub(/[[:space:]]+$/, ""); if (sub(/\\$/, "")) printf "%s\001", $0; else print }' | tr '\t' ' ')
[[ "$cmd" =~ [^[:space:]] && ! "$text" =~ [^[:space:]] ]] && block "$FAIL_MSG"
# ⭐ fail-closed — 스캐너(awk)가 죽으면(중첩 한계 · 문법 오류) 빈 글로 통과시키지 않는다
clean=$(printf '%s' "$text" | scan_shell) || block "$FAIL_MSG"
# 공백 여럿은 하나로(git reset  --hard · docker  push)
clean=$(printf '%s' "$clean" | tr -s ' ')
# 걷어 낸 heredoc 본문 — gh api --input · -F x=@- 판정에만 쓴다(명령으로는 보지 않는다)
bodies=$(strip_heredoc_bodies "$cmd" bodies | tr '\r\n\t' '   ')
HAS_INPUT_API=0
HAS_GRAPHQL_API=0
# -c remote.<x>.push=… 판정은 전역 옵션을 걷기 전 글로 — 세그먼트마다(포크 없이)
while IFS= read -r seg; do
  if [[ "$seg" == *git* && "$seg" =~ (^|[[:space:]/])git[[:space:]] && "$seg" =~ [[:space:]]push([[:space:]]|$) && "$seg" =~ remote\.[^[:space:]=]+\.(push|mirror)=[^[:space:]]*(prod|\*|true) ]]; then
    block "$PROD_MSG"
  fi
done <<< "$(printf '%s\n' "$clean" | awk '{gsub(/&&|\|\||[;|()&]/, "\n"); print}')"
# ⭐ git 과 서브커맨드 사이 전역 옵션을 걷는다(git -C <Orca 워크트리> push … 가 일상 형태) — 따옴표 든 값은 스캐너가 Q 로 바꿨다
GITOPTS='s/(^|[[:space:]/!{])git(([[:space:]]+(-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--super-prefix|--config-env|--attr-source)([[:space:]]+|=)[^[:space:]]+)|([[:space:]]+(--no-pager|-P|--paginate|-p|--bare|--no-replace-objects|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs|--no-optional-locks|--no-lazy-fetch|--no-advice)))+/\1git/g'
segs=$(printf '%s\n' "$clean" | sed -E "$GITOPTS") || block "$FAIL_MSG"
segs=$(printf '%s\n' "$segs" | awk '{gsub(/&&|\|\||[;|()&]/, "\n"); print}') || block "$FAIL_MSG"
while IFS= read -r seg; do
  check_segment "$seg"
done <<< "$segs"

flat=$(printf '%s %s' "$clean" "$bodies" | tr '\n' ' ')
# 표준 입력 · heredoc 으로 JSON 을 넘기는 gh api(--input) — 정리한 글 어디든 prod ref 가 보이면 막는다
if (( HAS_INPUT_API )) &&
  [[ "$flat" =~ refs/heads/prod([^[:alnum:]_.-]|$) || "$flat" =~ \"?(ref|base|new_name)\"?[[:space:]]*:[[:space:]]*\"?(refs/heads/)?prod([^[:alnum:]_.-]|$) ]]; then
  block "gh api --input 으로 prod ref 변경 차단 — git push 와 동등한 배포 트리거입니다. 사용자 명시 승인 필요."
fi
# 표준 입력 · heredoc 으로 넘긴 JSON 의 force(ref 되감기 — echo '{"sha":"…","force":true}' | gh api -X PATCH …/refs/heads/x --input -)
if (( HAS_INPUT_API )) && [[ "$flat" == *refs/heads/* ]] &&
  [[ "$flat" == *" JSONFORCE"* || "$flat" =~ force\"?[[:space:]]*:[[:space:]]*true ]]; then
  block "gh api 로 ref 를 force 이동하는 것은 차단합니다 — 배포를 되돌리고 커밋이 소실됩니다. 정말 필요하면 사용자 명시 승인을 받으세요."
fi
# heredoc · 표준 입력으로 넘긴 graphql 쿼리(--input · -F query=@-) — 본문의 mutation(따옴표 표식이든 맨 글자든)
if (( HAS_GRAPHQL_API && HAS_INPUT_API )) &&
  [[ "$flat" == *" GQLMUT"* || "$flat" =~ (createRef|updateRef|updateRefs|deleteRef|mergeBranch|mergePullRequest) ]]; then
  block "gh api graphql 의 ref 변경 · 머지 mutation 차단 — 대상(prod 여부)을 판정할 수 없습니다. REST(gh api …/git/refs/heads/<브랜치>)로 이름을 적어서 하세요."
fi

exit 0
