#!/usr/bin/env bash
# client-walk-db.sh — QA ⑦ 합성 DB walk 준비 (spec client-shell E2E-0 ③ · D-24). prod DB 에 닿지 않는다.
#
# John 지시(2026-09-23): 로컬 walk 에서 prod DB 의 데이터를 수정하지 않는다 · 실제 전화번호로 메시지가 가지 않는다.
#  - DB 는 로컬 Docker postgres 하나 — 컨테이너 nomacom-walk-pg · 127.0.0.1:55432 에만 붙는다(다른 컨테이너 · 포트는 건드리지 않는다)
#  - URL 은 client-walk-server.sh 와 같은 전체 일치 검사(postgres://<영숫자>:<영숫자>@127.0.0.1:55432/<영숫자>)
#  - drizzle-kit push 는 env -i 로 — 셸의 DATABASE_URL(prod 일 수 있다)을 넘기지 않는다
#  - schema 는 호스트의 127.0.0.1:55432 로 붙는다 → 그 전에 두 겹 확인(2026-10-02 — 55432 에 ssh 터널(prod RDS)이 떠 있던 적이 있다):
#      ① 연결 전 — 55432 를 듣는 프로세스가 **전부** 로컬 컨테이너 계열(client-walk-server.sh 와 같은 netstat 판정). 터널이면 붙지 않고 거부
#      ② push 직전 — 컨테이너 안에서 무작위 표식을 DB 주석으로 쓰고(docker exec), 호스트 포트로 읽어(SELECT 만) 같을 때만 push
#  - 가짜 주문만: 이름 «테스트고객» · 전화 010-0000-xxxx(할당되지 않는 대역) · activationCode 는 LPA 모양의 가짜 값
#  - 아무것도 지우지 않는다 — 컨테이너 · 볼륨 제거 명령은 없다(다시 쓰려면 seed 가 같은 키로 upsert 한다)
#
# 사용:  bash .claude/scripts/client-walk-db.sh up        # 컨테이너 기동(없으면 만들고, 멈춰 있으면 start)
#        bash .claude/scripts/client-walk-db.sh schema    # drizzle-kit push (apps/client/server/db/schema.ts)
#        bash .claude/scripts/client-walk-db.sh seed      # 가짜 주문 ① 발급 완료 · ② 미발급
#        bash .claude/scripts/client-walk-db.sh counts    # E2E-7 — esim · plan · esim_issuance 행 수(주문별)
# 그다음: bash .claude/scripts/client-walk-server.sh dev <port> "$(bash .claude/scripts/client-walk-db.sh url)"
set -euo pipefail

refuse() {
  echo "⛔ $1 — 중단" >&2
  exit 2
}

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
NAME=nomacom-walk-pg
IMAGE=postgres:15.12-alpine
DB_URL="postgres://walk:walk@127.0.0.1:55432/walk"
[[ "$DB_URL" =~ ^postgres(ql)?://[A-Za-z0-9_]+:[A-Za-z0-9_]+@127\.0\.0\.1:55432/[A-Za-z0-9_]+$ ]] || refuse "URL 형식"

psql_in() { docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -U walk -d walk "$@"; }
NODE="$(command -v node || true)"

# ① 55432 리스너 — client-walk-server.sh 와 같은 판정(netstat: lsof 는 다른 uid 리스너를 못 보고 «없음» · «오류» 가 같은 exit 1)
check_listeners() {
  local netstat net listeners listener
  netstat="$(command -v netstat || true)"
  [[ -z "$netstat" && -x /usr/sbin/netstat ]] && netstat=/usr/sbin/netstat
  [[ -n "$netstat" ]] || refuse "netstat 이 없어 55432 리스너를 확인할 수 없다"
  net="$("$netstat" -anv -p tcp 2>/dev/null)" || refuse "netstat 실패 — 55432 리스너를 확인할 수 없다"
  [[ -n "$net" ]] || refuse "netstat 출력이 비었다 — 55432 리스너를 확인할 수 없다"
  listeners="$(awk '$6 == "LISTEN" && $4 ~ /[.:]55432$/ {
    for (i = 7; i <= NF; i++) if ($i ~ /^[^:]+:[0-9]+$/) { sub(/:[0-9]+$/, "", $i); print $i; break }
  }' <<<"$net" | sort -u)"
  [[ -n "$listeners" ]] || refuse "127.0.0.1:55432 를 듣는 프로세스가 없다 — up 부터"
  while IFS= read -r listener; do
    [[ "$listener" =~ ^(com\.docker\.|docker|vpnkit|postgres|OrbStack|orbstack|limactl|colima) ]] ||
      refuse "55432 를 듣는 프로세스 중 로컬 DB 가 아닌 것이 있다($listener) — 터널이면 prod 다. 붙지 않는다"
  done <<<"$listeners"
}

# ② 호스트 포트로 읽은 DB 주석(SELECT 만 — 쓰기 없음). 접속 실패면 빈 값
host_marker() {
  [[ -n "$NODE" ]] || refuse "node 가 없다"
  env -i "PATH=/usr/bin:/bin:$(dirname "$NODE")" "HOME=$HOME" "DATABASE_URL=$DB_URL" "WALK_ROOT=$ROOT" \
    "$NODE" --input-type=module -e "
      import { createRequire } from 'node:module'
      const postgres = createRequire(process.env.WALK_ROOT + '/apps/client/package.json')('postgres')
      const sql = postgres(process.env.DATABASE_URL, { max: 1, connect_timeout: 5, onnotice: () => {} })
      try {
        const [row] = await sql\`select shobj_description(oid, 'pg_database') as c from pg_database where datname = current_database()\`
        console.log(row?.c ?? '')
      } finally {
        await sql.end({ timeout: 1 })
      }
    " 2>/dev/null || true
}

case "${1:-}" in
  url)
    echo "$DB_URL"
    ;;
  up)
    if docker inspect "$NAME" >/dev/null 2>&1; then
      [[ "$(docker inspect -f '{{.Config.Image}}' "$NAME")" == "$IMAGE" ]] || refuse "$NAME 이 다른 이미지다"
      docker start "$NAME" >/dev/null
    else
      docker run -d --name "$NAME" -p 127.0.0.1:55432:5432 \
        -e POSTGRES_USER=walk -e POSTGRES_PASSWORD=walk -e POSTGRES_DB=walk "$IMAGE" >/dev/null
    fi
    for _ in $(seq 1 30); do docker exec "$NAME" pg_isready -U walk -d walk >/dev/null 2>&1 && break; sleep 1; done
    docker exec "$NAME" pg_isready -U walk -d walk >/dev/null || refuse "postgres 가 준비되지 않았다"
    echo "✔ $NAME 준비 — $DB_URL"
    ;;
  schema)
    check_listeners
    marker="nomacom-walk-$(od -An -N8 -tx1 /dev/urandom | tr -d ' \n')"
    [[ "$marker" =~ ^nomacom-walk-[0-9a-f]{16}$ ]] || refuse "표식을 만들지 못했다"
    psql_in -c "COMMENT ON DATABASE walk IS '$marker'" >/dev/null || refuse "$NAME 컨테이너에 표식을 쓰지 못했다 — up 부터"
    [[ "$(host_marker)" == "$marker" ]] ||
      refuse "127.0.0.1:55432 가 $NAME 컨테이너가 아니다(표식 불일치) — 다른 DB(터널이면 prod)에 push 하지 않는다"
    cd "$ROOT/apps/client"
    env -i "PATH=/usr/bin:/bin:$(dirname "$NODE")" "HOME=$HOME" "DATABASE_URL=$DB_URL" \
      "$NODE" "$ROOT/node_modules/drizzle-kit/bin.cjs" push --config drizzle.config.ts --force
    ;;
  seed)
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
