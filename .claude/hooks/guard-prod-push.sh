#!/usr/bin/env bash
# Block prod-affecting commands. Returns block decision via JSON to Claude Code.
#
# ⭐ 2026-09-02 개정 (프로세스 v2 이식 W0-4). 이전 판은 29줄 substring 매칭이었고
#    문서(CLAUDE.md · rules/claude-code-assets.md)가 «prod push / aws ssm put 차단» 이라
#    기술하는데 실제로는 **둘 다 없었다**. 문서를 믿고 행동하면 안 막히는 상태였다.
#    m8-frontend 의 판정 로직(세그먼트 분리 · 단어 경계 · heredoc 제외 · fail-closed)을
#    이식하되, **prod 차단은 유지**한다 — m8 은 게이트를 Dockerfile 로 옮겨서 해제했지만
#    nomacom 은 Dockerfile 게이트가 없고 prod push = 즉시 CodeDeploy 배포다.
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
strip_heredoc_bodies() {
  local line delim="" indoc=0 out="" trimmed
  while IFS= read -r line || [[ -n "$line" ]]; do
    if (( indoc )); then
      trimmed="${line#"${line%%[![:space:]]*}"}"
      trimmed="${trimmed%"${trimmed##*[![:space:]]}"}"
      [[ "$trimmed" == "$delim" ]] && indoc=0
      continue
    fi
    # `cmd <<'EOF'` / `cmd <<EOF` / `cmd <<-"EOF"` — 시작 줄 자체는 명령이므로 남긴다
    if [[ "$line" =~ \<\<-?[[:space:]]*[\'\"]?([A-Za-z_][A-Za-z0-9_]*)[\'\"]? ]]; then
      case "$line" in
        *bash*|*" sh "*|*zsh*|*python*|*node*|*eval*) : ;;   # 인터프리터가 실행 → 본문 유지
        *) delim="${BASH_REMATCH[1]}"; indoc=1 ;;
      esac
    fi
    out+="$line"$'\n'
  done <<< "$1"
  printf '%s' "$out"
}

# Strip line continuations / collapse whitespace for matching
flat=$(strip_heredoc_bodies "$cmd" | tr '\n' ' ' | tr -s ' ')

# ⭐ 명령 경계로 쪼갠 뒤 «그 명령» 안에서만 판정한다.
# flat 전체를 훑으면 복합 명령에 섞인 다른 명령의 토큰을 git push 것으로 오인한다:
#   git push origin HEAD:dev ; echo "prod = $(git log -1 origin/prod)"
#     → dev 로 가는 push 인데 뒤쪽 echo 의 prod 문자열 때문에 차단
#   git push origin feat/x ... ; gh api ... -f sha=$SHA
#     → gh api 의 -f(field) 를 `git push -f` 로 읽고 force push 차단
# 변수 치환 우회(git push $BRANCH)는 잡지 못한다 — 훅은 실수 방지용이지
# 악의적 우회 방어선이 아니다.
segments=$(printf '%s\n' "$flat" | awk '{gsub(/&&|\|\||[;|()&]/, "\n"); print}')

while IFS= read -r seg; do
  [[ -z "$seg" ]] && continue

  # ⭐ `git` 과 서브커맨드 사이에 끼는 전역 옵션을 제거해 인접 매칭을 성립시킨다.
  #   git -C ~/orca/workspaces/nomacom-frontend/x push origin prod
  # 이 리포는 Orca 워크트리를 상시 사용하므로 `-C` 는 일상 명령 형태다.
  seg=$(printf '%s' "$seg" | sed -E 's/(^|[[:space:]])git([[:space:]]+(-C[[:space:]]+[^[:space:]]+|--git-dir[= ][^[:space:]]+|--work-tree[= ][^[:space:]]+|-c[[:space:]]+[^[:space:]]+|--no-pager|--bare|--exec-path[= ][^[:space:]]+))+/\1git/g')

  # --- git push: 인자 영역(= `git push` 이후)만 본다 ---
  case "$seg" in
    *"git push"*)
      args=" ${seg#*git push} "
      case "$args" in
        *" --force"*|*" -f "*)
          block "force push 차단. 진짜 필요하면 사용자에게 명시적 확인 받고 hook 우회하세요." ;;
      esac
      # ⭐ prod 는 막는다 (m8-frontend 와 다른 지점).
      #    prod push = admin-production.yml / client-production.yml 즉시 트리거 = CodeDeploy 배포.
      #    nomacom 은 Dockerfile 안에 typecheck/test 게이트가 없어서 이미지가 무조건 만들어진다
      #    — 즉 훅이 유일한 사전 방어선이다. `nomacomfe-prod-push-check` 를 거치게 하는 것이 목적.
      # ⚠️ 단어 경계로 판정한다. `*prod*` 부분문자열 매칭은 feat/product-detail,
      #    fix/reproduce-issue 같은 정상 브랜치를 오탐 차단한다.
      if [[ "$args" =~ (^|[[:space:]:])prod([[:space:]]|$) ]]; then
        block "prod 푸시 차단 — admin/client production 배포가 즉시 트리거됩니다. nomacomfe-prod-push-check 스킬로 pre-flight 를 마치고 사용자 명시 승인을 받으세요."
      fi
      ;;
  esac

  # --- prod ref 를 API 로 직접 옮기는 것 (git push 와 동등) ---
  # 조회(GET)는 안전하므로 쓰기 메서드만 본다.
  case "$seg" in
    *"gh api"*"refs/heads/prod"*)
      case "$seg" in
        *"-X PATCH"*|*"-X POST"*|*"-X DELETE"*|*"--method PATCH"*|*"--method POST"*|*"--method DELETE"*)
          block "gh api 로 prod ref 직접 변경 차단 — git push 와 동등한 배포 트리거입니다. 사용자 명시 승인 필요." ;;
      esac
      ;;
  esac

  # --- ref 되감기(force) 차단 ---
  # GitHub 은 force 없는 ref 업데이트를 422 (Update is not a fast forward) 로 스스로 거부하므로
  # 무의도 되감기는 안전하다. 뚫리는 경로는 «명시적 force» 하나뿐이고, 그것이 남의 배포를 되돌린다.
  case "$seg" in
    *"gh api"*"refs/heads/"*)
      case "$seg" in
        *"force=true"*|*"force= true"*)
          block "gh api 로 ref 를 force 이동하는 것은 차단합니다 — 배포를 되돌리고 커밋이 소실됩니다. 정말 필요하면 사용자 명시 승인을 받으세요." ;;
      esac
      ;;
  esac

  case "$seg" in
    *"docker push"*)
      block "수동 docker push 금지. 배포는 GitHub Actions(prod 브랜치 push)로 트리거 — nomacom-admin / nomacom-client 이미지는 .github/workflows/*-production.yml 이 빌드." ;;
    *"git reset --hard"*)
      block "git reset --hard 차단. 잃을 수 있는 작업 확인 후 사용자 승인 받으세요." ;;
    *"aws ssm put-parameter"*|*"aws ssm delete-parameter"*)
      block "SSM 변경 차단. 시크릿 변경은 콘솔 또는 사용자 명시 승인 필요 (.claude/rules/ssm-paths.md)." ;;
  esac
done <<< "$segments"

exit 0
