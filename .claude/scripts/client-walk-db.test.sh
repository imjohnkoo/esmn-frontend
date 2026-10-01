#!/usr/bin/env bash
# client-walk-db.sh 회귀 테스트 — DB · 컨테이너에 닿지 않는다(PATH 앞의 가짜 netstat · docker · node).
# 지키는 것: schema 의 drizzle-kit push 는 ① 55432 리스너가 전부 로컬 컨테이너 계열이고 ② 컨테이너에 쓴 표식을
# 호스트 포트로 읽어 같을 때만 돈다 — ssh 터널(prod RDS)이면 호스트 연결 자체를 하지 않는다.
# 사용: bash .claude/scripts/client-walk-db.test.sh
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
S="$DIR/client-walk-db.sh"
FAKE="$(mktemp -d)" || { echo "mktemp 실패 — 중단(가짜 bin 없이 돌면 실제 docker · DB 에 닿는다)"; exit 1; }
[[ -n "$FAKE" && -d "$FAKE" ]] || { echo "가짜 bin 디렉터리 없음 — 중단"; exit 1; }
trap 'rm -rf "$FAKE"' EXIT
pass=0
fail=0
ok() { pass=$((pass + 1)); }
ng() { fail=$((fail + 1)); echo "FAIL: $1"; }

# 가짜 netstat — macOS netstat -anv -p tcp 모양. 55432 리스너 이름은 FAKE_NET_55432(공백 구분)
cat >"$FAKE/netstat" <<'EOF'
#!/bin/sh
echo "Active Internet connections (including servers)"
echo "Proto Recv-Q Send-Q  Local Address  Foreign Address  (state)  rxbytes txbytes rhiwat shiwat process:pid state options"
row() { echo "$1       0      0  $2         *.*                    LISTEN                 0            0  131072  131072  $3:4242  00100 00000106"; }
row tcp4 "*.631" "cupsd"
# 표식을 읽은 뒤 리스너가 바뀌는 경우 — 가짜 node 가 $FAKE_DIR/net_after 를 net_now 로 옮기면 그 뒤 호출은 그 값을 쓴다
[ -f "$FAKE_DIR/net_now" ] && FAKE_NET_55432="$(cat "$FAKE_DIR/net_now")"
for n in $FAKE_NET_55432; do row tcp4 "127.0.0.1.55432" "$n"; done
EOF
# 가짜 docker — 부른 것을 기록. exec … psql -c "COMMENT ON DATABASE walk IS '<표식>'" 이면 표식을 파일에 ·
# context inspect 는 $FAKE/endpoint · inspect -f 이미지는 스크립트가 기대하는 이미지
cat >"$FAKE/docker" <<'EOF'
#!/bin/sh
case "$1 $2" in
  "context inspect") cat "$FAKE_DIR/endpoint"; exit 0 ;;
esac
echo "docker $*" >>"$FAKE_DIR/calls"
case "$*" in
  *"{{.Config.Image}}"*) echo "postgres:15.12-alpine"; exit 0 ;;
esac
prev=""
for a in "$@"; do
  if [ "$prev" = "-c" ]; then echo "$a" | sed -nE "s/^COMMENT ON DATABASE walk IS '([^']*)'$/\1/p" >"$FAKE_DIR/marker"; fi
  prev="$a"
done
exit 0
EOF
# 가짜 node — 표식 읽기(--input-type=module)는 $FAKE/host(same · other · fail)대로, drizzle-kit 은 기록만.
# 스크립트가 env -i 로 부르므로 경로는 환경변수가 아니라 파일 안에 박는다
cat >"$FAKE/node" <<'EOF'
#!/bin/sh
FAKE_DIR="@FAKE@"
case "$*" in
  *--input-type=module*)
    echo "node marker DATABASE_URL=$DATABASE_URL SPARK=${SPARK_API_TOKEN:-}" >>"$FAKE_DIR/calls"
    [ -f "$FAKE_DIR/net_after" ] && cp "$FAKE_DIR/net_after" "$FAKE_DIR/net_now"
    case "$(cat "$FAKE_DIR/host")" in
      same) cat "$FAKE_DIR/marker" ;;
      other) echo "nomacom-walk-0000000000000000" ;;
      *) exit 1 ;;
    esac
    ;;
  *drizzle-kit*) echo "node push DATABASE_URL=$DATABASE_URL SPARK=${SPARK_API_TOKEN:-}" >>"$FAKE_DIR/calls" ;;
  *) echo "node other $*" >>"$FAKE_DIR/calls" ;;
esac
EOF
# 덫 — 호스트에서 DB 포트에 붙을 만한 도구는 부르는 순간 기록 + 실패(실제 도구가 실제 포트에 닿지 않게)
for tool in psql pg_dump pg_isready nc ncat telnet curl wget socat ssh; do
  printf '#!/bin/sh\necho "TRIPWIRE %s $*" >>"%s/calls"\nexit 1\n' "$tool" "$FAKE" >"$FAKE/$tool"
  chmod +x "$FAKE/$tool"
done
sed -i.bak "s#@FAKE@#$FAKE#" "$FAKE/node"
echo "unix:///var/run/docker.sock" >"$FAKE/endpoint"
chmod +x "$FAKE/netstat" "$FAKE/docker" "$FAKE/node"
export FAKE_DIR="$FAKE" SPARK_API_TOKEN=leak DATABASE_URL=postgres://u:p@prod.example.com:5432/db

schema() { # 리스너 · 호스트 표식 → exit 코드(호출 기록은 $FAKE/calls)
  : >"$FAKE/calls"
  : >"$FAKE/marker"
  echo "$2" >"$FAKE/host"
  FAKE_NET_55432="$1" PATH="$FAKE:$PATH" bash "$S" schema >/dev/null 2>&1
  echo $?
}
calls() { cat "$FAKE/calls"; }

# ── 연결 전에 거부 — 컨테이너에도 호스트 포트에도 붙지 않는다
for case in "ssh" "" "com.docker.backend ssh" "session-manager-plugin" "kubectl"; do
  code="$(schema "$case" same)"
  [[ "$code" == 2 ]] && ok || ng "리스너 «$case» — exit 2 여야 함(받은 값 $code)"
  [[ -z "$(calls)" ]] && ok || ng "리스너 «$case» — 아무것도 부르지 않아야 함: $(calls | tr '\n' ';')"
done

# ── 원격 docker 는 어떤 명령이든 거부 — DOCKER_HOST · 컨텍스트
for cmd in up schema seed counts; do
  : >"$FAKE/calls"
  DOCKER_HOST=tcp://remote.example:2376 FAKE_NET_55432="com.docker.backend" PATH="$FAKE:$PATH" bash "$S" "$cmd" >/dev/null 2>&1
  [[ $? == 2 ]] && ok || ng "DOCKER_HOST 원격 · $cmd — exit 2 여야 함"
  [[ -z "$(calls)" ]] && ok || ng "DOCKER_HOST 원격 · $cmd — 아무것도 부르지 않아야 함: $(calls | tr '\n' ';')"
done
echo "ssh://me@remote.example" >"$FAKE/endpoint"
for cmd in up schema seed counts; do
  : >"$FAKE/calls"
  FAKE_NET_55432="com.docker.backend" PATH="$FAKE:$PATH" bash "$S" "$cmd" >/dev/null 2>&1
  [[ $? == 2 ]] && ok || ng "원격 컨텍스트 · $cmd — exit 2 여야 함"
  [[ -z "$(calls)" ]] && ok || ng "원격 컨텍스트 · $cmd — 아무것도 부르지 않아야 함"
done
echo "unix:///var/run/docker.sock" >"$FAKE/endpoint"

# ── 리스너는 로컬 계열인데 호스트 포트가 그 컨테이너가 아니다(표식 불일치 · 읽기 실패) — push 없음
for host in other fail; do
  code="$(schema "com.docker.backend" "$host")"
  [[ "$code" == 2 ]] && ok || ng "표식 $host — exit 2 여야 함(받은 값 $code)"
  grep -q '^node push' <<<"$(calls)" && ng "표식 $host — push 하면 안 됨" || ok
done

# ── 둘 다 맞으면 push 한 번 — 합성 DB URL 만 · 셸의 DATABASE_URL · 벤더 키는 넘기지 않는다
code="$(schema "com.docker.backend" same)"
[[ "$code" == 0 ]] && ok || ng "정상 — exit 0 여야 함(받은 값 $code)"
[[ "$(grep -c '^node push' <<<"$(calls)")" == 1 ]] && ok || ng "정상 — push 정확히 한 번"
grep -qxF 'node push DATABASE_URL=postgres://walk:walk@127.0.0.1:55432/walk SPARK=' <<<"$(calls)" && ok || ng "push env — 합성 URL 만 · 벤더 키 없음: $(calls | tr '\n' ';')"
grep -qxF 'node marker DATABASE_URL=postgres://walk:walk@127.0.0.1:55432/walk SPARK=' <<<"$(calls)" && ok || ng "표식 읽기 env"
grep -qE "^docker exec -i nomacom-walk-pg psql .* -c COMMENT ON DATABASE walk IS 'nomacom-walk-[0-9a-f]{16}'$" <<<"$(calls)" && ok || ng "표식 쓰기는 컨테이너 안에서(docker exec)"
# 순서 — 표식 쓰기 → 표식 읽기 → push
order="$(calls | awk '{print $1, $2}' | tr '\n' ';')"
[[ "$order" == "docker exec;node marker;node push;" ]] && ok || ng "순서: $order"
# push 직전 리스너 재확인 — 표식 확인 뒤 리스너가 터널로 바뀌면 push 하지 않는다(가짜 node 가 표식을 읽을 때 netstat 결과를 바꾼다)
echo "ssh" >"$FAKE/net_after"
code="$(schema "com.docker.backend" same)"
[[ "$code" == 2 ]] && ok || ng "표식 뒤 리스너가 터널로 — exit 2 여야 함(받은 값 $code)"
grep -q '^node push' <<<"$(calls)" && ng "표식 뒤 리스너가 터널로 — push 하면 안 됨" || ok
mv "$FAKE/net_after" "$FAKE/net_after.used"
mv "$FAKE/net_now" "$FAKE/net_now.used"

# ── up · seed · counts · url 은 호스트 포트로 붙지 않는다(55432 가 터널이어도) — docker 만 · 덫 0
for cmd in up seed counts url; do
  : >"$FAKE/calls"
  FAKE_NET_55432="ssh" PATH="$FAKE:$PATH" bash "$S" "$cmd" >/dev/null 2>&1
  grep -qE '^(node|TRIPWIRE)' <<<"$(calls)" && ng "$cmd — 호스트 연결 금지: $(calls | tr '\n' ';')" || ok
  calls | grep -vE '^docker ' | grep -q . && ng "$cmd — docker 밖 호출: $(calls | tr '\n' ';')" || ok
done
: >"$FAKE/calls"
FAKE_NET_55432="ssh" PATH="$FAKE:$PATH" bash "$S" seed >/dev/null 2>&1
grep -q '^docker exec -i nomacom-walk-pg psql' <<<"$(calls)" && ok || ng "seed — docker exec 로"
: >"$FAKE/calls"
FAKE_NET_55432="ssh" PATH="$FAKE:$PATH" bash "$S" counts >/dev/null 2>&1
grep -q '^docker exec -i nomacom-walk-pg psql' <<<"$(calls)" && ok || ng "counts — docker exec 로"
# 정상 schema 에서도 덫은 0
schema "com.docker.backend" same >/dev/null
grep -q '^TRIPWIRE' <<<"$(calls)" && ng "schema — 덫 호출: $(calls | tr '\n' ';')" || ok

echo "client-walk-db.test: $pass pass · $fail fail"
[[ "$fail" == 0 ]]
