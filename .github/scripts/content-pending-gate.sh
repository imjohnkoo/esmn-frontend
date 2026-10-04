#!/usr/bin/env bash
# 콘텐츠 자리표시자 게이트 — client 판매 사이트(W1-2 · spec D-17).
#
# 사업자정보 · 고객센터 · 약관 · 처리방침 · 환불정책의 확정 전 값은 `P9_4_PENDING` 으로 두고 화면에 «(확정 전)» 을 보인다.
# frontend 는 prod = dev 의 한 SHA 라, dev 에 들어간 자리표시자는 다음 prod 승격(핫픽스 포함)에 그대로 나간다.
# → 이 스크립트가 0 으로 끝나야 dev 머지 옵션을 연다. 부르는 곳: nomacomfe-finish-branch Step 0 첫 항목(모든 Tier) ·
#   nomacomfe-prod-push-check Phase 3(승격 SHA) · CI content-gate job(알림 — required check 아님).
#
# 보는 것: **머지할 커밋**(기본 HEAD)의 apps/client/** — 디스크 파일이 아니다(워크트리에서만 채우고 커밋하지 않은 값은 통과가 아니다).
#   바이너리 속성(.gitattributes -diff 등)이 붙은 파일도 텍스트로 본다.
# 찾는 것: `P9_4_PENDING` · `PENDING_LABEL` · 표시 문구의 앞부분 `(확정` · `（확정` — 코드 · 템플릿 · 주석 어디든(주석에도 쓰지 않는다).
# 위협 모델: 자리표시자가 **실수로** dev 에 남는 것. 의도적 우회는 렌더 확인(prod-push-check Phase 4)과 사람 확인이 맡는다.
# 세지 않는 것: 자리표시자 정의 · 판정 함수 파일(app/content/pending.ts) · 테스트 픽스처(*.test.ts) · 문서(*.md).
#   대신 pending.ts 는 **파일 전체**를 git blob 해시로 고정한다 — 별칭(여러 줄 · 주석 · 재수출) · 판정 함수 본문 변경으로
#   게이트를 비껴가지 않게. pending.ts 를 정당하게 고치면 아래 PENDING_BLOB 도 같은 커밋에서 갱신한다
#   (`git hash-object apps/client/app/content/pending.ts`). 회귀 테스트가 실제 pending.ts 와 이 값의 일치를 본다.
#
# 사용: bash .github/scripts/content-pending-gate.sh [rev]
# 종료: 0 = 없음 · 1 = 남아 있음(dev 머지 불가 — PR 은 draft 로) · 2 = 검사 불가(통과로 보지 않는다)
# 회귀: bash .github/scripts/content-pending-gate.test.sh (CONTENT_GATE_ROOT 는 그 테스트용 — 출력에 검사한 경로가 찍힌다)
set -uo pipefail

unable() {
  echo "⛔ $1 — 검사 불가" >&2
  exit 2
}

ROOT="${CONTENT_GATE_ROOT:-$(cd "$(dirname "$0")/../.." && pwd)}"
if [[ $# -gt 1 ]]; then unable "인자는 리비전 하나 — 여러 ref 는 따로 부른다"; fi
if [[ $# -eq 1 && -z "$1" ]]; then unable "빈 리비전 인자"; fi
REV="${1:-HEAD}"
PENDING_FILE=apps/client/app/content/pending.ts
PENDING_BLOB=69dd0bd819a54ea377ea153c3150072dc293205c
EXCLUDES=(":(exclude)$PENDING_FILE" ':(exclude)*.test.ts' ':(exclude)*.md')

git -C "$ROOT" rev-parse --verify --quiet "$REV^{commit}" >/dev/null || unable "리비전 $REV 를 찾을 수 없다"
git -C "$ROOT" cat-file -e "$REV:apps/client/app" 2>/dev/null || unable "$REV 에 apps/client/app 이 없다"

errf="$(mktemp 2>/dev/null)" || errf=""
[[ -n "$errf" && -f "$errf" ]] || unable "임시 파일을 만들 수 없다"
trap 'rm -f "$errf"' EXIT
check_grep() { # git grep 은 객체를 못 읽어도 «못 찾음»(1)으로 끝날 수 있다 — stderr 가 있거나 0 · 1 밖이면 검사 불가
  local rc="$1"
  if [[ -s "$errf" ]]; then
    sed 's/^/    /' "$errf" >&2
    unable "git grep 오류"
  fi
  [[ $rc -eq 0 || $rc -eq 1 ]] || unable "git grep 실패(exit $rc)"
}

# 1) 자리표시자 이름 · 표시 문구 — 예외 없이(주석 포함). 주석에 예외를 두면 그 표기가 코드에 들어와도 통과한다
# 표시 문구는 '(확정' 앞부분만 본다 — prettier 줄바꿈으로 «(확정 / 전)» 이 두 줄로 갈리거나 &nbsp; · NBSP 가 끼어도 잡히게.
# 전각 괄호 '（확정' 도. 이 게이트가 막는 것은 «실수로 남은 자리표시자» 다 — 렌더 결과 확인은 prod-push-check Phase 4.
found="$(git -C "$ROOT" grep -l --text -F -e 'P9_4_PENDING' -e 'PENDING_LABEL' -e '(확정' -e '（확정' "$REV" -- apps/client "${EXCLUDES[@]}" 2>"$errf")"
check_grep $?

# 2) pending.ts 는 파일 전체가 게이트가 아는 판이어야 한다
drift=""
if git -C "$ROOT" cat-file -e "$REV:$PENDING_FILE" 2>/dev/null; then
  blob="$(git -C "$ROOT" rev-parse "$REV:$PENDING_FILE" 2>"$errf")" || unable "$PENDING_FILE 를 읽을 수 없다"
  [[ "$blob" == "$PENDING_BLOB" ]] || drift="$blob"
fi

# "<rev>:<path>" → "<path>" — rev 에 sed 구분자(|) 등이 있어도 깨지지 않게 문자열로만 자른다
hits=""
while IFS= read -r line; do
  [[ -n "$line" ]] && hits+="${line#"$REV:"}"$'\n'
done <<<"$found"
if [[ -n "$hits" || -n "$drift" ]]; then
  echo "⛔ 확정 전 콘텐츠(P9_4_PENDING)가 남아 있다 — dev 머지 불가 (PR 은 draft 로) [$REV @ $ROOT]:"
  [[ -n "$hits" ]] && printf '%s' "$hits" | sed 's/^/    /'
  if [[ -n "$drift" ]]; then
    echo "    $PENDING_FILE 가 게이트가 아는 판과 다르다(blob $drift ≠ $PENDING_BLOB)"
    echo "    (별칭 · 본문 변경 차단 — 의도한 변경이면 이 스크립트의 PENDING_BLOB 을 같은 커밋에서 갱신)"
  fi
  echo "   (값을 다 채웠다면 import 줄의 P9_4_PENDING 도 지워야 한다 — 글자 하나라도 남으면 막힌다)"
  exit 1
fi

echo "✔ 콘텐츠 자리표시자 없음 [$REV @ $ROOT]"
exit 0
