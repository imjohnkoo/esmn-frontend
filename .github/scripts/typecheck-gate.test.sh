#!/usr/bin/env bash
# typecheck-gate.sh 회귀 테스트.
#
# 실행: .github/scripts/typecheck-gate.test.sh
#
# 게이트는 «신규 에러만 차단» 이 존재 이유다. 그 판정이 실제로 작동하는지를
# 인위적 에러 주입으로 확인한다 — 게이트가 조용히 통과만 시키면 없는 것과 같다.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GATE="$ROOT/.github/scripts/typecheck-gate.sh"
APP="client"                       # 기준선이 비어있지 않은 앱으로 테스트
PROBE="$ROOT/apps/$APP/server/utils/__typecheck_gate_probe__.ts"
BASELINE="$ROOT/.github/typecheck-baseline/$APP.txt"

pass=0; fail=0
# 시작 시점 기준선 — 테스트가 끝난 뒤 같아야 한다(건수를 박아 두면 기준선이 정당하게 줄 때마다 깨진다)
BASELINE_BEFORE="$(cksum <"$BASELINE" 2>/dev/null)"
cleanup() { rm -f "$PROBE"; }
trap cleanup EXIT

check() { # check <label> <expected-exit> <actual-exit>
  if [[ "$2" == "$3" ]]; then
    pass=$((pass+1)); printf '  ✔ %s\n' "$1"
  else
    fail=$((fail+1)); printf '  ⛔ %s — expected exit %s, got %s\n' "$1" "$2" "$3"
  fi
}

echo "== typecheck-gate 회귀 테스트 (app=$APP) =="

# 0) 기준선 파일이 존재해야 한다
[[ -f "$BASELINE" ]] && { pass=$((pass+1)); echo "  ✔ 기준선 파일 존재"; } \
                     || { fail=$((fail+1)); echo "  ⛔ 기준선 파일 없음: $BASELINE"; }

# 1) 깨끗한 상태 = 통과 (기준선 내 에러는 있어도 신규가 없으므로)
"$GATE" "$APP" >/dev/null 2>&1
check "기준선 상태에서 통과" 0 $?

# 2) 신규 타입 에러를 주입하면 차단해야 한다
cat > "$PROBE" <<'PROBE_EOF'
// typecheck-gate 회귀 테스트용 임시 파일. 테스트가 끝나면 삭제된다.
export const probe: number = 'this is not a number'
PROBE_EOF
"$GATE" "$APP" >/dev/null 2>&1
check "신규 에러 주입 시 차단" 1 $?

# 3) --update 가 기준선을 늘리려 하면 거부해야 한다 (probe 가 아직 있는 상태)
"$GATE" "$APP" --update >/dev/null 2>&1
check "--update 가 기준선 증가를 거부" 1 $?

# 4) 주입 제거 후 다시 통과
rm -f "$PROBE"
"$GATE" "$APP" >/dev/null 2>&1
check "주입 제거 후 통과" 0 $?

# 5) 기준선이 훼손되지 않았다
if [[ -f "$BASELINE" && "$(cksum <"$BASELINE")" == "$BASELINE_BEFORE" ]]; then
  pass=$((pass+1)); echo "  ✔ 기준선 $(grep -c . "$BASELINE")건 그대로 (테스트가 기준선을 오염시키지 않음)"
else
  fail=$((fail+1)); echo "  ⛔ 기준선이 변했다 ($(grep -c . "$BASELINE")건)"
fi

# 6) 없는 앱은 usage 에러(2)
"$GATE" nonexistent-app >/dev/null 2>&1
check "없는 앱은 exit 2" 2 $?

echo
printf 'pass=%d fail=%d\n' "$pass" "$fail"
[[ "$fail" -eq 0 ]] || exit 1
