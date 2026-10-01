#!/usr/bin/env bash
# client-walk-db.sh — QA ⑦ 합성 DB walk 준비 (spec client-shell E2E-0 ③ · D-24). prod DB 에 닿지 않는다.
#
# John 지시(2026-09-23): 로컬 walk 에서 prod DB 의 데이터를 수정하지 않는다 · 실제 전화번호로 메시지가 가지 않는다.
#  - **어느 명령도 호스트의 55432 에 붙지 않는다** — schema · seed · counts 는 전부 컨테이너 안(docker exec … psql). 55432 에
#    ssh · SSM 터널(prod RDS)이 떠 있어도 이 스크립트는 그쪽에 연결하지 않는다(2026-10-02 — 그런 터널이 떠 있던 적이 있다).
#    호스트 포트로 붙는 것은 봉투 dev 서버뿐이고, 그쪽은 client-walk-server.sh 가 55432 리스너를 따로 판정한다.
#  - schema = drizzle-kit export(스키마 파일 → SQL · DB 연결 없음 · env -i) → 허용 문장(CREATE TABLE · INDEX · TYPE · SEQUENCE ·
#    ALTER TABLE … ADD CONSTRAINT)만인지 확인 → 표가 하나도 없을 때만 컨테이너 안 psql 로. 표가 있으면 건너뛴다(덮어쓰지 않는다)
#  - 컨테이너 nomacom-walk-pg 의 5432 는 127.0.0.1:55432 하나에만 묶인다 — 다르면(모든 인터페이스 · 다른 포트) 거부
#  - docker 는 이 기계의 데몬만 — DOCKER_HOST · 현재 컨텍스트가 unix 소켓이 아니면(원격 데몬) 거부
#  - 가짜 주문만: 이름 «테스트고객» · 전화 010-0000-xxxx(할당되지 않는 대역) · activationCode 는 LPA 모양의 가짜 값
#  - 아무것도 지우지 않는다 — 컨테이너 · 볼륨 제거 명령은 없다. seed 는 ON CONFLICT DO NOTHING(이미 있는 행은 그대로 — 바뀐 행을 되돌리지 않는다)
#
# 사용:  bash .claude/scripts/client-walk-db.sh up        # 컨테이너 기동(없으면 만들고, 멈춰 있으면 start)
#        bash .claude/scripts/client-walk-db.sh schema    # 표 만들기(apps/client/server/db/schema.ts — 컨테이너 안)
#        bash .claude/scripts/client-walk-db.sh seed      # 가짜 주문 ① 발급 완료 · ② 미발급
#        bash .claude/scripts/client-walk-db.sh counts    # E2E-7 — esim · plan · esim_issuance 행 수(주문별)
# 그다음: bash .claude/scripts/client-walk-server.sh dev <port> "$(bash .claude/scripts/client-walk-db.sh url)"
# 회귀: bash .claude/scripts/client-walk-db.test.sh
set -euo pipefail

refuse() {
  echo "⛔ $1 — 중단" >&2
  exit 2
}

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NAME=nomacom-walk-pg
IMAGE=postgres:15.12-alpine
BIND=127.0.0.1:55432
DB_URL="postgres://walk:walk@127.0.0.1:55432/walk"
[[ "$DB_URL" =~ ^postgres(ql)?://[A-Za-z0-9_]+:[A-Za-z0-9_]+@127\.0\.0\.1:55432/[A-Za-z0-9_]+$ ]] || refuse "URL 형식"

psql_in() { docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U walk -d walk "$@"; }
NODE="$(command -v node || true)"

# docker 대상 = 이 기계의 데몬(unix 소켓)만 — 원격 데몬이면 컨테이너 · 가짜 행이 남의 기계에 생긴다
check_docker() {
  [[ -z "${DOCKER_HOST:-}" || "$DOCKER_HOST" == unix://* ]] || refuse "DOCKER_HOST 가 원격이다($DOCKER_HOST) — 로컬 데몬만"
  local endpoint
  endpoint="$(docker context inspect --format '{{.Endpoints.docker.Host}}' 2>/dev/null)" || refuse "docker 컨텍스트를 확인할 수 없다"
  [[ "$endpoint" == unix://* ]] || refuse "docker 컨텍스트가 원격이다($endpoint) — 로컬 데몬만"
}

# 컨테이너의 5432 가 127.0.0.1:55432 하나에만 — 모든 인터페이스(0.0.0.0)면 walk:walk 슈퍼유저 DB 가 LAN 에 열린다
check_bind() {
  local ports
  ports="$(docker port "$NAME" 5432/tcp 2>/dev/null)" || refuse "$NAME 의 포트를 확인할 수 없다 — up 부터"
  [[ "$ports" == "$BIND" ]] || refuse "$NAME 의 5432 가 $BIND 하나에만 묶여 있지 않다($(tr '\n' ' ' <<<"$ports")) — 컨테이너를 사람이 확인"
}

case "${1:-}" in
  up | schema | seed | counts) check_docker ;;
esac

case "${1:-}" in
  url)
    echo "$DB_URL"
    ;;
  up)
    if docker inspect "$NAME" >/dev/null 2>&1; then
      [[ "$(docker inspect -f '{{.Config.Image}}' "$NAME")" == "$IMAGE" ]] || refuse "$NAME 이 다른 이미지다"
      docker start "$NAME" >/dev/null
    else
      docker run -d --name "$NAME" -p "$BIND:5432" \
        -e POSTGRES_USER=walk -e POSTGRES_PASSWORD=walk -e POSTGRES_DB=walk "$IMAGE" >/dev/null
    fi
    check_bind
    # 컨테이너 안 TCP(127.0.0.1)로 묻는다 — 첫 기동의 임시 init 서버(소켓만)를 «준비» 로 보지 않게
    for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -h 127.0.0.1 -U walk -d walk >/dev/null 2>&1 && break; sleep 1; done
    docker exec "$NAME" pg_isready -h 127.0.0.1 -U walk -d walk >/dev/null || refuse "postgres 가 준비되지 않았다"
    echo "✔ $NAME 준비 — $DB_URL"
    ;;
  schema)
    check_bind
    [[ -n "$NODE" ]] || refuse "node 가 없다"
    # 스키마 파일 → SQL(DB 연결 없음 — 설정 파일 · DATABASE_URL 을 넘기지 않는다)
    sql="$(cd "$ROOT/apps/client" && env -i "PATH=/usr/bin:/bin:$(dirname "$NODE")" "HOME=$HOME" \
      "$NODE" "$ROOT/node_modules/drizzle-kit/bin.cjs" export --dialect postgresql --schema ./server/db/schema.ts)" ||
      refuse "스키마 SQL 을 만들지 못했다"
    [[ "$sql" == *'CREATE TABLE'* ]] || refuse "스키마 SQL 에 CREATE TABLE 이 없다"
    # 문장(; 로 나눔 · -- 주석 제외)마다 허용 머리로 시작해야 한다 — 들여쓴 DROP · 쪼개진 조각도 거부
    bad="$(awk 'BEGIN { RS = ";" } {
      gsub(/--[^\n]*/, ""); gsub(/^[ \t\n]+|[ \t\n]+$/, "")
      if ($0 != "" && $0 !~ /^(CREATE (TABLE|UNIQUE INDEX|INDEX|TYPE|SEQUENCE) |ALTER TABLE "[^"]+" ADD CONSTRAINT )/) print substr($0, 1, 60)
    }' <<<"$sql")"
    [[ -z "$bad" ]] || refuse "스키마 SQL 에 허용하지 않는 문장이 있다: $(head -1 <<<"$bad")"
    tables="$(psql_in -At -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")" ||
      refuse "표 수를 읽지 못했다"
    if [[ "$tables" != 0 ]]; then
      echo "✔ 스키마가 이미 있다(표 $tables 개) — 건너뜀(덮어쓰지 않는다)"
      exit 0
    fi
    printf '%s\n' "$sql" | psql_in -q >/dev/null
    echo "✔ 스키마 — 컨테이너 $NAME 안에 표를 만들었다"
    ;;
  seed)
    check_bind
    psql_in <<'SQL'
INSERT INTO "plan-type" ("planTypeId", "planNameKr", "planDataTypeKr", "planDataLimitKr", "planDataDuration",
  "planCountriesKr", "planCountriesEng", "planCountriesIso", "timeZones")
VALUES ('WALK-FRA-7D', '프랑스 eSIM', '매일 1GB', '1GB', 7, ARRAY['프랑스'], ARRAY['France'], ARRAY['FRA'], ARRAY['Europe/Paris'])
ON CONFLICT ("planTypeId") DO NOTHING;

INSERT INTO "order" ("productOrderId", "orderId", "productOrderStatus", "productName", "productOption", "placeOrderDate",
  "quantity", "totalPaymentAmount", "optionManageCode", "customerName", "customerPhoneNumber", "receiverName", "receiverPhoneNumber")
VALUES
  (2026092300000102, 2026092300000101, 'PAYED', '프랑스 eSIM 무제한', '매일 1GB · 7일', now(), 1, 4900, 'WALK-FRA-7D',
   '테스트고객', '010-0000-0001', '테스트고객', '010-0000-0001'),
  (2026092300000202, 2026092300000201, 'PAYED', '프랑스 eSIM 무제한', '매일 1GB · 7일', now(), 1, 4900, 'WALK-FRA-7D',
   '테스트고객', '010-0000-0002', '테스트고객', '010-0000-0002')
ON CONFLICT ("productOrderId") DO NOTHING;

INSERT INTO "esim" ("esimId", "apn", "manualCode", "smdpAddress", "networkStatus", "serviceStatus", "activationCode", "orderProductOrderId")
VALUES ('WALK-ESIM-0001', 'walk.apn', 'WALK-MANUAL-0001', 'smdp.walk.invalid', 'NOT_ACTIVE', 'ACTIVE',
  'LPA:1$smdp.walk.invalid$WALK-MANUAL-0001', 2026092300000102)
ON CONFLICT ("esimId") DO NOTHING;
SQL
    echo "✔ 가짜 주문 — ① 2026092300000101(발급 완료 1) · ② 2026092300000201(미발급) · 테스트고객 / 010-0000-0001 · 0002"
    ;;
  counts)
    psql_in -At <<'SQL'
SELECT 'esim ①', count(*) FROM "esim" WHERE "orderProductOrderId" = 2026092300000102
UNION ALL SELECT 'esim ②', count(*) FROM "esim" WHERE "orderProductOrderId" = 2026092300000202
UNION ALL SELECT 'plan', count(*) FROM "plan"
UNION ALL SELECT 'esim_issuance', count(*) FROM "esim_issuance"
UNION ALL SELECT 'esim 전체', count(*) FROM "esim";
SQL
    ;;
  *)
    echo "사용: $0 up | schema | seed | counts | url" >&2
    exit 2
    ;;
esac
