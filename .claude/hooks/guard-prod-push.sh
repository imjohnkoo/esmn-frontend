#!/usr/bin/env bash
# Block prod-affecting commands. Returns block decision via JSON to Claude Code.
#
# ⭐ 2026-09-02 개정 (프로세스 v2 이식 W0-4). 이전 판은 29줄 substring 매칭이었고
#    문서(CLAUDE.md · rules/claude-code-assets.md)가 «prod push / aws ssm put 차단» 이라
#    기술하는데 실제로는 **둘 다 없었다**. 문서를 믿고 행동하면 안 막히는 상태였다.
#    m8-frontend 의 판정 로직(세그먼트 분리 · 단어 경계 · heredoc 제외 · fail-closed)을
#    이식하되, **prod 차단은 유지**한다 — m8 은 게이트를 Dockerfile 로 옮겨서 해제했지만
#    nomacom 은 Dockerfile 게이트가 없고 prod push = 즉시 CodeDeploy 배포다.
# ⭐ 2026-10-05 개정 (구멍 · 오탐 수정 — QA ⑥ 두 회차).
#    - 목적지 «refs/heads/prod» · «heads/prod» · 따옴표 · «+» 접두 · 리다이렉트가 붙은 prod 를 잡는다
#    - force 3형태(--force · -f 묶음 · «+refspec») · --mirror · --all · 글롭 refspec 을 막는다
#    - gh api 쓰기 = 메서드(대소문자 무관) 또는 필드(-f · -F · --field · --raw-field · --input — 붙여 쓴 -fx=y 포함)
#      대상 = refs/heads/prod · ref= · new_name= · base= prod · branches/prod · production workflow dispatch
#    - prod base PR(gh pr create · new · edit) · gh workflow run *-production · graphql ref · 머지 mutation
#    - 판정은 «명령 자리»(세그먼트의 첫 명령)에서만 — grep · echo · git commit -m 인자 안의 글자로 막지 않는다
#    - 줄바꿈도 명령 경계 · $(…) · `…` 안쪽은 따로 떼어 본다 · bash -c · eval 은 안쪽을 다시 본다
#    못 보는 길(실수 방지용이지 악의적 우회 방어선이 아니다): 변수에 담은 목적지(git push $DST) ·
#    원격 upstream 설정 · gh pr merge · refId 만 쓰는 graphql updateRef · ID 로 부르는 workflow dispatch.
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
# 단, heredoc 을 셸/인터프리터가 먹으면 그건 실행이므로 그 경우엔 본문을 남긴다.
# 구분자는 «-» · «.» 를 포함할 수 있다(END-NOTE) · «<<<»(here-string)는 heredoc 이 아니다.
strip_heredoc_bodies() {
  local line delim="" indoc=0 out="" trimmed
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    if (( indoc )); then
      trimmed="${line#"${line%%[![:space:]]*}"}"
      trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
      [[ "$trimmed" == "$delim" ]] && indoc=0
      continue
    fi
    # `cmd <<'EOF'` / `cmd <<EOF` / `cmd <<-"EOF"` — 시작 줄 자체는 명령이므로 남긴다
    if [[ "$line" =~ (^|[^\<])\<\<-?[[:space:]]*[\'\"]?([A-Za-z_][A-Za-z0-9_.-]*)[\'\"]? ]]; then
      case "$line" in
        *bash*|*" sh "*|*zsh*|*python*|*node*|*eval*|*"gh api"*) : ;;   # 인터프리터가 실행 · gh api 가 입력으로 먹음 → 본문 유지
        *) delim="${BASH_REMATCH[2]}"; indoc=1 ;;
      esac
    fi
    out+="$line"$'\n'
  done <<< "$1"
  printf '%s' "$out"
}

# 공백이 든 따옴표 문자열(메시지 · 본문 · 쿼리)은 지우고, 한 단어짜리 따옴표는 벗긴다 —
# refspec · 브랜치 이름에는 공백이 없으므로 «"HEAD:prod"» · «'prod'» 는 남고 «-m "… prod …"» 는 빠진다
sanitize() {
  printf '%s' "$1" | sed -E \
    -e "s/\\\$'([^'[:space:]]*)'/\\1/g" \
    -e 's/\$"([^"[:space:]]*)"/\1/g' \
    -e 's/"([^"[:space:]]*)"/\1/g' \
    -e "s/'([^'[:space:]]*)'/\1/g" \
    -e 's/"[^"]*[[:space:]][^"]*"/ /g' \
    -e "s/'[^']*[[:space:]][^']*'/ /g"
}

# 세그먼트 앞의 환경 변수 대입 · 감싸는 명령(sudo · command · exec · nohup · time · env · builtin)을 걷는다
command_of() {
  local s="$1"
  s="${s#"${s%%[![:space:]]*}"}"
  while :; do
    if [[ "$s" =~ ^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+(.*)$ ]]; then s="${BASH_REMATCH[1]}"; continue; fi
    if [[ "$s" =~ ^(sudo|command|exec|nohup|time|env|builtin)[[:space:]]+(.*)$ ]]; then s="${BASH_REMATCH[2]}"; continue; fi
    break
  done
  printf '%s' "$s"
}

# 명령 경계(; && || | & ( ) 줄바꿈)로 쪼갠다. $(…) · `…` 안쪽은 따로 떼어 별도 명령으로 본다(바깥 자리는 SUBST)
split_commands() {
  local work="$1" extra="" m
  while [[ "$work" =~ \$\(([^()]*)\) ]]; do
    m="${BASH_REMATCH[0]}"; extra+="${BASH_REMATCH[1]}"$'\n'; work="${work/"$m"/SUBST}"
  done
  while [[ "$work" =~ \`([^\`]*)\` ]]; do
    m="${BASH_REMATCH[0]}"; extra+="${BASH_REMATCH[1]}"$'\n'; work="${work/"$m"/SUBST}"
  done
  printf '%s\n%s' "$work" "$extra" | awk '{gsub(/&&|\|\||[;|()&]/, "\n"); print}'
}

PROD_MSG="prod 푸시 차단 — admin/client production 배포가 즉시 트리거됩니다. nomacomfe-prod-push-check 스킬로 pre-flight 를 마치고 사용자 명시 승인을 받으세요."

check_git_push() { # $1 = «git push» 뒤 인자(정리 전)
  local raw="$1" args
  args=" $(sanitize "$raw") "
  case "$args" in
    *" --force"*|*" -f "*)
      block "force push 차단. 진짜 필요하면 사용자에게 명시적 확인 받고 hook 우회하세요." ;;
  esac
  # 짧은 옵션 묶음(-fu · -uf) 안의 f 도 force 다
  if [[ "$args" =~ [[:space:]]-[a-zA-Z]*f[a-zA-Z]*[[:space:]] ]]; then
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
  # ⭐ prod 는 막는다 (m8-frontend 와 다른 지점).
  #    prod push = admin-production.yml / client-production.yml 즉시 트리거 = CodeDeploy 배포.
  # ⚠️ 단어 경계로 판정한다 — feat/product-detail · fix/reproduce-issue · imjohnkoo/prod-x · x/prod 는 통과.
  #    목적지는 bare «prod» · «heads/prod» · «refs/heads/prod» — 앞은 공백 · «:» · «+» · 따옴표, 뒤는 따옴표 · 공백 · 리다이렉트 · 끝
  if [[ "$args" =~ (^|[[:space:]:+\'\"])(refs/)?(heads/)?prod[\'\"]?([[:space:]\<\>]|$) ]]; then
    block "$PROD_MSG"
  fi
}

check_gh_api() { # $1 = 명령 전체(gh api …)
  local s low
  s=" $(sanitize "$1") "
  low=$(printf '%s' "$s" | tr 'A-Z' 'a-z')
  # production workflow 수동 실행(dispatch) — dev 를 prod 서버에 그대로 배포한다
  if [[ "$low" =~ /actions/workflows/[^[:space:]]*production[^[:space:]]*/dispatches ]]; then
    block "production workflow 수동 실행(dispatch) 차단 — 그 ref 가 prod 서버에 바로 배포됩니다. prod 브랜치 승격 경로(nomacomfe-prod-push-check)로."
  fi
  if [[ "$s" =~ refs/heads/prod([^[:alnum:]_.-]|$) || "$s" =~ (ref|new_name|base)=(refs/heads/)?prod([^[:alnum:]_.-]|$) || "$s" =~ /branches/prod(/|[^[:alnum:]_.-]|$) ]]; then
    local write=0
    if [[ "$low" =~ (-x|--method)[[:space:]=]*(patch|post|put|delete) ]]; then
      write=1
    elif ! [[ "$low" =~ (-x|--method)[[:space:]=]*get([^[:alnum:]]|$) ]] &&
      [[ "$s" =~ [[:space:]]-[fF][^[:space:]]*[[:space:]] || "$s" =~ [[:space:]](--field|--raw-field|--input)([[:space:]=]|$) ]]; then
      write=1   # gh api 는 필드를 주면 -X 없이도 POST
    fi
    (( write )) && block "gh api 로 prod ref 직접 변경 차단 — git push 와 동등한 배포 트리거입니다. 사용자 명시 승인 필요."
  fi
}

check_segment() { # $1 = 세그먼트, $2 = 재귀 깊이
  local seg="$1" depth="${2:-0}" s rest
  [[ -z "${seg//[[:space:]]/}" ]] && return
  s=$(command_of "$seg")

  # bash -c · sh -c · eval — 안쪽 문자열을 다시 명령으로 본다(깊이 3 까지)
  if (( depth < 3 )) && [[ "$s" =~ ^(bash|sh|zsh|dash|ksh)[[:space:]]+(-[a-zA-Z]+[[:space:]]+)*-[a-zA-Z]*c[a-zA-Z]*[[:space:]]+(.*)$ ]]; then
    rest="${BASH_REMATCH[3]}"; rest="${rest#[\"\']}"; rest="${rest%[\"\']*}"
    check_text "$rest" $((depth + 1)); return
  fi
  if (( depth < 3 )) && [[ "$s" =~ ^eval[[:space:]]+(.*)$ ]]; then
    rest="${BASH_REMATCH[1]}"; rest="${rest#[\"\']}"; rest="${rest%[\"\']*}"
    check_text "$rest" $((depth + 1)); return
  fi

  # ⭐ `git` 과 서브커맨드 사이에 끼는 전역 옵션을 제거해 인접 매칭을 성립시킨다.
  #   git -C ~/orca/workspaces/nomacom-frontend/x push origin prod
  # 이 리포는 Orca 워크트리를 상시 사용하므로 `-C` 는 일상 명령 형태다. 값은 따옴표로 감쌀 수 있다.
  if [[ "$s" =~ ^git[[:space:]] ]]; then
    # -c remote.<x>.push=… / remote.<x>.mirror=… 로 push refspec 을 바꿔 끼우는 것
    if [[ "$s" =~ [[:space:]]push([[:space:]]|$) && "$s" =~ remote\.[^[:space:]=]+\.(push|mirror)=[^[:space:]]*(prod|\*|true) ]]; then
      block "$PROD_MSG"
    fi
    s=$(printf '%s' "$s" | sed -E \
      -e 's/^git(([[:space:]]+(-C|-c|--git-dir|--work-tree|--namespace|--exec-path|--super-prefix|--config-env)([[:space:]]+|=)("[^"]*"|'"'"'[^'"'"']*'"'"'|[^[:space:]]+))|([[:space:]]+(--no-pager|-P|--paginate|-p|--bare|--no-replace-objects|--literal-pathspecs|--glob-pathspecs|--noglob-pathspecs|--icase-pathspecs|--no-optional-locks|--no-lazy-fetch)))+/git/')
  fi

  # --- git push: 인자 영역만 본다 ---
  if [[ "$s" =~ ^git[[:space:]]+push([[:space:]].*)?$ ]]; then
    check_git_push "${BASH_REMATCH[1]}"
  fi

  # --- gh: api(ref 쓰기 · dispatch) · prod base PR · production workflow 실행 ---
  if [[ "$s" =~ ^gh[[:space:]]+api([[:space:]]|$) ]]; then
    check_gh_api "$s"
    # ref 되감기 — GitHub 은 force 없는 비-fast-forward 를 422 로 거부한다. 뚫리는 길은 명시적 force 하나뿐
    case "$s" in
      *"refs/heads/"*"force=true"*|*"refs/heads/"*"force= true"*|*"force=true"*"refs/heads/"*)
        block "gh api 로 ref 를 force 이동하는 것은 차단합니다 — 배포를 되돌리고 커밋이 소실됩니다. 정말 필요하면 사용자 명시 승인을 받으세요." ;;
    esac
  fi
  if [[ "$s" =~ ^gh[[:space:]]+pr[[:space:]]+(create|new|edit)([[:space:]]|$) ]]; then
    if [[ " $(sanitize "$s") " =~ [[:space:]](--base[[:space:]=]+|-B[[:space:]=]*)prod([[:space:]]|$) ]]; then
      block "prod 를 base 로 하는 PR 차단 — 머지하면 prod 가 바로 배포됩니다. PR base 는 dev, 승격은 nomacomfe-prod-push-check 뒤 사용자 승인으로."
    fi
  fi
  # xargs 로 부르는 git push — 목적지가 표준 입력에서 와서 볼 수 없다
  if [[ "$s" =~ ^xargs([[:space:]]|$) && "$s" =~ [[:space:]]git([[:space:]]+[^[:space:]]+)*[[:space:]]+push([[:space:]]|$) ]]; then
    block "xargs 로 git push 차단 — 목적지(표준 입력)를 판정할 수 없습니다. 브랜치를 이름으로 적어 push 하세요."
  fi
  if [[ "$s" =~ ^gh[[:space:]]+workflow[[:space:]]+(run|r)[[:space:]] && "$s" == *production* ]]; then
    block "production workflow 수동 실행 차단 — 그 ref(기본 dev)가 prod 서버에 바로 배포됩니다. prod 브랜치 승격 경로(nomacomfe-prod-push-check)로."
  fi

  # --- 나머지 파괴적 명령(세그먼트 어디에 있든) ---
  case "$seg" in
    *"docker push"*)
      block "수동 docker push 금지. 배포는 GitHub Actions(prod 브랜치 push)로 트리거 — nomacom-admin / nomacom-client 이미지는 .github/workflows/*-production.yml 이 빌드." ;;
    *"git reset --hard"*)
      block "git reset --hard 차단. 잃을 수 있는 작업 확인 후 사용자 승인 받으세요." ;;
    *"aws ssm put-parameter"*|*"aws ssm delete-parameter"*)
      block "SSM 변경 차단. 시크릿 변경은 콘솔 또는 사용자 명시 승인 필요 (.claude/rules/ssm-paths.md)." ;;
  esac
}

check_text() { # $1 = 명령 글(여러 줄 가능), $2 = 재귀 깊이
  local seg
  while IFS= read -r seg; do
    check_segment "$seg" "${2:-0}"
  done <<< "$(split_commands "$1")"
}

# 줄 이음(\ + 줄바꿈)만 합치고 줄바꿈은 명령 경계로 남긴다 · 탭은 공백으로
text=$(strip_heredoc_bodies "$cmd" | awk '{ if (sub(/\\$/, "")) printf "%s ", $0; else print }' | tr '\t' ' ')
flat=$(printf '%s' "$text" | tr '\n' ' ' | tr -s ' ')

check_text "$text" 0

# graphql ref 변경 · 머지 mutation 은 쿼리 안 괄호 · 줄바꿈에서 갈라지므로 명령 전체(flat)로 본다.
# updateRef · deleteRef 는 refId 만 받아 대상 이름이 안 보일 수 있다 — 브랜치를 가리지 않고 막는다(REST 로 이름을 적어서)
if [[ "$flat" == *"gh api"* && "$flat" == *graphql* ]] &&
  [[ "$flat" =~ (createRef|updateRef|updateRefs|deleteRef|mergeBranch|mergePullRequest) ]]; then
  block "gh api graphql 의 ref 변경 · 머지 mutation 차단 — 대상(prod 여부)을 판정할 수 없습니다. REST(gh api …/git/refs/heads/<브랜치>)로 이름을 적어서 하세요."
fi
if [[ "$flat" == *"gh api"* && "$flat" == *graphql* && "$flat" =~ (createPullRequest|updatePullRequest) ]] &&
  [[ "$flat" =~ (baseRefName|base)[^[:alnum:]]*[\"\':[:space:]]*(refs/heads/)?prod([^[:alnum:]_-]|$) ]]; then
  block "gh api graphql 로 prod base PR 차단 — 머지하면 prod 가 바로 배포됩니다."
fi
# 표준 입력 · heredoc 으로 JSON 을 넘기는 gh api(--input) — 명령 전체에 prod ref 가 보이면 막는다
if [[ "$flat" == *"gh api"* && "$flat" == *"--input"* ]] &&
  [[ "$flat" =~ refs/heads/prod([^[:alnum:]_.-]|$) || "$flat" =~ \"(ref|base|new_name)\"[[:space:]]*:[[:space:]]*\"(refs/heads/)?prod\" ]]; then
  block "gh api --input 으로 prod ref 변경 차단 — git push 와 동등한 배포 트리거입니다. 사용자 명시 승인 필요."
fi

exit 0
