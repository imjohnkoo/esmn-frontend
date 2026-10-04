---
name: nomacomfe-prod-push-check
description: Pre-flight checklist before pushing to nomacom-frontend prod or merging to the prod branch. Verifies clean working tree, paths-filter deploy impact, build for affected apps, manual UI verification, migration safety, DS version bump, and dev->prod fast-forward. Use before any push that triggers admin/client prod deploy.
---

# nomacom-frontend Prod Push Check

Prevent broken/unsafe prod deployments by running a structured pre-flight check.

**Announce at start:** "I'm using the nomacomfe-prod-push-check skill to verify prod-push readiness."

> **상태 (2026-09-02)**: 배포 파이프라인은 **가동 중**이다 — prod push 가 `admin-production.yml`/`client-production.yml` 을 트리거해 DockerHub 빌드 → CodeDeploy 로 이어진다.
> ✅ 검증 3층 가동 중 (2026-09-02): 로컬(INF-1) · PR·dev CI(INF-2, `ci.yml`) · **Dockerfile 게이트(INF-3)**.
> `prod` 브랜치에 CI 는 없지만, `apps/{admin,client}/Dockerfile` 이 `nuxt build` 직전에 typecheck 게이트를 돌리므로 **타입 에러면 이미지 자체가 안 만들어진다**.
> ⚠️ 단 게이트는 «타입» 만 본다. **동작이 맞는지는 아무도 안 본다** — Phase 4 의 UI 수동 검증이 여전히 유일한 기능 검증이다. 생략 금지.

## When to Use

**MUST use before:**

- `git push origin prod` (훅이 차단한다 — 사용자 명시 승인 필요)
- Merging any PR into `prod`
- Creating a PR targeting `prod`
- Any force-push involving `prod` (basically never — warn and stop)

**Not needed for:**

- Pushing to feature branches
- Pushing to `dev` 또는 feature 브랜치
- Local merges that don't push

## Check Phases

### Phase 1 — Working Tree Hygiene

```bash
# 1.0 올릴 SHA 를 먼저 하나로 정하고, **그 SHA 가 체크아웃된 상태에서** 모든 Phase 를 돈다 (W1-2 D-17 · QA ⑥).
#     build · UI · paths-filter · 시크릿 검사는 HEAD 를, 게이트 · push 는 PROMOTE_SHA 를 보므로 둘이 같아야 한다.
#     fetch 가 실패하면 멈춘다(오래된 ref 로 판정하지 않는다). client 를 올리면 PROMOTE_SHA = origin/dev 끝뿐이다 — Phase 4 렌더 확인이
#     HEAD = origin/dev 를 요구한다(승격에서 RC_REF 를 주지 않는다). dev 의 더 앞 SHA 로 바꿔 올리는 것은 client workflow 가 트리거되지 않는 승격
#     (Phase 2 표 — apps/client · packages/design-* · 루트 package.json · yarn.lock · deploy/scripts · appspec.yml ·
#     .github/workflows/client-production.yml 변경 0 — 실제 판정은 그 workflow 의 paths 필터)일 때만.
#     ⚠️ 점검 중에 dev 가 앞서 나가면(다른 세션의 머지) 고쳐 쓰지 말고 **Phase 1.0 부터** 새 끝으로 다시 — 앞 Phase(시크릿 · 게이트 · 테스트)가 새 커밋을 보지 않았다.
git fetch origin --quiet || exit 1
PROMOTE_SHA="$(git rev-parse origin/dev)"
git merge-base --is-ancestor "$PROMOTE_SHA" origin/dev || { echo "⛔ origin/dev 에 없는 SHA — prod 는 dev 의 한 SHA"; exit 1; }
[ "$(git rev-parse HEAD)" = "$PROMOTE_SHA" ] || { echo "⛔ HEAD ≠ PROMOTE_SHA — git checkout --detach $PROMOTE_SHA 뒤 다시"; exit 1; }
echo "PROMOTE_SHA=$PROMOTE_SHA"   # 보고 템플릿에 적어 두고, 뒤 Phase 의 셸마다 이 값으로 다시 둔다(셸 변수는 이어지지 않는다)
```

```bash
# 1.1 Clean?
git status --porcelain
```

비어있어야 함. 있으면 stash/commit 결정 필요.

```bash
# 1.2 Unpushed commits 파악
git log origin/<current-branch>..HEAD --oneline
```

```bash
# 1.3 .env / 시크릿 실수 포함 여부 (.env.example 은 제외)
git diff origin/prod...HEAD --name-only \
  | grep -E "\.env($|\.local|\.production)|credentials|secret|\.key$|\.pem$" \
  | grep -v '\.env\.example$'
```

매칭되면 **stop**. 시크릿이 staged/committed되면 안 됨.

### Phase 2 — Paths Filter 영향 분석

변경된 파일로 **어떤 앱이 재배포되는지** 판정 (`.github/workflows/admin-production.yml`, `client-production.yml` 룰 참조):

```bash
git diff origin/prod...HEAD --name-only
```

| 변경 경로                                                             | 트리거 workflow                                   |
| --------------------------------------------------------------------- | ------------------------------------------------- |
| `apps/admin/**`                                                       | admin-production.yml                              |
| `apps/client/**`                                                      | client-production.yml                             |
| `apps/mobile/**`                                                      | (별도 — Expo EAS / OTA, CodeDeploy 와 분리)       |
| `packages/design-tokens/**`                                           | **둘 다** (admin + client)                        |
| `packages/design-vue/**`                                              | **둘 다** (admin + client)                        |
| `packages/design-mobile/**`                                           | mobile only (EAS)                                 |
| `package.json`, `yarn.lock` (root)                                    | **둘 다** (admin + client)                        |
| `deploy/scripts/**`, `appspec.yml`                                    | **둘 다**                                         |
| `.github/workflows/admin-production.yml`                              | admin                                             |
| `.github/workflows/client-production.yml`                             | client                                            |
| `packages/design-*/**` (dev 브랜치 + publish 정책 채택 시)            | + design-system-publish.yml                       |
| `turbo.json`, `tsconfig.base.json`, `.yarnrc.yml`, `apps/design-*/**` | **제외** (workflow paths 필터에 없음 — 확인 필요) |

**출력 포맷**:

```
Paths-filter 영향:
  ✓ admin   (reason: apps/admin/server/api/...)
  ✓ client  (reason: packages/design-vue/components/...)
  - mobile  (reason: 변경 없음)
  - DS publish: ✗ (prod 브랜치는 publish 안 함, dev에서만)
```

### Phase 3 — Build + Typecheck 검증

Turbo로 전체 또는 영향 앱만:

```bash
yarn turbo run build --filter=nomacom-admin --filter=nomacom-client || exit 1
```

**Fail이면 stop**. 빌드 안 되는 코드 prod 금지.

```bash
# client 확정 전 문안(P9_4_PENDING) 0 — Phase 1.0 의 PROMOTE_SHA 를 본다 (W1-2 D-17).
PROMOTE_SHA=<Phase 1.0 값>
[ "$(git rev-parse HEAD)" = "$PROMOTE_SHA" ] || exit 1
# 게이트 스크립트가 없는 SHA(도입 전 통합 브랜치)는 «해당 없음» — 단 스크립트만 빠진 경우를 막으려 자리표시자 글자를 직접 찾는다
if [ -f .github/scripts/content-pending-gate.sh ]; then
  env -u CONTENT_GATE_ROOT bash .github/scripts/content-pending-gate.sh "$PROMOTE_SHA" || exit 1
else
  git grep -q -F -e P9_4_PENDING -e PENDING_LABEL -e '(확정' -e '（확정' "$PROMOTE_SHA" -- apps/client ':(exclude)*.md' ':(exclude)*.test.ts' ':(exclude)apps/client/app/content/pending.ts'
  case $? in
    1) echo "content gate: 해당 없음(게이트 도입 전 SHA · 자리표시자 0)" ;;
    0) echo "⛔ 게이트 스크립트가 없는데 자리표시자가 있다 — 중단"; exit 1 ;;
    *) echo "⛔ git grep 오류 — 검사 불가, 중단"; exit 1 ;;
  esac
fi
bash .github/scripts/typecheck-gate.sh admin || exit 1
bash .github/scripts/typecheck-gate.sh client || exit 1
```

> ✅ **INF-1(2026-09-02) 이후 `yarn turbo run typecheck` 는 실제로 돈다.** admin/client 는 `.github/scripts/typecheck-gate.sh` 를 거쳐 **기준선 초과분만** 실패한다(admin 0 / client 4건 — 2026-09-23 7 → 4). 신규 타입 에러가 있으면 여기서 걸린다 — 반드시 돌릴 것.

### Phase 4 — 영향 앱 테스트 + UI 검증

Phase 2에서 판정된 앱만 테스트:

```bash
yarn workspace @imjohnkoo/design-vue run test --run   # DS 변경 시 (137 tests — 2026-10-03)
yarn workspace nomacom-client run test                # client 변경 시 — 법정 문서 · 05-A · 05-B · 동의 문구 · 하단 시트 · 테스트 체크아웃 마운트 포함(전부 통과해야 한다 — 2026-10-04 W1-2 · W1-3 머지 기준 1363 tests)
yarn workspace nomacom-mobile run typecheck           # mobile 변경 시
```

> ⚠️ client 테스트는 순수 유닛 + 마운트(happy-dom — 하단 시트 · 테스트 체크아웃 동작 · 카탈로그 컴포넌트)뿐, admin 은 아직 0건이다. 테스트가 커버하지 못하는 화면 동작이 많으므로 **UI 수동 검증은 여전히 필수**다 — 생략 금지.

`verification-before-completion` 의 iron law 적용 — 결과를 직접 확인.

**UI 변경이 포함된 경우** 추가로:

- 영향 앱 dev 서버 띄워서 golden path 수동 검증 — admin 은 `yarn workspace nomacom-admin run dev`. **client 는 로컬 walk 안전 봉투로만**(`bash .claude/scripts/client-walk-server.sh dev <port>` → `http://127.0.0.1:<port>` — prod DB · 벤더 키 없이. John 지시 2026-09-23 · client-shell spec D-18). 실발급 · 실주문 경로는 로컬에서 걷지 않고 승격 당일 operator AC 로

- 자동 테스트는 feature correctness 가 아닌 code correctness 만 검증함

**client 가 승격 대상이면 — 미확정 값 렌더 확인(client-shell spec D-47 · D-30)**. 법정 문서 본문의 값 자리는 글자 없이 `data-pending` 표식만 남는다(D-47). D-30 이 예외로 둔 3자리(방침 4장 AWS · Solapi 행 · 옛 `/` 임시 블록(D-36)의 호스팅 줄)는 **D-54(2026-10-03)로 채워졌다** — dev 는 값 자리 0 으로 나간다. W1-2 머지(2026-10-04) 뒤로는 **모든 페이지에 푸터(사업자등록번호)** 가 있고, 카탈로그(W1-3)의 `/countries/{iso3}` · `/products/{zone}` 은 프리렌더 HTML 하나씩을 본다 · 4-step 의 details · select-date · view 는 세션 없이 들어오면 서버 가드가 `/verify/{id}?reason=reverify` 로 302 를 돌려준다(client-shell K8 — 그 응답 자체를 본다) · `/business` 는 404(D-39). 아래 `chk` 의 셋째 인자부터는 «있어도 되는 예외 자리» 인데 지금은 하나도 없다(새 예외는 spec 결정 뒤에만 넣는다). **값 자리 · «(확정 전)»(속성 · head 포함) · 자리표시자 이름이 하나라도 있거나, 응답이 이 빌드 · 이 커밋의 것이 아니거나, 본문이 비었거나, 검사하지 않는 페이지가 있으면 중단**하고 John 에게 보고한다(값이 왔으면 `legal:import` 부터). 올릴 커밋(`origin/dev`)을 체크아웃한 저장소 루트에서 그대로 돌린다(블록이 그 자리에서 빌드한다 — turbo 캐시가 맞으면 몇 초). **Phase 7 에서 prod 로 올리는 sha 는 끝 줄에 찍힌 커밋과 같아야 한다**:

```bash
# 블록이 그 자리에서 빌드한 .output 을 루프백에 · DB · 벤더 env 없이(env -i — DATABASE_URL 이 없으면 서버는 DB 에 붙지 않는다) — 화면 HTML 만 본다
bash <<'SH'
set -u
cd apps/client || exit 1
# 확인할 커밋 = 올릴 커밋 — RC_REF(기본 origin/dev = prod 로 올라가는 ref)를 받아 와 HEAD 와 같아야 한다. ⛔ 승격에서는 RC_REF 를 주지 않는다(다른 값은 블록 자체를 시험할 때만)
RC_REF="${RC_REF:-origin/dev}"
case "$RC_REF" in origin/*) git fetch -q origin "${RC_REF#origin/}" || { echo "⛔ $RC_REF 받아 오기 실패"; exit 1; } ;; esac
head="$(git rev-parse HEAD)" || { echo "⛔ git 체크아웃이 아니다"; exit 1; }
[ "$head" = "$(git rev-parse "$RC_REF^{commit}")" ] || { echo "⛔ HEAD($head) ≠ $RC_REF — dev 가 앞서 나갔다면 Phase 1.0 부터 새 끝으로 다시(PROMOTE_SHA 를 고쳐 쓰지 않는다)"; exit 1; }
# .output = 이 커밋의 빌드 — 저장소 전체 미커밋 · 추적 안 된 파일 0 에서 여기서 빌드한다(빌드 시각으로 판정하지 않는다).
# turbo 는 입력 파일 해시로 캐시를 고르므로 캐시가 맞아도 같은 소스의 산출물이다
st="$(git -C ../.. status --porcelain)" || exit 1
[ -z "$st" ] || { echo "⛔ 미커밋 · 추적 안 된 파일 — 올릴 커밋 그대로에서만:"; printf '%s\n' "$st" | head -5; exit 1; }
(cd ../.. && yarn turbo run build --filter=nomacom-client >/dev/null 2>&1) || { echo "⛔ 빌드 실패 — Phase 3 부터"; exit 1; }
[ -z "$(git -C ../.. status --porcelain)" ] || { echo "⛔ 빌드가 추적 파일을 바꿨다"; exit 1; }
PORT=3099   # 이미 누가 쓰고 있으면 중단 — 남의 서버 · 지난 빌드를 보고 통과하지 않게
if lsof -nP -iTCP:$PORT -sTCP:LISTEN >/dev/null 2>&1; then echo "⛔ $PORT 에 이미 서버가 있다 — 다른 빈 포트로"; exit 1; fi
want="$(sed -n 's/.*"id":"\([^"]*\)".*/\1/p' .output/public/_nuxt/builds/latest.json)"
[ -n "$want" ] || { echo "⛔ 빌드 id 없음 — Phase 3 빌드부터"; exit 1; }
env -i PATH="$PATH" HOME="$HOME" HOST=127.0.0.1 PORT=$PORT node .output/server/index.mjs >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV 2>/dev/null' EXIT
B=http://127.0.0.1:$PORT
for _ in $(seq 40); do curl -fsS -o /dev/null "$B/" 2>/dev/null && break; kill -0 $SRV 2>/dev/null || { echo "⛔ 서버가 뜨지 않았다"; exit 1; }; sleep 0.5; done
# get <페이지> → raw(HTML 전체 — 속성 · head · 스크립트 포함) · body(head 를 뺀 화면 글자). 응답 실패(4xx · 5xx · 연결) · 다른 빌드면 실패
# 값 자리(data-pending 표식)는 ⟦P⟧ 로 남기고 nbsp · 전각 괄호 · 공백을 정규화
get() {
  local html
  html="$(curl -fsS "$B$1")" || { echo "⛔ $1 응답 실패"; return 1; }
  printf '%s' "$html" | grep -qF "buildId:\"$want\"" || { echo "⛔ $1 이 이 빌드($want)의 응답이 아니다"; return 1; }
  raw="$(printf '%s' "$html" | tr '\n' ' ' | sed -e 's/<[^>]*data-pending[^>]*>/⟦P⟧/g' \
    -e 's/&nbsp;/ /g; s/&#160;/ /g; s/&#xa0;/ /g' -e $'s/\xc2\xa0/ /g' -e 's/（/(/g; s/）/)/g' \
    -e $'s/\xc2\xad//g; s/\xe2\x80\x8b//g; s/\xe2\x80\x8c//g; s/\xe2\x80\x8d//g; s/\xe2\x81\xa0//g; s/\xe2\x81\xa1//g; s/\xe2\x81\xa2//g; s/\xe2\x81\xa3//g; s/\xe2\x81\xa4//g; s/\xef\xbb\xbf//g' -e $'s/\xe2\x80\x87/ /g; s/\xe2\x80\xaf/ /g; s/\xe3\x80\x80/ /g' | tr -s '[:space:]' ' ')"   # 보이지 않는 글자(U+00AD · 200B~D · 2060~2064 · FEFF)는 지우고 U+2007 · 202F · 3000 은 공백으로(로케일 무관) — «(확정\u200b 전)» 도 «(확정 전)»
  body="$(printf '%s' "$raw" | sed -e 's/<head>.*<\/head>//' -e 's/<[^>]*>//g' | tr -s ' ' ' ')"
}
n() { printf '%s' "$1" | grep -oF -e "$2" | wc -l | tr -d ' '; }
left=0; seen=""
# chk <페이지> <본문 양성 대조 글자 — ; 로 여럿> [D-30 예외 자리 …] — 예외 자리 밖의 ⟦P⟧ · «(확정 전)» 은 0 · 자리마다 많아야 1
chk() {
  local p=$1 m s k ok_p=0 ok_d=0; local -a must; IFS=';' read -ra must <<<"$2"; shift 2
  get "$p" || exit 1
  local q=${p//$O/:id}; q=${q/#\/countries\/$C/\/countries\/:id}; q=${q/#\/products\/$Z/\/products\/:id}   # 동적 경로는 :id 로 센다
  seen="$seen$q"$'\n'
  must+=('704-24-01747')   # 모든 페이지에 푸터 사업자정보(W1-2 F-7)
  for m in "${must[@]}"; do [ "$(n "$body" "$m")" -ge 1 ] || { echo "⛔ $p 본문에 «$m» 이 없다(양성 대조 실패 — 빈 · 오류 화면이 0건으로 통과하지 않게)"; exit 1; }; done
  for s in "$@"; do
    k=$(n "$body" "$s"); [ "$k" -le 1 ] || { echo "⛔ $p 예외 자리 «$s» 가 ${k}번 — 자리마다 많아야 1(D-30 은 3자리뿐)"; exit 1; }
    ok_p=$((ok_p + k * $(n "$s" '⟦P⟧'))); ok_d=$((ok_d + k * $(n "$s" '(확정 전)'))); left=$((left + k))
  done
  [ "$(n "$raw" '⟦P⟧')" = "$ok_p" ] || { echo "⛔ $p 값 자리 $(n "$raw" '⟦P⟧')건 — D-30 예외 자리는 ${ok_p}건뿐"; exit 1; }
  # 글자는 양쪽에서 센다 — raw(속성 · head) 와 body(태그를 벗긴 글자 — 렌더러가 «(확정» · «전)» 을 줄바꿈 방지 span 으로 나눠 감싼다)
  for v in "$raw" "$body"; do
    [ "$(n "$v" '(확정 전)')" = "$ok_d" ] || { echo "⛔ $p «(확정 전)» $(n "$raw" '(확정 전)')건(속성 · head) · $(n "$body" '(확정 전)')건(글자) — D-30 예외 자리는 ${ok_d}건뿐(D-47)"; exit 1; }
    [ "$(n "$v" 'P9_4_PENDING')" = 0 ] || { echo "⛔ $p 에 자리표시자 이름 «P9_4_PENDING» 이 그대로 나온다"; exit 1; }
    [ "$(n "$v" '문안을 확정하고 있어요')" = 0 ] || { echo "⛔ $p 에 확정 전 안내 문안"; exit 1; }
  done
}
O=2026092300000101   # 아무 주문번호 — DB 가 없어 화면 틀만 그린다
C=fra; Z=fra00       # 프리렌더된 아무 나라 · 상품(W1-3 catalog F-9 — 카탈로그에서 라우트 목록을 만든다)
chk / '어느 나라로 떠나세요?;이미 구매하셨나요?;호스팅 서비스: AWS;1950 호 (경기도 광주시)'
chk /privacy '개인정보의 처리 목적;AWS (Amazon Web Services 서울 리전);솔라피(주);쿠키 1개를 저장합니다'
chk /terms '제1장 총칙'
chk /refund '한눈에 보기'
chk /supported-devices '지원하는지 확인해 주세요;갤럭시 (국내판)'
chk /my '로그인은 준비 중이에요;고객센터;약관 및 정책'
chk /my-esim 'eSIM 을 찾아요'
chk /guide '설치 가이드'
chk /search '국가 검색'
chk /checkout-preview '구매 전 확인;(필수) 만 14세 이상입니다;결제 전 안내'
chk /verify/$O '맞는지 확인할게요'
chk /countries/$C '프랑스 eSIM;프랑스만 가요'
chk /products/$Z '프랑스 eSIM;사용일수는 이렇게 계산해요;구매하기'
# 4-step 가드(K8) — 세션 없이 오면 서버가 verify 로 302(본문 없음). 다른 코드 · 다른 곳으로 가면 중단
guard() {
  local r; r="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' "$B$1")"
  [ "$r" = "302 $B/verify/$O?reason=reverify" ] || { echo "⛔ $1 → «$r» — 302 $B/verify/$O?reason=reverify 여야 한다(4-step 가드)"; exit 1; }
  seen="$seen${1//$O/:id}"$'\n'
}
guard /details/$O
guard /select-date/$O
guard /view/$O
r="$(curl -s -o /dev/null -w '%{http_code}' "$B/business")"   # D-39 — 페이지가 없어야 한다(되살아나거나 3xx 로 돌리면 중단)
[ "$r" = 404 ] || { echo "⛔ /business 응답 $r — 404 여야 한다(D-39)"; exit 1; }
# 검사하지 않은 페이지가 없는가 — app/pages 의 페이지 파일(Nuxt 규칙: .vue · .js · .jsx · .mjs · .ts · .tsx · 링크 따라감 · 제외는 *.{spec,test}.{js,cts,mts,ts,jsx,tsx} 만)과 위 목록이 같아야 한다(새 페이지는 chk 줄을 먼저 넣는다)
pages="$(cd app/pages && find -L . -type f \( -name '*.vue' -o -name '*.js' -o -name '*.jsx' -o -name '*.mjs' -o -name '*.ts' -o -name '*.tsx' \) ! \( \( -name '*.test.*' -o -name '*.spec.*' \) \( -name '*.js' -o -name '*.jsx' -o -name '*.ts' -o -name '*.tsx' -o -name '*.mts' -o -name '*.cts' \) \) | sed -E -e 's#^\./##' -e 's#\.(vue|m?jsx?|tsx?)$##' -e 's#^index$##' -e 's#/index$##' -e 's#\[[^]]*\]#:id#g' -e 's#^#/#' | sort)"
[ "$pages" = "$(printf '%s' "$seen" | sort)" ] || { echo "⛔ 검사 목록과 app/pages 가 다르다 — 빠진 페이지에 chk 줄을 넣는다:"; diff <(printf '%s\n' "$pages") <(printf '%s' "$seen" | sort); exit 1; }
echo "✓ 렌더 확인 통과 — 커밋 $head(= $RC_REF) · 예외 자리 ${left}(D-30 예외는 D-54 로 닫혔다 — 0 이어야 한다)"
SH
```

- ⚠️ 클래스 이름(`legal-md__pending`)이 아니라 `data-pending` 속성을 센다 — production SSR 은 컴포넌트 CSS 를 HTML 에 넣어 클래스 선택자 글자가 매 페이지에 있다.
- 양성 대조 글자(«AWS (Amazon Web Services 서울 리전)» · «솔라피(주)» · «호스팅 서비스: AWS») 는 D-54 값 채움 결과다 — 정본 rev 가 그 글자를 바꾸면 여기서 멈추니 이 블록을 먼저 고친다.
- 발급 확인 팝업 · 하단 시트(약관 · 환불 · 방침 · 지원 기기)는 열어야 그려져 SSR HTML 에 없다 — 그 글자 · 동작은 위 client 테스트가 지킨다(`legal-content.test.ts` 05-A 줄 고정 · 값 자리 수 · 생성 문서 원문에 «(확정 전)» 글자 0 · `legal-gate.test.ts` 05-A 등 생성물 코드에 값 자리 0 · `legal-links.test.ts` 동의 문구 · 링크 연결 · 시트 · 동의 문구 정적 import · `DocSheet.dom.test.ts` 시트가 «그 문서» 를 열고 닫는가). 시트 본문은 위 단독 페이지와 같은 문서를 그린다.

### Phase 5 — 마이그레이션/DB 변경 안전성

nomacom-frontend 도 Drizzle 사용 (`apps/admin/server/`, `apps/client/server/`):

```bash
# 마이그레이션 파일
git diff origin/prod...HEAD --name-only | grep -E "migrations/|schema\.ts$|drizzle\.config\.ts$"

# 대규모 UPDATE / 인덱스 변경
git diff origin/prod...HEAD | grep -iE "CREATE INDEX|DROP INDEX|ALTER TABLE|UPDATE.*SET"
```

**매칭 시 체크**:

- nomacom 의 DB ownership 구조 확인 (admin vs client vs 공유). 현재 nomacom-admin / nomacom-client 가 동일 DB 공유 여부 결정 필요
- DDL: prod DB 에 적용 계획/타이밍 확인 (배포 전/후?), lock 시간 예측
- Maya 응답 schema 변경에 대응한 컬럼 추가 등은 client 결제/조회 흐름과 동시 cutover 필요

### Phase 6 — Design System Version Bump 확인

> DS publish 는 **`dev` push 트리거** (`design-system-publish.yml`). prod 머지는 app 재배포만 트리거한다 — 두 경로는 분리돼 있다.

DS 패키지 변경이 있고 외부 consumer 에 영향 있으면 version bump 필수:

```bash
# DS 변경 여부
git diff origin/prod...HEAD --name-only \
  | grep -E "packages/design-(tokens|vue|mobile)/(src|components)"

# version bump 됐는지
git diff origin/prod...HEAD \
  packages/design-tokens/package.json \
  packages/design-vue/package.json \
  packages/design-mobile/package.json \
  | grep '"version"'
```

**판정**:

- DS src/components 변경 + version bump 없음 → 외부 consumer 영향 검토
  - 영향 있음 (API 변경, 신규 컴포넌트, 버그 수정) → version bump 후 재푸시
  - 내부 리팩터/주석만 → bump 불필요

### Phase 7 — dev↔prod 관계 확인

> ⛔ **prod↔dev sync 단계는 존재하지 않는다.** nomacom 은 브랜치 모델 (b) 확정 — `dev`(개발·DS publish — 2026-10-04 `main` 에서 이름 변경) / `prod`(배포) 2분기이고 승격은 **dev → prod 한 방향**이다 (`.claude/rules/deployment.md`). m8-frontend 의 prod↔dev sync 규약을 복사하지 말 것.

확인할 것은 **prod 가 dev 의 조상인가** — 즉 이 push 가 fast-forward 인가다.

```bash
git fetch origin --quiet || exit 1
PROMOTE_SHA=<Phase 1.0 값>          # 다시 구하지 않는다 — 게이트가 본 SHA 그대로
git log --oneline --graph origin/dev origin/prod | head -20
git merge-base --is-ancestor origin/prod "$PROMOTE_SHA" && echo "✔ fast-forward 가능" || echo "⛔ prod 가 승격 SHA 에 없는 커밋을 갖고 있다 — 되감기 위험, 중단"
# client 승격이면 — Phase 4 렌더 확인 끝 줄의 커밋이 올릴 SHA 와 같아야 한다(다른 커밋을 확인했으면 Phase 4 부터 다시)
RC=<Phase 4 끝 줄의 커밋>
[ "$RC" = "$PROMOTE_SHA" ] || echo "⛔ 렌더 확인한 커밋($RC) ≠ PROMOTE_SHA — Phase 1.0 부터 새 dev 끝으로 다시(PROMOTE_SHA 를 고쳐 쓰지 않는다)"
```

올릴 것은 **그 sha** 다(`origin/dev` 이름이 아니라 — 사용자 승인 뒤 `<RC sha>:prod`). **prod 에만 있는 커밋이 있으면 중단하고 사용자에게 보고한다.** ref 되감기는 남의 배포를 되돌리고 커밋을 소실시킨다 — `guard-prod-push.sh` 가 force 이동을 차단하는 이유다.

### Phase 8 — CI/Deploy 확인

```bash
# 최근 prod deploy 상태 확인 (이전 푸시 성공 여부)
gh run list --branch prod --limit 5 --workflow "admin-production.yml"
gh run list --branch prod --limit 5 --workflow "client-production.yml"
```

**실패한 최근 run이 있으면**: 이전 배포가 불안정 — 사용자에게 확인.

## Final Report Template

```
nomacom-frontend prod push readiness check
==========================================

Working tree:
  ✓ Clean
  ✓ No secrets detected
  ✓ <N> unpushed commits

Paths-filter impact:
  ✓ admin   (reason: apps/admin/server/api/...)
  ✓ client  (reason: packages/design-vue/components/...)
  - mobile  (reason: 변경 없음)
  - DS publish: ✗ (prod 브랜치 — publish 는 dev 에서만)

Build:        ✓ yarn turbo run build (admin, client) pass
Promote SHA:  <PROMOTE_SHA> (origin/dev 에 있음 — push 는 `git push origin <PROMOTE_SHA>:prod`, 훅이 막으므로 사용자가)
Content gate: ✓ content-pending-gate.sh <PROMOTE_SHA> exit 0 (client 확정 전 문안 0)
Typecheck:    ✓ typecheck-gate.sh (admin 0 / client 4 기준선 초과 0)
Tests:        ✓ design-vue 129 · client <n> pass  /  — admin 0건
UI manual:    ✓ admin/client golden path 검증 완료 (유일한 기능 검증)
Render check: ✓ <sha> = origin/dev · 예외 자리 0 (client 승격 시 — 올릴 sha 와 같아야)
Migrations:   ✗ none
DDL:          ✗ none
DS bump:      ✗ N/A (DS 변경 없음)

dev→prod:     ✓ fast-forward 가능 (prod 고유 커밋 0)

Recent prod deploys: all green (last 5)

READY to push. Proceed?
```

## Red Flags — Block Push

다음 중 하나라도 해당되면 **stop**:

- Working tree dirty
- Secrets/env 파일 variations committed (`.env.local`, `.env.production` 등)
- Build / Typecheck fail
- 콘텐츠 자리표시자 게이트 fail (`content-pending-gate.sh` exit 1 · 2 — 확정 전 사업자정보 · 약관 문안이 prod 에 나간다)
- Test fail
- UI 변경인데 수동 검증 미완료
- Migration 있는데 backend / DB 소유자와 합의/적용 계획 없음
- DS API 변경인데 version bump 누락
- prod 에만 있는 커밋이 있어 fast-forward 가 안 됨 (되감기 위험 — Phase 7)
- 최근 prod deploy 실패 히스토리
- **paths filter 에 안 걸리는 변경만 있는데 prod 푸시** — workflow 트리거 0 인데 사용자가 "배포됨" 으로 오인. Phase 1 에서 반드시 판정

## Integration

**Called by:**

- `nomacomfe-finish-branch` (Option 1 이 prod 를 target 으로 할 때 자동)
- 사용자 직접 호출 (PR 머지 전)

**Calls:**

- `verification-before-completion` — 각 verification step 에서 증거 원칙 적용

**Related docs:**

- `.claude/rules/deployment.md` (CodeDeploy 흐름, path filter, 브랜치 전략 (b) 확정)
- `.claude/rules/dev-process.md` (Tier·QA 게이트 — 이 skill 앞단의 `nomacomfe-finish-branch` Step 0)
- `.claude/rules/ssm-paths.md` (SSM 경로 + secret naming)
- `apps/admin/CLAUDE.md` (dual DB 구조, 운영자 인증 미구현 등 — Phase 5 DB ownership 판단의 1차 소스)
- `apps/client/CLAUDE.md` (Maya API 흐름, Nuxt 4 server import 규칙 등)

## Gotchas

Claude 가 실제로 실수했거나 빠질 수 있는 덫:

- **`.env.example` 과 `.env.local` 구분 실패**: Phase 1.3 의 grep 패턴이 `.env.example` 도 잡을 수 있어 false positive. 명시적 `grep -v '\.env\.example$'` 적용
- **DS publish 는 `dev` push 트리거**: `design-system-publish.yml` 이 `dev` 에서 돈다. prod 머지는 app 재배포만 트리거하고 DS publish 는 별개다
- **`--tolerate-republish` 함정** (publish 정책 채택 후): 같은 버전 republish 해도 CI 초록. "CI 초록 = 버전 올라간 것" 오판 금지. 실제 bump 는 `package.json` diff 로만 확인
- **Paths filter 에 없는 변경이 더 위험**: `turbo.json`, `tsconfig.base.json`, `.yarnrc.yml`, `apps/design-*/**` 은 workflow paths 필터에 없음 — 변경 시 **배포 안 되지만 로컬 dev 에서 깨질 수 있음**. PR 에 workflow paths 도 함께 수정해야 하는지 검토
- **prod↔dev sync 를 찾지 말 것**: nomacom 의 `dev` 는 통합 브랜치(2026-10-04 `main` 에서 이름 변경)이고 승격은 dev → prod 한 방향이다(브랜치 모델 (b)). m8-frontend 스킬을 참조하다 prod → dev 역동기화 단계를 만들어내는 것이 대표적 오이식이다
- **DB ownership 미확정**: m8 는 main DB 가 backend 소유라 admin/client 가 schema 변경 시 backend 합의 필수. nomacom 은 backend 가 별도 service 인지 admin server 자체에서 owns 인지 audit 필요. Phase 5 에서 이 구분 모호하면 보수적으로 "변경 보류 + 확인 요청"
- **prod push hook 차단**: `.claude/hooks/guard-prod-push.sh` 가 `git push *prod*` 차단. 본 skill 완료 후에도 사용자 명시 승인 필요
- **mobile 경로는 본 skill 범위 밖**: `apps/mobile/**` 변경은 Expo EAS / OTA 경로로 별도. CodeDeploy 파이프라인 (admin/client) 과 분리. mobile prod 배포는 EAS 채널 기준 별도 절차 필요
- **확정된 환경값** (2026-09-02 실측): registry = DockerHub `imjohnkoo/nomacom-{admin,client}:prod` · CodeDeploy application = `nomacom-admin`/`nomacom-client`, deployment group = `prod` · SSM = `/nomacom/*` (`.claude/rules/ssm-paths.md`). 이제 placeholder 가 아니다
