---
name: nomacomfe-spec-session
description: Staged planning-session orchestrator for esmn-frontend — tier triage, parallel codebase/prod research, gap-closing interview, 기능정의서(spec) writing to LOCK, plan, and Orca worktree handoff to a coding session. Use when starting to plan or spec a new feature, screen, flow, or external integration ("기획하자", "기획서/기능정의서 쓰자", "spec 작성"), or when deciding whether a task needs a spec at all.
---

# nomacomfe-spec-session

기획 세션을 스테이지 게이트로 진행한다: ⓪Tier 판정 → ①실측 조사 → ②인터뷰 → ③spec 작성 → ④LOCK → ⑤Plan+핸드오프. 사람 게이트는 ④LOCK ack **하나뿐** — 나머지 전이는 세션이 스스로 밟는다.

**Announce at start:** "nomacomfe-spec-session 으로 기획 세션을 진행합니다 — Tier 판정부터."

## 대원칙

1. **탐색이 질문에 선행** — 코드/스키마/prod/memory 로 답할 수 있는 것은 사용자에게 묻지 않는다.
2. **답의 귀속처는 spec** — 인터뷰 답·결정은 대화 로그가 아니라 spec §8 에 즉시 기록해야 다음 세션이 승계한다.
3. **spec 은 검증 절차로 끝난다** — 에이전트가 스스로 돌릴 수 있는 E2E 체크 없는 spec 은 LOCK 불가.
4. **과잉 계획 경보** — spec 리뷰가 코드 리뷰보다 무거워지면 실패 신호. 진행 중 언제든 Tier 강등(T2→T1)을 제안한다.

## Stage ⓪ — Tier 판정 (입구)

**T2 트리거 목록** (하나라도 해당 → 이 스킬로 계속):

- 🆕 신규 화면 (페이지/모달/드로어/대시보드) — client 발급 플로우 단계 추가 · admin 신규 관리 화면
- 🔀 신규 사용자 플로우 (다단계 동선·상태 전이) — 발급·환불·재발급·개통일 변경
- 🔌 외부 연동 — **Maya eSIM B2B API** · 네이버 스마트스토어 Commerce API · Cafe24 · PG (사용자에게 보이는 동작 변경)
- 🗄 Drizzle 스키마 변경 (prod 는 TypeORM camelCase — 정합 확인 필수)
- 💳 과금·PII 경로 (주문/고객 정보 read/write)
- 📂 다중 파일 **신규 기능** / 접근이 불확실한 작업
- 📱 mobile 신규 화면 (Expo Router 라우트 추가)

**미해당 시 경로 분기 (이 스킬 종료):**

| 판정                                                    | 경로                                                                        |
| ------------------------------------------------------- | --------------------------------------------------------------------------- |
| **T1** — 버그픽스(파일 수 무관)·단일 파일 소기능·리팩터 | `nomacomfe-write-plan` 경량 양식으로 직행                                   |
| **T0** — 한 문장 diff (오타·로그·리네임)                | plan 도 불필요, 검증 기준만 확인하고 바로 작업                              |
| **D** — `design/` 캔버스 산출물 (상세페이지·썸네일)     | spec 면제. 게이트는 **오너 승인 + 렌더 대조** (`$NOMACOM_WIKI/wiki/frontend/specs/spec-writing-guide.md` §2.5) |

- 애매하면 README §2 의 5분 테스트: §2 목적·§5 상태·§6 범위밖 3개만 써 본다 — 안 써지면 면제.
- **Tier 기록 (의무)**: spec 헤더 Tier pill + 주간 SoT(`$NOMACOM_MANAGER/docs/weekly/frontend-current-week.md` — `nomacom-weekly` 스킬) 트랙 행. 기록이 없으면 finish-branch 가 QA 게이트 적용 여부를 판정할 수 없다.
- **T3** (아키텍처 변경 · 크로스앱 계약 · Nitro canonical API 계약 · 배포 파이프라인): spec 앞에 Proposal(크로스앱·T3 는 nomacom-manager `docs/proposals/`, 리포 로컬 RFC 는 `$NOMACOM_WIKI/wiki/frontend/proposals/`) 로 전략·트레이드오프·대안을 먼저 합의.

## Stage ① — 실측 조사 (인터뷰보다 먼저)

`dispatching-parallel-agents` 로 서브에이전트 병렬 조사 (메인 컨텍스트 보존). 조사 대상:

- **코드**: 관련 컴포넌트·Nitro server routes·기존 유사 패턴 (`apps/admin`, `apps/client`, `apps/mobile`, `packages/design-*`)
- **데이터**: Drizzle 스키마 + 필요 시 **prod 실측** (read-only). 좋은 spec 의 품질 원천은 "추정"이 아니라 "실측" — prod 는 TypeORM 이 만든 camelCase 라 Drizzle 정의와 어긋날 수 있고, 그 차이가 설계를 바꾼다
- **선례·결정**: memory 파일 · `.claude/rules/` · 기존 spec/proposal/research 에서 과거 결정 확인 (`$NOMACOM_WIKI/raw/research/`·`wiki/research/` 에 경쟁사 IA·Cafe24 조사 정본이 있다)
- **벤더 제약**: Maya / 스마트스토어 / Cafe24 는 **문서와 실거동이 다른 전례**가 있다 — 실 API 호출로 응답 형태 확인

산출: **조사 노트** — 발견 사실 + "코드로 답 못 하는" 잔여 불확실성 목록. 이 목록만 Stage ② 로 넘어간다.

## Stage ② — 인터뷰 (잔여 불확실성만)

- **결정 성격** (방향·트레이드오프·우선순위) → `grill-me`
- **요구 공백** (무엇을 만들지 자체가 불명확) → `ask-questions-if-underspecified`
- 규율: 한 번에 하나 · 매 질문 추천안 동봉 · **5질문마다 중간 요약 후 계속 여부 확인**
- 답을 받는 즉시 spec §8 결정사항 표에 `resolved` 행으로 기록
- 사용자가 답 못 하거나 보류한 항목 = spec 해당 위치에 **`[NEEDS CLARIFICATION: 구체 질문]`** 마킹 후 진행 — 가정으로 메우지 않는다. 마커가 남으면 Stage ④ 에서 LOCK 이 막힌다.

## Stage ③ — spec 작성

1. `$NOMACOM_WIKI/wiki/frontend/specs/_template.html` → `$NOMACOM_WIKI/wiki/frontend/specs/<app>/YYYY-MM-DD-<topic>.html` 복사 (크로스앱은 `wiki/frontend/specs/` 직하위). 문서는 위키에만 있다(이 리포 docs/ 없음, 2026-09-22) — 저장·커밋은 `nomacom-wiki-update`
2. **`.md` 동반 산출** — 같은 basename 으로 두 벌. `.md` 는 LOCK 게이트의 마커 grep 대상이자 에이전트 정본, `.html` 은 john 열람용. 둘 중 하나만 고치지 않는다
3. 조사 노트 + 인터뷰 결과로 §1~§8 작성. hard rule: **§2 사용자와 목적 · §4 보안 불변식 · §5 상태 블록 · §6 범위 밖**은 누가 쓰든 안 거른다
4. **§7 성공지표**: 정량 지표 1개 이상, 또는 "측정하지 않기로 결정" 한 줄 명시 (무단 생략 금지). 지표를 쓰면 계측이 이번 scope 인지도 판정
5. **§7 E2E 검증 절차 (필수)**: 준비 커맨드 → 정상 경로(구체 기대값) → 상태/예외 유발법 → 데이터 대조. 구현·QA 세션이 그대로 따라 돌릴 수 있어야 한다
6. **AC 규칙**: 각 문장이 독립적으로 통과/실패 판정 가능해야 한다 (표기법 자유)
7. **eSIM 카피 규칙 준수** — 사용일수는 첫 연결부터 24h rolling · 다국가는 개통 후 자동 로밍. 위배하는 카피는 spec 에 넣지 않는다
8. 화면 비중이 크면 `-mockup.html` 동반 여부를 사용자에게 확인
9. 작성 후 `orca tab create --url file://<절대경로>` 로 열어 보여준다

## Stage ④ — LOCK 게이트 (유일한 사람 게이트)

기계적 체크리스트 — 전항 통과 후에만 ack 요청:

- [ ] §8 open 결정 0건
- [ ] `[NEEDS CLARIFICATION]` 마커 0개 (grep 으로 확인)
- [ ] §2 · §4 불변식 · §5 상태 블록 · §6 채워짐
- [ ] §7 DoD 존재 + **E2E 검증 절차 존재**
- [ ] §7 성공지표 or "측정 안 함" 명시
- [ ] 헤더 Tier pill 기록
- [ ] `.md` / `.html` 두 벌이 같은 내용

통과 → 사용자 ack 요청 → pill `draft`→`locked` + 수정이력 한 줄. **LOCK 후 스펙 변경은 문서 먼저 고치고 코드가 따라간다.**

## Stage ⑤ — Plan + 핸드오프 (기획 세션의 마지막 액션)

1. LOCK 직후 `nomacomfe-write-plan` (T2+ 표준 양식) 진행 — 별도 전이 판단 없음
2. plan 완료 후 핸드오프. **두 경로**:
   - **기본 — fresh 코딩 세션**: 아래 커맨드 실행까지가 이 세션의 일이다
   - **허용 — 같은 세션 연속 구현**: 기획 실측 암묵지가 깊어 spec 에 다 담기 어려울 때. fresh 비타협 지점은 구현자가 아니라 **QA checker** 다

```bash
orca worktree create --name <topic> --no-parent \
  --agent claude --prompt "<브리프>" --setup run --json
# ⚠️ nomacom 은 Orca repo setup hook 에 `yarn install` 이 run-by-default 로 등록돼 있다.
#    → --setup run 이 정상. m8-frontend 의 `--setup skip` 을 그대로 복사하면 부트스트랩이 누락된다.
```

**브리프 표준문안 (필수 요소 6):**

```
spec: <spec 절대경로(.md)> / plan: <plan 절대경로(.md)>   ← 문서가 유일한 입력 (이 세션의 추론은 안 넘긴다)
Tier: T2. nomacomfe-worktree-setup 절차(Orca 부트스트랩 모드)로 마무리 후 착수.
완료 정의: plan 테스트 계획 전항 green + 커밋 + nomacomfe-qa-session ⑥ 리뷰 blocker/major 0.
DoD 도달 시: workspace-status in-review 전환 → nomacomfe-qa-session 진행 (⑥ 적대적 리뷰,
해당 트랙이면 ⑦ acceptance walk) → QA 증거를 카드 코멘트에 기록 → nomacomfe-finish-branch.
금칙: 테스트/검증 기준 완화 금지 · spec 범위 밖 확장 금지 · PR base 는 항상 dev · prod 직접 push 금지.
```

- 긴 기획 세션이었다면 `handoff` 스킬 산출물을 브리프에 동봉 (Orca 핸드오프 = 전달 채널, handoff 스킬 = 전달 내용물)
- 주간 SoT 에 트랙 행 추가/갱신 (Tier 포함)

## Gotchas

- **spec 없이 시작된 세션에서 T2 트리거가 뒤늦게 발견되면** — 즉시 이 스킬로 승격한다 (vibe→spec 승격). 반대로 써 보니 spec 이 안 써지면 T1 강등.
- 문서는 전부 `$NOMACOM_WIKI/wiki/frontend/{specs,plans,proposals,runbooks}/`(2026-09-22 전환, nomacom-wiki 결정 0001) — 이 리포에 `docs/` 는 없다. `.md` 는 `schema/templates/spec.md` frontmatter 로 시작하고, 커밋은 `nomacom-wiki-update`(자기 트리만 · `pull --rebase` · lint 훅).
- 외부 연동 spec 에서 §1.5 의존성(선행 마이그·배포순서) 생략 금지 — "빌드는 되는데 실제론 막힌" 1순위 원인.
- 사용자가 이미 방향을 정해 들고 온 경우 Stage ② 를 건너뛰지 말 것 — 결정된 것의 **기록**(§8 resolved 행)은 여전히 필요하다.
- **admin 은 스테이징이 없다** — prod 가 첫 통합 환경. 데이터를 만드는 T3 는 배포 후 값 대조를 DoD 에 명시.

## Integration

- **호출**: `dispatching-parallel-agents` (①) · `grill-me`/`ask-questions-if-underspecified` (②) · `nomacomfe-write-plan` (⑤) · `handoff` (⑤ 브리프 내용물)
- **다음 단계**: 코딩 세션 (`nomacomfe-worktree-setup`) → `nomacomfe-qa-session` → `nomacomfe-finish-branch` → `nomacomfe-prod-push-check`
