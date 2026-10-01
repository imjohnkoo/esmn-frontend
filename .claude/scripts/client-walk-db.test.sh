#!/usr/bin/env bash
# client-walk-db.sh 회귀 테스트 — DB · 컨테이너에 닿지 않는다(PATH 앞의 가짜 docker · node + 호스트 DB 도구 덫).
# 지키는 것: 어느 명령도 호스트의 55432 에 붙지 않는다 — 명령마다 docker 호출 목록이 정확히 정해져 있고(그 밖의 호출 0),
# schema 는 drizzle-kit export(DB 연결 없음)를 컨테이너 안 psql 로 넣으며, 원격 docker · 잘못 묶인 컨테이너는 거부한다.
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

# 가짜 docker — 부른 것을 한 줄씩 기록. 상태는 $FAKE 의 파일(exists · image · port · tables · endpoint)로 준다.
# psql 의 표준 입력은 -q(스키마) → applied.sql, 그 밖(seed) → seed.sql 에 남긴다
cat >"$FAKE/docker" <<'EOF'
#!/bin/sh
F="@FAKE@"
case "$1 $2" in
  "context inspect") cat "$F/endpoint"; exit 0 ;;
esac
echo "docker $*" >>"$F/calls"
case "$*" in
  "inspect -f {{.Config.Image}} nomacom-walk-pg") cat "$F/image"; exit 0 ;;
  "inspect nomacom-walk-pg") [ -f "$F/exists" ]; exit $? ;;
  "port nomacom-walk-pg 5432/tcp") cat "$F/port"; exit 0 ;;
  *"-At -c SELECT count(*) FROM information_schema.tables"*) cat "$F/tables"; exit 0 ;;
  "exec -i nomacom-walk-pg psql -v ON_ERROR_STOP=1 -U walk -d walk -q") cat >"$F/applied.sql"; exit 0 ;;
  "exec -i nomacom-walk-pg psql -v ON_ERROR_STOP=1 -U walk -d walk") cat >"$F/seed.sql"; exit 0 ;;
esac
exit 0
EOF
# 가짜 node — drizzle-kit export 만 응답($FAKE/export.sql · export_fail 이면 실패). env 를 기록한다(env -i 안에서 불린다)
cat >"$FAKE/node" <<'EOF'
#!/bin/sh
F="@FAKE@"
case "$*" in
  *drizzle-kit/bin.cjs\ export\ --dialect\ postgresql\ --schema\ ./server/db/schema.ts)
    echo "node export cwd=$(basename "$(pwd)") DATABASE_URL=${DATABASE_URL:-} SPARK=${SPARK_API_TOKEN:-}" >>"$F/calls"
    [ -f "$F/export_fail" ] && exit 1
    cat "$F/export.sql"
    ;;
  *) echo "node other $*" >>"$F/calls"; exit 1 ;;
esac
EOF
# 덫 — 호스트에서 DB 포트에 붙을 만한 도구는 부르는 순간 기록 + 실패
for tool in psql pg_dump pg_isready nc ncat telnet curl wget socat ssh netstat lsof; do
  printf '#!/bin/sh\necho "TRIPWIRE %s $*" >>"%s/calls"\nexit 1\n' "$tool" "$FAKE" >"$FAKE/$tool"
  chmod +x "$FAKE/$tool"
done
sed -i.bak "s#@FAKE@#$FAKE#" "$FAKE/docker" "$FAKE/node"
chmod +x "$FAKE/docker" "$FAKE/node"
export SPARK_API_TOKEN=leak DATABASE_URL=postgres://u:p@prod.example.com:5432/db
GOOD_SQL='CREATE TABLE "esim" (
	"esim_id" bigserial PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "esim" ADD CONSTRAINT "esim_fk" FOREIGN KEY ("x") REFERENCES "public"."order"("y");'

reset_state() {
  : >"$FAKE/calls"
  echo "unix:///var/run/docker.sock" >"$FAKE/endpoint"
  echo "postgres:15.12-alpine" >"$FAKE/image"
  echo "127.0.0.1:55432" >"$FAKE/port"
  echo 0 >"$FAKE/tables"
  printf '%s\n' "$GOOD_SQL" >"$FAKE/export.sql"
  touch "$FAKE/exists"
  for f in applied.sql seed.sql export_fail; do [[ -e "$FAKE/$f" ]] && mv "$FAKE/$f" "$FAKE/$f.old.$RANDOM"; done
  return 0
}
run() { PATH="$FAKE:$PATH" bash "$S" "$@" >/dev/null 2>&1; echo $?; }
calls() { cat "$FAKE/calls"; }
expect_calls() { # 이름 · 기대 호출(줄바꿈 구분) — 정확히 같아야 한다(그 밖의 호출 0)
  [[ "$(calls)" == "$2" ]] && ok || ng "$1 — 호출 목록이 다르다:
--- 기대
$2
--- 받은 것
$(calls)"
}
P='docker exec -i nomacom-walk-pg psql -v ON_ERROR_STOP=1 -U walk -d walk'
COUNT="$P -At -c SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'"
EXPORT='node export cwd=client DATABASE_URL= SPARK='

# ── 정적 — 스크립트에 호스트 DB 연결 길이 없다(주석 제외)
code_only="$(grep -vE '^[[:space:]]*#' "$S")"
for pat in 'DATABASE_URL=' '/dev/tcp' 'host\.docker\.internal' 'drizzle-kit/bin\.cjs" push' 'psql -h' '--network'; do
  grep -qE -- "$pat" <<<"$code_only" && ng "스크립트에 «$pat» 가 있다" || ok
done

# ── 원격 docker 는 어떤 명령이든 거부 — 아무것도 부르지 않는다
for cmd in up schema seed counts; do
  reset_state
  [[ "$(DOCKER_HOST=tcp://remote.example:2376 run "$cmd")" == 2 ]] && ok || ng "DOCKER_HOST 원격 · $cmd — exit 2"
  expect_calls "DOCKER_HOST 원격 · $cmd" ""
  reset_state
  echo "ssh://me@remote.example" >"$FAKE/endpoint"
  [[ "$(run "$cmd")" == 2 ]] && ok || ng "원격 컨텍스트 · $cmd — exit 2"
  expect_calls "원격 컨텍스트 · $cmd" ""
done

# ── url — 아무것도 부르지 않는다
reset_state
[[ "$(run url)" == 0 ]] && ok || ng "url — exit 0"
expect_calls "url" ""

# ── up — 새로 만들 때 127.0.0.1:55432 에만 · 있으면 이미지 확인 뒤 start · 묶임이 다르면 거부 · 준비 판정은 컨테이너 안 TCP
reset_state
mv "$FAKE/exists" "$FAKE/exists.old.$RANDOM"
[[ "$(run up)" == 0 ]] && ok || ng "up(새로) — exit 0"
expect_calls "up(새로)" "docker inspect nomacom-walk-pg
docker run -d --name nomacom-walk-pg -p 127.0.0.1:55432:5432 -e POSTGRES_USER=walk -e POSTGRES_PASSWORD=walk -e POSTGRES_DB=walk postgres:15.12-alpine
docker port nomacom-walk-pg 5432/tcp
docker exec nomacom-walk-pg pg_isready -h 127.0.0.1 -U walk -d walk
docker exec nomacom-walk-pg pg_isready -h 127.0.0.1 -U walk -d walk"
reset_state
[[ "$(run up)" == 0 ]] && ok || ng "up(있음) — exit 0"
expect_calls "up(있음)" "docker inspect nomacom-walk-pg
docker inspect -f {{.Config.Image}} nomacom-walk-pg
docker start nomacom-walk-pg
docker port nomacom-walk-pg 5432/tcp
docker exec nomacom-walk-pg pg_isready -h 127.0.0.1 -U walk -d walk
docker exec nomacom-walk-pg pg_isready -h 127.0.0.1 -U walk -d walk"
reset_state
echo "postgres:16" >"$FAKE/image"
[[ "$(run up)" == 2 ]] && ok || ng "up(다른 이미지) — exit 2"
for port in "0.0.0.0:55432" "127.0.0.1:55433" "127.0.0.1:55432
[::]:55432"; do
  reset_state
  printf '%s\n' "$port" >"$FAKE/port"
  [[ "$(run up)" == 2 ]] && ok || ng "up(묶임 «$port») — exit 2"
  grep -q 'pg_isready' <<<"$(calls)" && ng "up(묶임 «$port») — 준비 판정까지 가면 안 됨" || ok
done

# ── schema — export(DB 연결 없음 · 셸 env 없음) → 허용 문장 → 표가 없을 때만 컨테이너 안 psql
reset_state
[[ "$(run schema)" == 0 ]] && ok || ng "schema — exit 0"
expect_calls "schema" "docker port nomacom-walk-pg 5432/tcp
$EXPORT
$COUNT
$P -q"
[[ "$(cat "$FAKE/applied.sql" 2>/dev/null)" == "$GOOD_SQL" ]] && ok || ng "schema — 넣은 SQL = export 출력 그대로"
reset_state
echo 3 >"$FAKE/tables"
[[ "$(run schema)" == 0 ]] && ok || ng "schema(표 있음) — exit 0(건너뜀)"
expect_calls "schema(표 있음)" "docker port nomacom-walk-pg 5432/tcp
$EXPORT
$COUNT"
for bad in 'DROP TABLE "order";' '  DROP TABLE "order";' 'ALTER TABLE "esim" DROP COLUMN "a";' 'TRUNCATE "order";' 'UPDATE "order" SET "x" = 1;'; do
  reset_state
  printf '%s\n%s\n' "$GOOD_SQL" "$bad" >"$FAKE/export.sql"
  [[ "$(run schema)" == 2 ]] && ok || ng "schema(«$bad») — exit 2"
  expect_calls "schema(«$bad»)" "docker port nomacom-walk-pg 5432/tcp
$EXPORT"
done
reset_state
touch "$FAKE/export_fail"
[[ "$(run schema)" == 2 ]] && ok || ng "schema(export 실패) — exit 2"
reset_state
printf 'SELECT 1;\n' >"$FAKE/export.sql"
[[ "$(run schema)" == 2 ]] && ok || ng "schema(CREATE TABLE 없음) — exit 2"
reset_state
echo "0.0.0.0:55432" >"$FAKE/port"
[[ "$(run schema)" == 2 ]] && ok || ng "schema(묶임 다름) — exit 2"
expect_calls "schema(묶임 다름)" "docker port nomacom-walk-pg 5432/tcp"

# ── seed · counts — 컨테이너 안 psql 한 번씩만
reset_state
[[ "$(run seed)" == 0 ]] && ok || ng "seed — exit 0"
expect_calls "seed" "docker port nomacom-walk-pg 5432/tcp
$P"
grep -q "ON CONFLICT" "$FAKE/seed.sql" 2>/dev/null && ok || ng "seed — SQL 이 컨테이너 psql 의 표준 입력으로"
grep -qE "010-0000-000[12]" "$FAKE/seed.sql" && ! grep -qE "010-[1-9]" "$FAKE/seed.sql" && ok || ng "seed — 전화는 010-0000-xxxx 대역만"
reset_state
echo "0.0.0.0:55432" >"$FAKE/port"
[[ "$(run seed)" == 2 ]] && ok || ng "seed(묶임 다름) — exit 2"
expect_calls "seed(묶임 다름)" "docker port nomacom-walk-pg 5432/tcp"
reset_state
[[ "$(run counts)" == 0 ]] && ok || ng "counts — exit 0"
expect_calls "counts" "$P -At"

echo "client-walk-db.test: $pass pass · $fail fail"
[[ "$fail" == 0 ]]
