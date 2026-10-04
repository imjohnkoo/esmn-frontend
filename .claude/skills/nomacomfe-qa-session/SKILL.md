---
name: nomacomfe-qa-session
description: QA stage for nomacom-frontend after implementation reaches DoD — dispatch a fresh-context adversarial review subagent (spec+diff only, blocker/major/minor severity, pass = blocker/major 0, re-review always with a NEW subagent), and for user-facing/write/billing/external-integration tracks run an acceptance walk of the spec's E2E verification procedure in the Orca embedded browser with state coverage. Use when implementation is done and needs verification before merge ("QA 하자", "적대적 리뷰", "acceptance walk"), before nomacomfe-finish-branch.
---

# nomacomfe-qa-session

구현 DoD 도달 후, 머지 전 QA 를 수행한다: **⑥ 적대적 리뷰** (T2+ 전면) + **⑦ acceptance walk** (트리거 해당 트랙만). `nomacomfe-finish-branch` Step 0 이 이 산출물(QA 증거)을 확인한다.

**Announce at start:** "nomacomfe-qa-session 으로 QA 를 진행합니다 — [⑥ 리뷰만 / ⑥+⑦ walk]."

## 원칙 — maker-checker

- **구현 측은 절대 자기 산출물을 인증하지 않는다.** 검증자는 반드시 fresh context — 구현자와 컨텍스트를 공유한 리뷰어는 구현자의 가정까지 물려받는다.
- **기동은 코딩 세션이 해도 된다** (기동은 채점이 아니다). 브리프가 아래 고정 문안이면 오염 경로도 닫힌다.
- 리뷰어·walk 세션은 **보고만** 한다 — 직접 수정하는 순간 maker-checker 가 무너진다. 수정은 코딩 세션 몫.

## 발동 조건

| Tier  | ⑥ 적대적 리뷰                               | ⑦ acceptance walk                                                           |
| ----- | ------------------------------------------- | --------------------------------------------------------------------------- |
| T2/T3 | **전면 필수**                               | 트리거 해당 시만: **사용자 노출 신규 화면 / 쓰기·과금·PII 경로 / 외부연동** |
| T1    | diff 가 크거나(300 LOC+) 데이터 경로면 권장 | 불필요                                                                      |
| T0    | 불필요                                      | 불필요                                                                      |
| D     | 해당 없음 (코드 아님)                       | **렌더 대조**로 대체 — 오너 승인본 대비 실제 렌더 확인                      |

> ⚠️ **client 발급 플로우(verify → details → select-date → view)는 사실상 항상 ⑦ 대상**이다 — 사용자 노출 + 주문 데이터 쓰기 + Maya 연동이 동시에 걸린다.

## Part ⑥ — 적대적 리뷰 (fresh subagent)

### 1. 입력 준비

- diff 범위 확정: `git diff origin/dev...HEAD` (base 는 항상 `dev`). **400 LOC 초과면 plan 의 태스크 단위로 분할해 리뷰** — 초과분을 한 번에 넣으면 결함 검출률이 급락해 리뷰가 요식이 된다.
- 넘길 것은 **spec/plan 경로 + diff 뿐.** 구현 세션의 추론·요약을 브리프에 쓰지 않는다.

### 2. 서브에이전트 디스패치 — 고정 브리프

Agent 툴(general-purpose, fresh context)로 아래 문안 그대로 (경로만 치환):

```
적대적 코드 리뷰. 입력은 문서와 diff 뿐이다 — 구현 과정 설명은 없다.
- spec: <spec 절대경로> / plan: <plan 절대경로>  (T1 이면 plan 만)
- diff: git -C <worktree 절대경로> diff origin/dev...HEAD  (필요한 파일은 직접 읽어라)
임무: spec/plan 대비 갭·버그·보안·회귀 위험을 **반증 시도** 관점으로 찾아라.
스타일·네이밍 지적 금지.
nomacom 고유 검사 항목 (해당 시 필수):
  · 주문 소유권 — 주문번호+이름+전화 3요소 검증을 서버가 하는가, 클라가 보낸 소유자
    정보를 신뢰하지 않는가 (타인 주문 접근)
  · PII — 전화번호·이메일·ICCID·활성화 코드가 로그/응답/에러 메시지에 새지 않는가
  · Maya API — 실패·타임아웃·부분성공 처리가 있는가, 재시도가 중복 발급을 만들지 않는가
  · 데이터 정합 — Drizzle 정의와 prod DB(TypeORM camelCase) 컬럼명이 실제로 맞는가
  · eSIM 카피 규칙 — 사용일수를 자정 기준으로 서술하지 않는가(첫 연결부터 24h rolling),
    다국가 상품에 국가별 재개통을 안내하지 않는가
검증 자산 검사 필수: 테스트가 있으면 assertion 이 실제로 있는가 / 대상 모듈을 mock 해
  통과시키지 않는가 / spec 을 검증하는가(구현 미러링 아님). 테스트가 없으면 plan 에
  사유가 명시돼 있고 대체 증거(커맨드 출력·스크린샷)가 붙었는가.
출력: findings 를 blocker(머지 불가) / major(수정 필요) / minor(선택) 로 분류하고,
각 항목에 파일:라인 + 구체 반증 시나리오(어떤 입력·상태에서 어떻게 틀리는가).
findings 없으면 "0건" + 실제로 검토한 범위를 보고. 수정은 금지 — 보고만.
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
1) dev 서버 기동 확인 후 spec §7 「E2E 검증 절차」를 그대로 걷는다
   — Orca 내장 브라우저 전용 (chrome extension 금지):
     orca tab create --url http://localhost:3000 → snapshot/click/fill,
     중요 화면은 orca screenshot 채증, orca console / orca network 로 에러 확인.
2) 상태 커버리지: spec §5 가 정의한 상태 전부 — Empty / Loading / Error / 권한없음 /
   부분성공 — 를 실제로 유발해 기대 표시와 대조한다. (AI 구현은 happy path 만 만들고
   이 상태들을 빠뜨리는 것이 최다 결함 패턴)
   nomacom 추가 확인:
     · 다건 주문에서 일부만 발급 성공하는 부분성공 표시
     · Maya 실패/타임아웃 시 사용자에게 보이는 문구와 복구 동선
     · iOS Universal Link 설치 경로 / Android 수동 코드 안내가 기기 조건별로 맞는가
     · 사용일수·다국가 로밍 카피가 memory 규칙을 위배하지 않는가
3) 데이터를 만드는 기능이면 화면 값 ↔ DB/API 원본 대조 (spec E2E 마지막 스텝).
출력: DoD 체크리스트 항목별 pass/fail + 발견 이슈(blocker/major/minor) +
걸은 시나리오 중 회귀 스위트 편입 가치가 있는 것 + 스크린샷 경로.
```

### 3. 종료 조건

- spec §7 DoD 전항 + blocker 0건.
- **walk ≠ 회귀 커버리지**: 세션에서 브라우저로 확인한 것은 회귀 자산이 아니다. 편입 판정된 시나리오는 테스트 코드로 승격해야 자산이 된다 — client 는 `apps/client/server/**/*.test.ts` 로, DS 는 `packages/design-vue/src/__tests__/` 로 (INF-1 이후 둘 다 `turbo run test` 가 실제로 돌린다).
- 미해결 minor 는 **"알고 넘어가는 목록"** 으로 명시 — 조용히 삼키지 않는다.
- 사용자 노출 UI 변경의 **사람 최종 확인**은 칸반 스윕(하루 1~2회 `in-review` 일괄 처리)에서 — 스크린샷 채증이 그 판단 재료다.

## 산출 — QA 증거 기록 (finish-branch Step 0 이 읽는 것)

Orca 워크트리면 카드 코멘트에 한 줄 요약:

```bash
orca worktree set --worktree current \
  --comment "QA: ⑥ 통과(blocker 0/major 0/minor 2) · ⑦ walk 12/12 pass · 회귀 편입 후보: <목록> · 알고 넘어가는 목록: <minor 요약 or 없음>" --json
```

Orca 카드가 없으면 같은 내용을 plan 의 as-built 섹션에 기입(`.md`/`.html` 양쪽). 스크린샷 채증 경로도 함께.

## Red Flags

- ⛔ 구현한 세션/에이전트가 스스로 "리뷰 통과" 선언 — QA 증거로 인정되지 않는다
- ⛔ 재검을 같은 subagent 로 — 반드시 새 fresh context
- ⛔ 리뷰어·walk 세션이 코드를 직접 수정
- ⛔ blocker 를 minor 로 자체 강등해 통과 처리 — 이견은 사람 arbiter 로
- ⛔ 400 LOC 초과 diff 를 통짜로 리뷰
- ⛔ "walk 에서 봤으니 됐다"로 회귀 편입 판정 생략
- ⛔ chrome extension 으로 walk 수행 — Orca 내장 브라우저가 규약

## Integration

- **선행**: 코딩 세션 DoD (`verification-before-completion` 증거 + 커밋 + 카드 `in-review`)
- **후행**: `nomacomfe-finish-branch` — Step 0 이 이 QA 증거를 확인하고 머지 옵션을 연다
- **호출 맥락**: `nomacomfe-spec-session` Stage ⑤ 의 핸드오프 브리프가 "DoD 도달 시 nomacomfe-qa-session" 을 지시한다
