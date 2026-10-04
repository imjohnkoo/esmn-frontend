#!/usr/bin/env bash
# client-walk-server.sh — apps/client 로컬 walk 전용 서버 (QA ⑦ · spec client-shell E2E-0 ③ · D-18)
#
# John 지시(2026-09-23): 로컬 walk 에서 prod DB 의 데이터를 수정하지 않는다 · 실제 전화번호로 메시지가 가지 않는다.
# 안전 봉투:
#  1. env -i 로 셸 환경을 버리고 허용 목록만 넘긴다. 셸의 SPARK_* · MAYA_* · ESIM_MANAGER_INTERNAL_* · CORS_EXTRA_ORIGINS 는
#     넘기지 않는다 → activate 는 벤더 호출 · DB 쓰기 전에(useSparkApi / useMayaApi 첫 줄) 실패하고, 취소철회는 DB 조회
#     전에 503 이다. Spark/Maya 실발급 · backend 위임 · 네이버 호출 · 알림 경로 0 (client 에 SMS · 알림톡 코드는 없다).
#     CORS_EXTRA_ORIGINS 는 봉투가 http://127.0.0.1:<port> 한 값만 만든다 — 브라우저는 같은 출처 POST 에도
#     Origin 을 붙이므로 이것 없이는 walk 포트의 /api/** 가 403 이다.
#  2. yarn 을 거치지 않고 node 로 직접 띄운다(yarn 의 .env.yarn 주입 차단) · 127.0.0.1 에만 묶는다.
#     주소는 전부 http://127.0.0.1:<port> — `localhost` 는 macOS 에서 ::1 로 먼저 붙어, 같은 포트의 **봉투 밖 서버**
#     ([::1] 에 뜬 다른 워크트리의 yarn dev 등)에 닿는다. 그래서 그 포트를 어느 주소든 누가 듣고 있으면 기동을 거부한다
#     (nuxi 가 조용히 다른 포트로 옮겨 가는 것도 막는다).
#     dev 는 --dotenv /dev/null — 기동 뒤에 .env 가 생겨도 nuxt 가 재시작하며 읽어 들이지 않게(기본은 .env 를 감시한다).
#  3. DATABASE_URL 은 dev 모드에서만, postgres://<영숫자>:<영숫자>@127.0.0.1:55432/<영숫자> 전체 일치만 받고,
#     실제 기동 때 55432 를 듣는 프로세스가 **전부** 로컬 컨테이너 · postgres 인지 본다(SSM · ssh 터널로 prod RDS 를
#     55432 에 연 경우 차단 — Docker 와 터널이 함께 있어도 거부). 검사는 기동 때 한 번 — DB walk 중 55432 에 다른 것을
#     열지 않는다. prod 모드는 DB 인자를 거부한다 — prod 빌드는 ssl:require 라 닿는 곳이 TLS 를 말하는 prod RDS 뿐이다.
#  4. 이 워크트리의 apps/client/.env(.local) · 루트 .env(.local) 가 있으면 기동 거부. nuxt 는 apps/client 에서 dotenv 를
#     읽는다 — 메인 클론 파일은 영향이 없어 보지 않는다(워크트리의 .env.local 심링크는 그 링크만 지운다 · 원본 금지).
#  5. NUXT_PUBLIC_PORTONE_STORE_ID · NUXT_PUBLIC_PORTONE_TEST_CHANNEL_KEY(공개값)만 호출자 환경에서 받는다 — E2E-6 용.
#
# 사용:  bash .claude/scripts/client-walk-server.sh dev  <port> [합성 DB url]   # nuxt dev(dev 는 DB ssl:false → 합성 DB 가능)
#        bash .claude/scripts/client-walk-server.sh prod <port>                 # .output 빌드 · DB 없음(헤더 · noindex 확인용)
#        WALK_DRY_RUN=1 bash … dev 3005                                          # 넘길 env 만 출력하고 끝
#        브라우저는 http://127.0.0.1:<port> 로 연다(localhost 금지 — 위 2).
# 증거:  ps -E -o command= -p <pid> | tr ' ' '\n' | sed -nE 's/^([A-Za-z_][A-Za-z0-9_]*)=.*/\1/p' | sort   # 키 이름만(값은 찍지 않는다)
#        → PATH HOME PORT HOST NUXT_PUBLIC_GUEST_APP_ORIGIN CORS_EXTRA_ORIGINS (+ DATABASE_URL · NUXT_PUBLIC_PORTONE_*)
#          · DB 호스트는 ps -E … | tr ' ' '\n' | sed -nE 's#^DATABASE_URL=[^@]*@([^/]*)/.*#\1#p' = 127.0.0.1:55432
# 회귀:  bash .claude/scripts/client-walk-server.test.sh (가짜 node 로 실제 기동 경로까지 본다)
set -euo pipefail

refuse() {
  echo "⛔ $1 — 기동 거부" >&2
  exit 2
}

MODE="${1:-}"
PORT="${2:-}"
DB_URL="${3:-}"
[[ "$MODE" == dev || "$MODE" == prod ]] || refuse "사용: $0 dev|prod <port> [합성 DB url]"
[[ "$PORT" =~ ^[1-9][0-9]{3,4}$ ]] || refuse "포트는 숫자 4~5자리(앞자리 0 금지 — 03005 는 nuxi 에겐 3005 인데 netstat 검사는 비껴간다)"
[[ "$PORT" -ge 1024 && "$PORT" -le 65535 ]] || refuse "포트는 1024~65535(특권 포트는 바인드 실패 시 nuxi 가 다른 포트로 옮겨 간다)"
# get-port-please(3.2.0, nuxi dev)가 버리는 unsafe 포트 — 받으면 nuxi 가 검사 안 한 3000~3100 의 다른 포트로 옮겨 간다.
# 회귀 테스트가 이 목록을 get-port-please 의 isSafePort 와 대조한다(목록이 어긋나면 실패)
UNSAFE_PORTS=" 1719 1720 1723 2049 3659 4045 5060 5061 6000 6566 6665 6666 6667 6668 6669 6697 10080 "
case "$UNSAFE_PORTS" in
  *" $PORT "*) refuse "포트 $PORT 는 브라우저 · get-port-please 가 막는 unsafe 포트 — 다른 포트로" ;;
esac

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

for f in "$ROOT/apps/client/.env" "$ROOT/apps/client/.env.local" "$ROOT/.env" "$ROOT/.env.local"; do
  if [[ -e "$f" || -L "$f" ]]; then
    refuse "$f 가 있다 — prod 값 유입 위험 (워크트리의 심링크면 링크만 지운다 · 메인 클론 원본은 건드리지 않는다)"
  fi
done

if [[ -n "$DB_URL" ]]; then
  [[ "$MODE" == dev ]] || refuse "prod 모드는 DB 인자를 받지 않는다"
  [[ "$DB_URL" =~ ^postgres(ql)?://[A-Za-z0-9_]+:[A-Za-z0-9_]+@127\.0\.0\.1:55432/[A-Za-z0-9_]+$ ]] ||
    refuse "DATABASE_URL 은 postgres://<영숫자>:<영숫자>@127.0.0.1:55432/<영숫자> 만 허용"
fi

NODE="$(command -v node)"
ALLOW=(
  "PATH=/usr/bin:/bin:/usr/sbin:/sbin:$(dirname "$NODE")"
  "HOME=$HOME"
  "PORT=$PORT"
  "HOST=127.0.0.1"
  "NUXT_PUBLIC_GUEST_APP_ORIGIN=http://127.0.0.1:$PORT"
  "CORS_EXTRA_ORIGINS=http://127.0.0.1:$PORT"
)
if [[ -n "$DB_URL" ]]; then ALLOW+=("DATABASE_URL=$DB_URL"); fi
for key in NUXT_PUBLIC_PORTONE_STORE_ID NUXT_PUBLIC_PORTONE_TEST_CHANNEL_KEY; do
  if [[ -n "${!key:-}" ]]; then ALLOW+=("$key=${!key}"); fi
done

if [[ -n "${WALK_DRY_RUN:-}" ]]; then
  printf '%s\n' "${ALLOW[@]}" | sed -E 's/^(NUXT_PUBLIC_PORTONE_[A-Z_]+)=.*/\1=***/'
  exit 0
fi

# 리스너 판정은 netstat — lsof 는 다른 uid(root 등) 소유 리스너를 안 보여 주고 «없음» 과 «오류» 가 같은 exit 1 이다.
# macOS netstat -anv 는 소유자와 무관하게 LISTEN 소켓과 process:pid 를 보여 준다. 검사를 못 하면 기동하지 않는다.
NETSTAT="$(command -v netstat || true)"
[[ -z "$NETSTAT" && -x /usr/sbin/netstat ]] && NETSTAT=/usr/sbin/netstat
[[ -n "$NETSTAT" ]] || refuse "netstat 이 없어 포트 · DB 리스너를 확인할 수 없다"
NET="$("$NETSTAT" -anv -p tcp 2>/dev/null)" || refuse "netstat 실패 — 포트 · DB 리스너를 확인할 수 없다"
[[ -n "$NET" ]] || refuse "netstat 출력이 비었다 — 포트 · DB 리스너를 확인할 수 없다"
listeners_of() { # 포트 → 그 포트(어느 주소든)를 LISTEN 하는 프로세스 이름들(netstat 은 16자에서 자른다)
  awk -v port="$1" '$6 == "LISTEN" && $4 ~ ("[.:]" port "$") {
    for (i = 7; i <= NF; i++) if ($i ~ /^[^:]+:[0-9]+$/) { sub(/:[0-9]+$/, "", $i); print $i; break }
  }' <<<"$NET" | sort -u
}
answers() { # 그 포트에 127.0.0.1 · ::1 로 붙어지는가 — netstat 해석이 어긋나도 막히는 쪽으로
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && return 0
  (exec 3<>"/dev/tcp/::1/$1") 2>/dev/null && return 0
  return 1
}

# walk 포트를 어느 주소(127.0.0.1 · ::1 · *)든 누가 듣고 있으면 거부 — localhost 가 봉투 밖 서버로 가거나 nuxi 가 포트를 옮긴다
busy="$(listeners_of "$PORT" | tr '\n' ' ')"
[[ -z "$busy" ]] || refuse "포트 $PORT 를 이미 듣는 프로세스가 있다($busy) — 다른 포트로"
if answers "$PORT"; then refuse "포트 $PORT 에 이미 무언가 응답한다(netstat 에 안 보이는 리스너) — 다른 포트로"; fi

if [[ -n "$DB_URL" ]]; then
  # 55432 를 듣는 프로세스가 **전부** 로컬 컨테이너 · postgres 여야 한다 — SSM 포트포워딩 · ssh 터널이면 prod RDS 다
  listeners="$(listeners_of 55432)"
  if [[ -z "$listeners" ]] && answers 55432; then refuse "55432 가 응답하는데 리스너를 확인할 수 없다 — 소유자 불명"; fi
  [[ -n "$listeners" ]] || refuse "127.0.0.1:55432 를 듣는 프로세스가 없다 — 합성 DB 컨테이너부터"
  while IFS= read -r listener; do
    [[ "$listener" =~ ^(com\.docker\.|docker|vpnkit|postgres|OrbStack|orbstack|limactl|colima) ]] ||
      refuse "55432 를 듣는 프로세스 중 로컬 DB 가 아닌 것이 있다($listener) — 터널이면 prod 다"
  done <<<"$listeners"
fi

cd "$ROOT/apps/client"
if [[ "$MODE" == dev ]]; then
  exec env -i "${ALLOW[@]}" "$NODE" "$ROOT/node_modules/nuxt/bin/nuxt.mjs" dev --port "$PORT" --host 127.0.0.1 --dotenv /dev/null
fi
[[ -f .output/server/index.mjs ]] || refuse ".output 없음 — yarn turbo run build --filter=nomacom-client 먼저"
exec env -i "${ALLOW[@]}" "$NODE" .output/server/index.mjs
