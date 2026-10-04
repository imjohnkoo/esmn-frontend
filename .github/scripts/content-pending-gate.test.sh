#!/usr/bin/env bash
# content-pending-gate.sh 회귀 테스트 — 임시 git 저장소에 커밋을 만들어 판정만 본다(리포 파일은 건드리지 않는다).
# 사용: bash .github/scripts/content-pending-gate.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
GATE="$HERE/content-pending-gate.sh"
REPO_ROOT="$(cd "$HERE/../.." && pwd)"
PENDING_FILE=apps/client/app/content/pending.ts
TMP="$(mktemp -d)" || { echo "mktemp 실패 — 중단"; exit 1; }
trap 'rm -rf "$TMP"' EXIT
pass=0
fail=0

# git hook 안에서 돌아도 바깥 저장소의 index · git dir 을 건드리지 않게 GIT_* 를 비운다
g() { env -u GIT_DIR -u GIT_INDEX_FILE -u GIT_WORK_TREE -u GIT_OBJECT_DIRECTORY \
  git -C "$TMP" -c user.name=gate-test -c user.email=gate-test@example.invalid "$@" >/dev/null 2>&1; }
commit() { g add -A && g commit -q --allow-empty -m "$1"; }
put() { mkdir -p "$(dirname "$TMP/$1")" && printf '%s\n' "$2" >"$TMP/$1"; }
put_real_pending() { mkdir -p "$(dirname "$TMP/$PENDING_FILE")" && cp "$REPO_ROOT/$PENDING_FILE" "$TMP/$PENDING_FILE"; }
record() { if [[ $2 -eq $1 ]]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL: $3 (want $1, got $2)"; fi; }
expect() { # 기대 exit · 설명 · [rev]
  CONTENT_GATE_ROOT="$TMP" bash "$GATE" ${3:+"$3"} >/dev/null 2>&1
  record "$1" $? "$2"
}

# 실제 pending.ts 가 게이트의 PENDING_BLOB 과 같아야 한다 — 어긋나면 P9-4 반영 뒤에야 드러나는 거짓 차단
real_blob="$(git hash-object "$REPO_ROOT/$PENDING_FILE")"
gate_blob="$(sed -n 's/^PENDING_BLOB=\([0-9a-f]*\)$/\1/p' "$GATE")"
record 0 "$([[ -n "$gate_blob" && "$real_blob" == "$gate_blob" ]] && echo 0 || echo 1)" "실제 pending.ts($real_blob) = 게이트 PENDING_BLOB($gate_blob)"

g init -q
expect 2 "커밋 없음 → 검사 불가"

put README.md 'x'
commit "no client"
expect 2 "apps/client/app 없음 → 검사 불가"

put_real_pending
put apps/client/app/content/pending.test.ts "expect(P9_4_PENDING)"
put apps/client/CLAUDE.md '`P9_4_PENDING` 규칙 설명 · (확정 전)'
put apps/client/app/content/business.ts "export const X = '확정'"
commit "clean"
CLEAN="$(git -C "$TMP" rev-parse HEAD)"
expect 0 "정의 파일 · 테스트 · 문서에만 있음 → 통과"
expect 2 "없는 리비전 → 검사 불가" deadbeef

put apps/client/app/content/business.ts "export const X = P9_4_PENDING"
commit "pending in content"
PENDING="$(git -C "$TMP" rev-parse HEAD)"
expect 1 "콘텐츠 파일에 있음 → 막힘"
expect 0 "리비전 인자 — 깨끗한 커밋" "$CLEAN"

# 워크트리에서만 지우고 커밋 안 함 → HEAD 는 여전히 막힘
put apps/client/app/content/business.ts "export const X = '확정'"
expect 1 "미커밋 수정은 통과가 아니다(HEAD 기준)"
g checkout -q -- apps/client/app/content/business.ts

# 반대로 커밋은 깨끗하고 워크트리에만 자리표시자 → HEAD 통과
g checkout -q "$CLEAN"
put apps/client/app/content/business.ts "export const X = P9_4_PENDING"
expect 0 "미커밋 자리표시자는 HEAD 판정에 안 들어간다"
g checkout -q -- apps/client/app/content/business.ts

for path in apps/client/nuxt.config.ts apps/client/app/content/data.json apps/client/server/utils/x.js apps/client/shared/y.mts apps/client/app/pages/z.vue; do
  g checkout -q "$CLEAN"
  put "$path" "P9_4_PENDING"
  commit "pending in $path"
  expect 1 "$path 에 있음 → 막힘"
done

g checkout -q "$PENDING"
expect 1 "detached HEAD 도 같은 판정"

CONTENT_GATE_ROOT="$TMP" bash "$GATE" "" >/dev/null 2>&1
record 2 $? "빈 리비전 인자 → 검사 불가"
CONTENT_GATE_ROOT="$TMP" bash "$GATE" "$CLEAN" "$PENDING" >/dev/null 2>&1
record 2 $? "여러 인자 → 검사 불가(한 ref 만 보고 통과하지 않게)"

# 바이너리 속성이 붙어도 텍스트로 본다(.gitattributes -diff)
g checkout -q "$CLEAN"
put .gitattributes 'apps/client/app/content/*.ts -diff'
put apps/client/app/content/business.ts "export const X = P9_4_PENDING"
commit "binary attr"
expect 1 "-diff 속성 파일도 막힘"

# pending.ts 는 파일 전체가 고정 — 별칭(한 줄 · 여러 줄 · 주석 · 재수출) · 판정 함수 본문 변경 모두 막힌다
aliases=(
  "export const TBD = P9_4_PENDING"
  "export { P9_4_PENDING as TBD }"
  "export default P9_4_PENDING"
  "const TBD = P9_4_PENDING; export { TBD }"
  "export/**/const TBD = P9_4_PENDING"
  "  , TBD = PENDING_LABEL"
)
for alias in "${aliases[@]}"; do
  g checkout -q "$CLEAN"
  put_real_pending
  printf '%s\n' "$alias" >>"$TMP/$PENDING_FILE"
  put apps/client/app/content/business.ts "export const X = TBD"
  commit "alias: $alias"
  expect 1 "pending.ts 별칭 막힘 — $alias"
done
g checkout -q "$CLEAN"
put_real_pending
# 백업 파일을 남기지 않는 치환(perl -pi) — sed -i.orig 의 .orig 가 커밋돼 그것만으로 막혀 테스트가 아무것도 검증하지 못했다
perl -pi -e "s/return value === P9_4_PENDING/return value === P9_4_PENDING || value === '-'/" "$TMP/$PENDING_FILE"
grep -q "value === '-'" "$TMP/$PENDING_FILE" || record 0 1 "본문 변경 픽스처가 적용되지 않았다"
[[ -z "$(find "$TMP/apps" -name '*.orig')" ]] || record 0 1 "본문 변경 픽스처가 백업 파일을 남겼다"
put apps/client/app/content/business.ts "export const X = '-'"
commit "body change"
expect 1 "판정 함수 본문 변경 막힘"

# 글자 P9_4_PENDING 없이 표시 문구로 채우는 우회 — 따옴표 · 앞뒤 글자 · .vue 템플릿
labels=(
  "apps/client/app/content/business.ts|export const X = PENDING_LABEL"
  "apps/client/app/content/business.ts|export const X = '(확정 전)'"
  'apps/client/app/content/business.ts|export const X = "(확정 전)"'
  "apps/client/app/content/business.ts|export const X = '상호 (확정 전)'"
  "apps/client/app/components/shell/SiteFooter.vue|<p>대표자 (확정 전)</p>"
  "apps/client/app/content/business.ts|export const X = '«(확정 전)»'"
  "apps/client/app/components/shell/SiteFooter.vue|<p>대표자 «(확정 전)»</p>"
  "apps/client/app/content/business.ts|/** 확정 전 값은 «(확정 전)» */"
  "apps/client/app/components/shell/SiteFooter.vue|<p>대표자 (확정&nbsp;전)</p>"
  "apps/client/app/components/shell/SiteFooter.vue|<p>대표자 （확정 전）</p>"
)
for entry in "${labels[@]}"; do
  g checkout -q "$CLEAN"
  put "${entry%%|*}" "${entry#*|}"
  commit "label: $entry"
  expect 1 "표시 문구 막힘(예외 없음 — 주석 포함) — ${entry#*|}"
done

# prettier 줄바꿈으로 «(확정 / 전)» 이 두 줄로 갈린 템플릿
g checkout -q "$CLEAN"
put apps/client/app/components/shell/SiteFooter.vue "<p>
  상호 이심마니 · 대표자 홍길동 · 통신판매업 신고번호 (확정
  전) · 호스팅 서비스 제공자 AWS
</p>"
commit "wrapped label"
expect 1 "줄바꿈으로 갈린 «(확정 / 전)» 도 막힘"

# 바이너리 속성 파일의 표시 문구도 텍스트로 본다
g checkout -q "$CLEAN"
put .gitattributes 'apps/client/app/content/*.ts -diff'
put apps/client/app/content/business.ts "export const X = '(확정 전)'"
commit "binary attr label"
expect 1 "-diff 속성 파일의 표시 문구도 막힘"

# rev 이름에 | 가 있어도(유효한 브랜치 이름) 판정이 깨지지 않는다
g branch 'feat|x' "$PENDING"
expect 1 "rev 'feat|x' — 막힘(구분자 충돌로 통과하지 않는다)" 'feat|x'

# 임시 파일을 못 만들면 통과가 아니라 검사 불가
g checkout -q "$PENDING"
NOTMP="$TMP/fake-bin"
mkdir -p "$NOTMP"
printf '#!/bin/sh\nexit 1\n' >"$NOTMP/mktemp"
chmod +x "$NOTMP/mktemp"
PATH="$NOTMP:$PATH" CONTENT_GATE_ROOT="$TMP" bash "$GATE" >/dev/null 2>&1
record 2 $? "mktemp 실패 → 검사 불가"

# 객체를 못 읽으면(손상 · 누락) «없음» 이 아니라 검사 불가
g checkout -q "$CLEAN"
blob="$(git -C "$TMP" rev-parse "$CLEAN:apps/client/app/content/business.ts")"
obj="$TMP/.git/objects/${blob:0:2}/${blob:2}"
# 환경에 따라(CI 러너의 git) 객체가 낱개가 아니라 팩에 들어 있다 — 팩을 풀어 낱개로 만든 뒤 그 객체 하나만 치운다
if [[ ! -f "$obj" ]]; then
  for pk in "$TMP"/.git/objects/pack/*.pack; do
    [[ -f "$pk" ]] || continue
    mv "$pk" "$TMP/unpack.pack" && mv "${pk%.pack}.idx" "$TMP/unpack.idx" 2>/dev/null
    git -C "$TMP" unpack-objects -q <"$TMP/unpack.pack"
  done
fi
if [[ -f "$obj" ]]; then
  mv "$obj" "$TMP/missing-object"
else
  echo "진단: 객체 $blob 를 낱개로 만들지 못했다"; git -C "$TMP" count-objects -v; ls -R "$TMP/.git/objects" | head -20
fi
expect 2 "blob 누락 → 검사 불가 (통과 아님)" "$CLEAN"

echo "content-pending-gate: $pass pass · $fail fail"
[[ $fail -eq 0 ]]
