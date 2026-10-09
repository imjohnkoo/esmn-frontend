---
name: nomacomfe-qa-session
description: QA stage for esmn-frontend after implementation reaches DoD — dispatch a fresh-context adversarial review subagent (spec+diff only, blocker/major/minor severity, pass = blocker/major 0, re-review always with a NEW subagent), and for user-facing/write/billing/external-integration tracks run an acceptance walk of the spec's E2E verification procedure in the Orca embedded browser with state coverage. Use when implementation is done and needs verification before merge ("QA 하자", "적대적 리뷰", "acceptance walk"), before nomacomfe-finish-branch.
---

# nomacomfe-qa-session

구현 DoD 도달 후, 머지 전 QA 를 수행한다: **⑥ 적대적 리뷰** (T2+ 전면) + **⑦ acceptance walk** (트리거 해당 트랙만). `nomacomfe-finish-branch` Step 0 이 이 산출물(QA 증거)을 확인한다.

**Announce at start:** "nomacomfe-qa-session 으로 QA 를 진행합니다 — [⑥ 리뷰만 / ⑥+⑦ walk]."

## 원칙 — maker-checker

- **구현 측은 절대 자기 산출물을 인증하지 않는다.** 검증자는 반드시 fresh context — 구현자와 컨텍스트를 공유한 리뷰어는 구현자의 가정까지 물려받는다.
- **기동은 코딩 세션이 해도 된다** (기동은 채점이 아니다). 브리프가 아래 고정 문안이면 오염 경로도 닫힌다.
- 리뷰어·walk 세션은 **보고만** 한다 — 직접 수정하는 순간 maker-checker 가 무너진다. 수정은 코딩 세션 몫.
- **QA 는 아무것도 지우지 않는다** (m8-frontend 와 같은 원칙 — m8-architecture handoff `2026-09-22-qa-temp-artifacts-no-rm` 옵션 1). 임시 산출물은 처음부터 세션 스크래치패드의 전용 폴더에 만들고 남겨 둔다. `.claude/settings.json` 의 `ask: Bash(rm -rf *) · Bash(rm -r *)` 는 경로와 무관하게 사람 승인 프롬프트를 띄우므로, 리뷰어·walk 가 정리하려고 `rm` 을 부르는 순간 QA 가 사람을 붙잡는다. 권한 규칙은 바꾸지 않는다(커밋된 `ask` 는 local `allow` · 훅으로 덮이지 않는다).

## 발동 조건

| Tier  | ⑥ 적대적 리뷰                               | ⑦ acceptance walk                                                           |
| ----- | ------------------------------------------- | --------------------------------------------------------------------------- |
| T2/T3 | **전면 필수**                               | 트리거 해당 시만: **사용자 노출 신규 화면 / 쓰기·과금·PII 경로 / 외부연동** |
| T1    | diff 가 크거나(300 LOC+) 데이터 경로면 권장 | 불필요                                                                      |
| T0    | 불필요                                      | 불필요                                                                      |
| D     | 해당 없음 (코드 아님)                       | **렌더 대조**로 대체 — 오너 승인본 대비 실제 렌더 확인                      |

> ⚠️ **client 발급 플로우(verify → details → select-date → view)는 사실상 항상 ⑦ 대상**이다 — 사용자 노출 + 주문 데이터 쓰기 + 벤더(Spark/Maya) 연동이 동시에 걸린다.

## Part ⑥ — 적대적 리뷰 (fresh subagent)

### 1. 입력 준비

- diff 범위 확정: `git diff origin/dev...HEAD` (base 는 항상 `dev`). **400 LOC 초과면 plan 의 태스크 단위로 분할해 리뷰** — 초과분을 한 번에 넣으면 결함 검출률이 급락해 리뷰가 요식이 된다.
- 넘길 것은 **spec/plan 경로 + diff 뿐.** 구현 세션의 추론·요약을 브리프에 쓰지 않는다.
- **리뷰어·walk 는 워크트리를 바꾸지 않는다**(브리프 「작업 위생」 — 변이는 스크래치패드의 리포 복사본에서). 그래서 분할 리뷰를 **병렬로** 보내도 된다. 대신 코딩 세션은 리뷰가 도는 동안 그 워크트리에서 편집·커밋하지 않는다(리뷰어가 보는 HEAD 가 바뀐다).
- 실행 확인·⑦ walk 용 서버는 **코딩 세션이 봉투로** 띄운다 — `bash .claude/scripts/client-walk-server.sh dev|prod <port>`. 리뷰어·walk 는 서버를 띄우지 않는다. 브리프의 `<walk 서버 URL>` 에는 spec 절차가 요구하는 서버를 **전부** 용도와 함께 적는다 — 예: `http://127.0.0.1:3005(dev · E2E-1 · 2 · 6) · http://127.0.0.1:3006(prod 빌드 · E2E-5) · http://127.0.0.1:3007(합성 DB dev · E2E-3 · 4 · 7)`. localhost 금지(macOS 에서 `::1` 로 먼저 붙어 봉투 밖 서버에 닿는다).
- **리뷰가 도는 동안 코딩 세션은 워크트리를 편집하지 않는다**(리뷰 대상 밖 파일도) — 리뷰어의 porcelain 대조가 코딩 세션 편집과 리뷰어 흔적을 구분하지 못한다. 수정은 모든 결과가 돌아온 뒤에.
- **보내기 전후 워크트리 대조** — 디스패치는 커밋된 clean 상태에서. 리뷰어·walk 가 돌아오거나 **중단되면**(Esc · API 오류 · 컨텍스트 한도) 아래로 대조하고, 달라진 게 있으면 원인을 확인하기 전까지 커밋하지 않는다. 표식은 **디스패치 묶음마다 따로**(`<회차>`) — 뒤이은 디스패치에서 같은 파일을 다시 찍으면 앞 묶음의 기준선이 덮인다.

  ```bash
  # 보내기 전 — <M> = <스크래치패드>/pre-review-<회차>.marker  (.nuxt · .output 도 본다 — walk 서버를 깨는 사고가 거기서 난다)
  git -C <worktree> status --porcelain   # 빈 출력
  git -C <worktree> rev-parse HEAD > <M>.head
  touch <M>; find <worktree> \( -type f -o -type l \) -not -path '*/.git/*' -not -path '*/node_modules/*' | sort > <M>.files
  # 돌아오거나 중단되면
  git -C <worktree> status --porcelain; git -C <worktree> diff HEAD --stat
  [ "$(git -C <worktree> rev-parse HEAD)" = "$(cat <M>.head)" ] || echo "⛔ HEAD 가 움직였다"
  find <worktree> \( -type f -o -type l \) -not -path '*/.git/*' -not -path '*/node_modules/*' | sort | diff <M>.files -   # 생기거나 사라진 파일(gitignore · .nuxt · .output 포함)
  find <worktree> -cnewer <M> \( -type f -o -type l \) -not -path '*/.git/*' -not -path '*/node_modules/*'   # 바뀐 파일(dev 서버 HMR 이 .nuxt 를 쓰면 여기 뜬다 — 무엇인지 연다)
  find <worktree> -name node_modules -prune -o -type l -newer <M> -print   # 레시피 재실행이 워크트리 안에 만든 링크
  # node_modules 는 위에서 빠진다 — 레시피가 쓸 수 있는 통로(복사본의 node_modules 링크)가 바로 거기라 최상위만 따로 본다
  find <worktree>/node_modules <worktree>/apps/*/node_modules -maxdepth 1 -newer <M> -not -name .vite -not -name .vite-temp -not -name .cache
  find <worktree>/node_modules <worktree>/apps/*/node_modules -maxdepth 2 -name node_modules -type l   # 재실행 ln -s 가 만든 node_modules/node_modules
  ```

### 2. 서브에이전트 디스패치 — 고정 브리프

Agent 툴(general-purpose, fresh context)로 아래 문안 그대로 (경로만 치환). 「작업 위생」 · 「환경 안전」 블록은 ⑦ walk 브리프와 **같은 문안** — 한쪽만 고치지 말 것.

```
적대적 코드 리뷰. 입력은 문서와 diff 뿐이다 — 구현 과정 설명은 없다.
- spec: <spec 절대경로> / plan: <plan 절대경로>  (T1 이면 plan 만)
- diff: git -C <worktree 절대경로> diff origin/dev...HEAD -- <조각 파일들>  (필요한 파일은 직접 읽어라)
임무: spec/plan 대비 갭·버그·보안·회귀 위험을 **반증 시도** 관점으로 찾아라.
스타일·네이밍 지적 금지.
nomacom 고유 검사 항목 (해당 시 필수):
  · 주문 소유권 — 주문번호+이름+전화 3요소 검증을 서버가 하는가, 클라가 보낸 소유자
    정보를 신뢰하지 않는가 (타인 주문 접근)
  · PII — 전화번호·이메일·ICCID·활성화 코드가 로그/응답/에러 메시지에 새지 않는가
  · 벤더(Spark/Maya) API — 실패·타임아웃·부분성공 처리가 있는가, 재시도가 중복 발급을 만들지 않는가
  · 데이터 정합 — Drizzle 정의와 prod DB(TypeORM camelCase) 컬럼명이 실제로 맞는가
  · eSIM 카피 규칙 — 사용일수를 자정 기준으로 서술하지 않는가(첫 연결부터 24h rolling),
    다국가 상품에 국가별 재개통을 안내하지 않는가
검증 자산 검사 필수: 테스트가 있으면 assertion 이 실제로 있는가 / 대상 모듈을 mock 해
  통과시키지 않는가 / spec 을 검증하는가(구현 미러링 아님). 테스트가 없으면 plan 에
  사유가 명시돼 있고 대체 증거(커맨드 출력·스크린샷)가 붙었는가.
테스트 · 변이를 하나라도 실행하기 전에 <worktree 절대경로>/.claude/skills/nomacomfe-qa-session/SKILL.md
「스크래치패드 프로브 · 변이」 절을 읽는다.
스크래치패드는 부모 · 다른 서브에이전트와 공유된다 — 먼저 mktemp -d <스크래치패드 실경로>/qa-XXXXXX 로 전용 폴더를
만들어 임시 파일을 모두 그 안에 두고, 스크래치패드의 다른 파일은 열지 않는다.
작업 위생 (반드시 — 리포에 흔적을 남기지 않고, 무엇도 지우지 않는다):
a) 시작 직후 git -C <worktree 절대경로> status --porcelain 결과를 적어 둔다.
b) 임시 파일 · 디렉토리(프로브 테스트 · 설정, 리포 복사본, 임시 스크립트 · payload, 로그, 스크린샷)는 전용 폴더에만
   만든다. 워크트리 안에는 아무것도 만들지 않는다. 채증 파일은 보고에 절대경로로 적는다.
c) 반증 프로브 테스트는 리포 밖에서 — 절의 프로브 설정으로 전용 폴더의 테스트 하나만 지정해 돌린다.
d) 변이 테스트는 워크트리가 아니라 전용 폴더의 리포 복사본에서 한다(절의 레시피) — 워크트리 파일은 한 글자도
   바꾸지 않는다(walk dev 서버가 HMR 로 워크트리를 서빙하고, 다른 리뷰어가 동시에 돈다). 원복은 git archive 로
   원본을 다시 푼다. git stash · 하드 리셋 · git clean 금지(stash 는 워크트리끼리 공유된다).
e) 아무것도 지우지 않는다 — 워크트리든 스크래치패드든. rm · rm -rf · find -delete · unlink · 스크립트 안
   os.remove / shutil.rmtree 포함. 스크래치패드는 세션 임시 폴더라 남겨 둔다(rm -rf 는 경로와 무관하게 사람 승인
   프롬프트를 띄운다). 지울 것이 생겼다면 b) 를 어긴 것이다. 예외: 리포의 회귀 스크립트(*.test.sh)가 자기가 만든
   임시 폴더를 스스로 치우는 것 — 그 스크립트는 TMPDIR=<전용 폴더>/tmp 로 돌린다.
f) 보고 끝에 git status --porcelain 을 다시 찍어 a) 와 같은지 적는다(다르면 무엇이 남았는지).
환경 안전 (John 지시 2026-09-23 — 위반 금지):
- prod DB · AWS(SSM 포함) · Spark/Maya/네이버 등 벤더 API 에 접속하지 않는다. mcp maya-api · naver-smartstore 도구 호출 금지
  (발급 · SMS · 주문 변경). 실제 고객 이름 · 전화번호를 어디에도 넣지 않는다.
- 서버를 띄우거나 재시작하지 않는다 — spec 의 준비 단계(설치 · 빌드 · 서버 기동, 예: E2E-0)는 코딩 세션 몫이라 건너뛴다.
  대상은 코딩 세션이 봉투(.claude/scripts/client-walk-server.sh)로 띄운 <walk 서버 URL> 뿐 — ⑥ 리뷰어는 GET/HEAD/OPTIONS 만,
  ⑦ walk 는 브라우저로 spec 절차를 걷는다(폼 제출 · POST 포함 — 봉투 서버는 벤더 · prod 에 닿지 않는다. PortOne 테스트
  결제창은 코딩 세션이 테스트 키를 넣어 띄운 경우만). 주소는 http://127.0.0.1:<port> — localhost 금지(macOS 에서 ::1 로 먼저
  붙어 봉투 밖 서버에 닿는다).
- ps -E 는 그 walk 서버 pid 에만, 키 이름만 출력 — 이 리포 밖 프로세스의 env 는 훑지 않는다(다른 앱의 비밀 값이 찍힌다).
- .env / .env.local 을 만들지 않는다. 설치 · 빌드 · typecheck · lint · generate 계열은 **이름과 무관하게** 워크트리에서도
  복사본에서도 돌리지 않는다(.nuxt · .output · dist 를 지우고 다시 써서 떠 있는 walk 서버가 깨진다): yarn install ·
  yarn build · yarn turbo run <무엇이든>(test · lint 도 build 에 의존) · yarn workspace <앱> build/typecheck/generate/dev ·
  nuxt / npx nuxt <무엇이든> · typecheck-gate.sh · typecheck-gate.test.sh. 테스트 실행은 yarn workspace nomacom-client
  test(vitest 만 — 빌드 없음)와 절의 레시피만.
  .claude/scripts/client-walk-server.test.sh 는 리포 루트에 임시 .env 심링크를 만드므로 복사본에서만. git 쓰기 · gh 쓰기(PR ·
  설정) 금지 — .git 에 object 를 남기는 «읽기» 도 쓰기다(git merge-tree --write-tree · git hash-object -w 등).
  머지 커밋의 충돌 해소분은 git show --remerge-diff <sha>(임시 object 만 쓴다).
출력: findings 를 blocker(머지 불가) / major(수정 필요) / minor(선택) 로 분류하고,
각 항목에 파일:라인 + 구체 반증 시나리오(어떤 입력·상태에서 어떻게 틀리는가).
findings 없으면 "0건" + 실제로 검토한 범위를 보고. 수정은 금지 — 보고만. + a)·f) 의 porcelain 두 값.
```

### 3. 판정

- **통과 = blocker/major 0건.** minor 는 코딩 세션이 수용/기각 재량.
- blocker/major 존재 → 코딩 세션이 수정 → **반드시 새 subagent 로 재검** (같은 리뷰어 재사용 금지 — 이미 자기 findings 에 앵커링됨). 재검 브리프에 "직전 리뷰에서 X 가 지적돼 수정됨" 같은 문맥을 넣지 않는다.
- 심각도 판정에 구현 측과 이견이 있으면 **사람이 arbiter** — 카드 코멘트에 양쪽 논거를 남기고 칸반 스윕에서 판정받는다.

## Part ⑦ — Acceptance walk (트리거 해당 트랙만)

### 1. 세션 형태

**표준 = 같은 워크트리에 새 에이전트 터미널** (fresh context):

```bash
orca terminal create --worktree <sel> --command "claude" --json
orca terminal wait --terminal <handle> --for tui-idle --timeout-ms 120000 --json
orca terminal send --terminal <handle> --text "<아래 walk 브리프>" --enter --json
```

터미널을 띄우기 어려운 상황이면 fresh subagent 로 대체 가능 — 형태보다 **fresh context** 가 본체다.

### 2. Walk 브리프 (고정 문안)

```
QA acceptance walk. 입력: spec <절대경로> (구현 설명 없음). 수정 금지 — 보고만.
1) 코딩 세션이 봉투로 띄운 <walk 서버 URL>(http://127.0.0.1:<port>)이 떠 있는지 확인한 뒤 spec §7 「E2E 검증 절차」를
   그대로 걷는다 — Orca 내장 브라우저 전용(chrome extension 금지 · g):
     orca skills get orca-cli 로 사용법을 읽고, orca tab create --url <walk 서버 URL> --json 의 browserPageId 를 <P> 로 잡아
     orca snapshot / click / fill --page <P>, 중요 화면은 orca screenshot --page <P> 로 전용 폴더에 채증,
     orca console --page <P> / orca network --page <P> 로 에러 확인. 끝나면 orca tab close --page <P>.
2) 상태 커버리지: spec §5 가 정의한 상태 전부 — Empty / Loading / Error / 권한없음 /
   부분성공 — 를 실제로 유발해 기대 표시와 대조한다. (AI 구현은 happy path 만 만들고
   이 상태들을 빠뜨리는 것이 최다 결함 패턴)
   nomacom 추가 확인:
     · 다건 주문에서 일부만 발급 성공하는 부분성공 표시
     · 벤더 실패/타임아웃 시 사용자에게 보이는 문구와 복구 동선
     · iOS Universal Link 설치 경로 / Android 수동 코드 안내가 기기 조건별로 맞는가
     · 사용일수·다국가 로밍 카피가 memory 규칙을 위배하지 않는가
3) 데이터를 만드는 기능이면 화면 값 ↔ DB/API 원본 대조 (spec E2E 마지막 스텝) — DB 는 spec 이 정한 로컬 합성 DB 만.
테스트 · 변이를 하나라도 실행하기 전에 <worktree 절대경로>/.claude/skills/nomacomfe-qa-session/SKILL.md
「스크래치패드 프로브 · 변이」 절을 읽는다.
스크래치패드는 부모 · 다른 서브에이전트와 공유된다 — 먼저 mktemp -d <스크래치패드 실경로>/qa-XXXXXX 로 전용 폴더를
만들어 임시 파일을 모두 그 안에 두고, 스크래치패드의 다른 파일은 열지 않는다.
작업 위생 (반드시 — 리포에 흔적을 남기지 않고, 무엇도 지우지 않는다):
a) 시작 직후 git -C <worktree 절대경로> status --porcelain 결과를 적어 둔다.
b) 임시 파일 · 디렉토리(프로브 테스트 · 설정, 리포 복사본, 임시 스크립트 · payload, 로그, 스크린샷)는 전용 폴더에만
   만든다. 워크트리 안에는 아무것도 만들지 않는다. 채증 파일은 보고에 절대경로로 적는다.
c) 반증 프로브 테스트는 리포 밖에서 — 절의 프로브 설정으로 전용 폴더의 테스트 하나만 지정해 돌린다.
d) 변이 테스트는 워크트리가 아니라 전용 폴더의 리포 복사본에서 한다(절의 레시피) — 워크트리 파일은 한 글자도
   바꾸지 않는다(walk dev 서버가 HMR 로 워크트리를 서빙하고, 다른 리뷰어가 동시에 돈다). 원복은 git archive 로
   원본을 다시 푼다. git stash · 하드 리셋 · git clean 금지(stash 는 워크트리끼리 공유된다).
e) 아무것도 지우지 않는다 — 워크트리든 스크래치패드든. rm · rm -rf · find -delete · unlink · 스크립트 안
   os.remove / shutil.rmtree 포함. 스크래치패드는 세션 임시 폴더라 남겨 둔다(rm -rf 는 경로와 무관하게 사람 승인
   프롬프트를 띄운다). 지울 것이 생겼다면 b) 를 어긴 것이다. 예외: 리포의 회귀 스크립트(*.test.sh)가 자기가 만든
   임시 폴더를 스스로 치우는 것 — 그 스크립트는 TMPDIR=<전용 폴더>/tmp 로 돌린다.
f) 보고 끝에 git status --porcelain 을 다시 찍어 a) 와 같은지 적는다(다르면 무엇이 남았는지).
g) Orca 브라우저 명령은 전부 --page <browserPageId> 로 고정한다 — orca tab create 결과(또는 orca tab list --json 의
   tabs[].browserPageId)를 잡아 이후 모든 브라우저 명령에 붙인다. --page 가 없으면 같은 워크트리의 다른 세션 ·
   서브에이전트가 바꾼 활성 탭(남의 탭)에서 조용히 돈다. ref(@eN)는 같은 --page 로 찍은 스냅샷의 것만 쓰고, fill · click 의
   ok 는 증거가 아니다(화면을 다시 읽어 확인). 끝나면 자기 탭만 닫는다. 심은 쿠키 · sessionStorage 는 끝나면 되돌린다.
환경 안전 (John 지시 2026-09-23 — 위반 금지):
- prod DB · AWS(SSM 포함) · Spark/Maya/네이버 등 벤더 API 에 접속하지 않는다. mcp maya-api · naver-smartstore 도구 호출 금지
  (발급 · SMS · 주문 변경). 실제 고객 이름 · 전화번호를 어디에도 넣지 않는다.
- 서버를 띄우거나 재시작하지 않는다 — spec 의 준비 단계(설치 · 빌드 · 서버 기동, 예: E2E-0)는 코딩 세션 몫이라 건너뛴다.
  대상은 코딩 세션이 봉투(.claude/scripts/client-walk-server.sh)로 띄운 <walk 서버 URL> 뿐 — ⑥ 리뷰어는 GET/HEAD/OPTIONS 만,
  ⑦ walk 는 브라우저로 spec 절차를 걷는다(폼 제출 · POST 포함 — 봉투 서버는 벤더 · prod 에 닿지 않는다. PortOne 테스트
  결제창은 코딩 세션이 테스트 키를 넣어 띄운 경우만). 주소는 http://127.0.0.1:<port> — localhost 금지(macOS 에서 ::1 로 먼저
  붙어 봉투 밖 서버에 닿는다).
- ps -E 는 그 walk 서버 pid 에만, 키 이름만 출력 — 이 리포 밖 프로세스의 env 는 훑지 않는다(다른 앱의 비밀 값이 찍힌다).
- .env / .env.local 을 만들지 않는다. 설치 · 빌드 · typecheck · lint · generate 계열은 **이름과 무관하게** 워크트리에서도
  복사본에서도 돌리지 않는다(.nuxt · .output · dist 를 지우고 다시 써서 떠 있는 walk 서버가 깨진다): yarn install ·
  yarn build · yarn turbo run <무엇이든>(test · lint 도 build 에 의존) · yarn workspace <앱> build/typecheck/generate/dev ·
  nuxt / npx nuxt <무엇이든> · typecheck-gate.sh · typecheck-gate.test.sh. 테스트 실행은 yarn workspace nomacom-client
  test(vitest 만 — 빌드 없음)와 절의 레시피만.
  .claude/scripts/client-walk-server.test.sh 는 리포 루트에 임시 .env 심링크를 만드므로 복사본에서만. git 쓰기 · gh 쓰기(PR ·
  설정) 금지 — .git 에 object 를 남기는 «읽기» 도 쓰기다(git merge-tree --write-tree · git hash-object -w 등).
  머지 커밋의 충돌 해소분은 git show --remerge-diff <sha>(임시 object 만 쓴다).
출력: DoD 체크리스트 항목별 pass/fail + 발견 이슈(blocker/major/minor) +
걸은 시나리오 중 회귀 스위트 편입 가치가 있는 것 + 스크린샷 경로(전용 폴더 절대경로) + a)·f) 의 porcelain 두 값.
```

### 3. 종료 조건

- spec §7 DoD 전항 + blocker 0건.
- **walk ≠ 회귀 커버리지**: 세션에서 브라우저로 확인한 것은 회귀 자산이 아니다. 편입 판정된 시나리오는 테스트 코드로 승격해야 자산이 된다 — client 는 `apps/client/{server,app,shared}/**/*.test.ts` 로, DS 는 `packages/design-vue/src/__tests__/` 로 (INF-1 이후 둘 다 `turbo run test` 가 실제로 돌린다).
- 미해결 minor 는 **"알고 넘어가는 목록"** 으로 명시 — 조용히 삼키지 않는다.
- 사용자 노출 UI 변경의 **사람 최종 확인**은 칸반 스윕(하루 1~2회 `in-review` 일괄 처리)에서 — 스크린샷 채증이 그 판단 재료다.

## 스크래치패드 프로브 · 변이

⑥ · ⑦ 브리프 「작업 위생」 c) · d) 가 가리키는 절 — 워크트리를 건드리지 않고 테스트를 돌린다(2026-09-23 실측 · client vitest 4.1, porcelain 전후 동일). `<wt>` = 워크트리 절대경로, `<Q>` = 전용 폴더.

```bash
Q="$(mktemp -d <스크래치패드 실경로>/qa-XXXXXX)"; echo "$Q"   # **한 번만** — 출력된 절대경로를 이후 모든 명령에 박아 쓴다
# (Bash 호출마다 셸이 새로 떠서 $Q 는 이어지지 않는다 — 이 줄을 다시 부르면 새 폴더가 생겨 변이 · 원복 · 실행이 흩어진다)
```

**프로브**(새 반증 테스트) — 리포 설정을 절대경로 import + spread 로 상속하고 `include` 만 교체한다:

```ts
// <Q>/probe/vitest.probe.config.mts — 맨몸 import 금지(설정 번들이 스크래치패드 옆에서 vitest 패키지를 못 찾는다)
import base from '<wt>/apps/client/vitest.config.ts'
export default { ...base, test: { ...base.test, include: ['<Q>/probe/**/*.test.ts'] } }
```

```bash
# 워크트리 루트에서 — cd 하지 않는다
yarn workspace nomacom-client vitest run --config <Q>/probe/vitest.probe.config.mts <Q>/probe/<이름>.test.ts
```

앱 코드는 `~/…` 별칭(base 의 alias → 워크트리 app)이나 절대경로로 import 한다 — 상대경로는 스크래치패드 기준으로 풀린다.

**변이**(기존 테스트가 결함을 잡는지) — 리포 **복사본**에서만 한다:

```bash
mkdir -p "$Q/repo"
git -C <wt> archive HEAD apps/client package.json tsconfig.base.json | tar -x -C "$Q/repo"
# 링크는 없을 때만 — macOS ln -s 는 대상이 이미 디렉토리 링크면 그 안(= 워크트리)에 링크를 만든다(exit 0)
[ -L "$Q/repo/node_modules" ] || ln -s <wt>/node_modules "$Q/repo/node_modules"
[ -L "$Q/repo/apps/client/node_modules" ] || ln -s <wt>/apps/client/node_modules "$Q/repo/apps/client/node_modules"
# .nuxt 는 링크가 아니라 복사(1MB 남짓) — tsconfig 가 참조한다. 복사라 복사본 안의 쓰기가 워크트리로 새지 않는다
[ -d "$Q/repo/apps/client/.nuxt" ] || cp -R <wt>/apps/client/.nuxt "$Q/repo/apps/client/.nuxt"
# 복사본 파일에 변이를 넣고 실행 — 편집은 $Q/repo 의 추적 파일만(node_modules 링크 안은 실체가 워크트리다)
<wt>/node_modules/.bin/vitest run --root "$Q/repo/apps/client" "$Q/repo/apps/client/<spec 경로>"
# 원복 = 원본을 다시 푼다(rm · 백업 불필요)
git -C <wt> archive HEAD apps/client/<파일 경로> | tar -x -C "$Q/repo"
```

- ⚠️ `.nuxt` 가 없으면 «TSCONFIG_ERROR … Tsconfig not found»(실측). 복사본에서도 nuxt 명령은 돌리지 않는다(lockfile 이 없어 실패하고, 옛 레시피대로 링크했다면 워크트리 `.nuxt` 를 비운다).
- vitest 캐시(`apps/client/node_modules/.vite` · `.vite-temp` — 워크트리의 gitignore 경로)는 두 레시피가 쓴다 — 리포 산출물이 아니라 예외(porcelain 에 안 잡히고 walk 서버에 영향 없음).
- 셸 회귀(`.claude/scripts/*.test.sh` · `.github/scripts/*.test.sh`)를 변이할 때도 같은 방식 — 복사본의 스크립트를 `TMPDIR=<Q>/tmp` 로 돌린다(스크립트가 자기 위치 기준으로 ROOT 를 잡는다):

  ```bash
  mkdir -p "$Q/sh/apps/client/.output/server" "$Q/tmp"
  git -C <wt> archive HEAD .claude .github apps/client package.json | tar -x -C "$Q/sh"
  : > "$Q/sh/apps/client/.output/server/index.mjs"   # .output 스텁 — 없으면 봉투 테스트의 prod 기동 줄 검사가 조용히 빠진다
  TMPDIR="$Q/tmp" bash "$Q/sh/.claude/scripts/client-walk-server.test.sh"   # 먼저 변이 없이 — 건수가 워크트리 기준선과 같아야 한다
  ```

  `content-pending-gate.test.sh` · `guard-prod-push.test.sh` 는 워크트리를 쓰지 않아 원본 그대로 돌려도 된다(`TMPDIR=<Q>/tmp`).

- 어디서도 돌리지 않는다: `typecheck-gate.test.sh`(워크트리에 프로브 파일 + `nuxt prepare`). 워크트리에서 돌리지 않는다: `client-walk-server.test.sh`(리포 루트에 임시 `.env` 심링크).

## 산출 — QA 증거 기록 (finish-branch Step 0 이 읽는 것)

Orca 워크트리면 카드 코멘트에 한 줄 요약:

```bash
orca worktree set --worktree current \
  --comment "QA: ⑥ 통과(blocker 0/major 0/minor 2) · ⑦ walk 12/12 pass · 회귀 편입 후보: <목록> · 알고 넘어가는 목록: <minor 요약 or 없음>" --json
```

Orca 카드가 없으면 같은 내용을 plan 의 as-built 섹션에 기입(`.md`/`.html` 양쪽). 스크린샷 채증 경로도 함께.

리뷰어·walk 의 채증은 스크래치패드(세션 임시 폴더 — 보존 보장 없음)에 있다. 칸반 스윕 · as-built 에 쓸 것은 코딩 세션이 보고 직후 `$NOMACOM_WIKI/wiki/frontend/_local/qa/<트랙>/`(gitignore)로 **복사**한다 — 스크래치패드 원본은 지우지 않는다. 고객 데이터가 보이는 화면은 커밋하지 않는다.

## Red Flags

- ⛔ 구현한 세션/에이전트가 스스로 "리뷰 통과" 선언 — QA 증거로 인정되지 않는다
- ⛔ 재검을 같은 subagent 로 — 반드시 새 fresh context
- ⛔ 리뷰어·walk 세션이 코드를 직접 수정
- ⛔ 리뷰어·walk 가 워크트리 안에 임시 파일을 만들거나 워크트리 파일을 바꾼다(변이 포함) — 전용 폴더 · 리포 복사본으로
- ⛔ 리뷰어·walk · 코딩 세션이 QA 산출물을 `rm` 으로 치운다 — 스크래치패드는 남겨 둔다(`rm -rf` 는 매번 사람 승인 프롬프트)
- ⛔ 봉투 밖 서버 · `localhost` 주소로 walk — 코딩 세션이 봉투로 띄운 `http://127.0.0.1:<port>` 만
- ⛔ blocker 를 minor 로 자체 강등해 통과 처리 — 이견은 사람 arbiter 로
- ⛔ 400 LOC 초과 diff 를 통짜로 리뷰
- ⛔ "walk 에서 봤으니 됐다"로 회귀 편입 판정 생략
- ⛔ chrome extension 으로 walk 수행 — Orca 내장 브라우저가 규약

## Integration

- **선행**: 코딩 세션 DoD (`verification-before-completion` 증거 + 커밋 + 카드 `in-review`)
- **후행**: `nomacomfe-finish-branch` — Step 0 이 이 QA 증거를 확인하고 머지 옵션을 연다
- **호출 맥락**: `nomacomfe-spec-session` Stage ⑤ 의 핸드오프 브리프가 "DoD 도달 시 nomacomfe-qa-session" 을 지시한다
- **원칙 출처**: m8-frontend `m8fe-qa-session` 「작업 위생」(m8-architecture handoff `2026-09-22-qa-temp-artifacts-no-rm` §7-2) — nomacom 은 변이를 워크트리가 아니라 복사본에서 한다(walk 서버 HMR · 병렬 리뷰), 스크래치패드 삭제도 금지로 넓혔다
