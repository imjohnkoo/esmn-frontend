# 개발 프로세스 v2 — Tier · 게이트 · QA

> **정본**. m8-frontend 에서 설계·검증한 프로세스 v2 를 nomacom-frontend 로 이식한 것 (2026-09-02).
> 설계 배경·기각안·이식 판단은 `$NOMACOM_WIKI/wiki/frontend/proposals/2026-09-02-dev-process-v2-port-proposal.md`(2026-09-22 위키 이관).

## 파이프라인

```
[Intake]   T2 트리거 목록 대조 (판정 의식 없음)
   ↓ 미해당 → T0/T1/D 경로
[기획]     nomacomfe-spec-session — ⓪Tier → ①실측 조사 → ②인터뷰 → ③spec → ④LOCK ★1 → ⑤plan+핸드오프
[코딩]     구현 + 검증 증거 + self-review + 커밋 → DoD 시 QA 를 스스로 기동
[QA]       nomacomfe-qa-session — ⑥ 적대적 리뷰(fresh subagent) / ⑦ acceptance walk(트리거 해당 시)
   ↓ 사람: 하루 1~2회 칸반 스윕 ★2
[통합]     nomacomfe-finish-branch Step 0 (Tier·QA 증거 검사) → 빌드 → 머지
[배포]     nomacomfe-prod-push-check → prod (훅이 직접 push 차단)
[사후]     배포 후 값 대조 → weekly closeout 지표 판정 → 교훈은 memory/rules/skills 갱신
```

**사람이 판단하는 지점은 2곳뿐이다**: ①spec LOCK ack ②칸반 스윕(in-review 일괄 처리). 나머지 전이는 세션이 스스로 밟는다.

## Tier — 판정 의식이 아니라 어휘

실제 규칙은 **T2 트리거 목록 하나**다. 걸리면 spec 경로, 아니면 경량 경로.

| Tier   | 대상                                                                                       | 기획 산출물                | 검증 게이트                           |
| ------ | ------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------- |
| **T0** | 오타·로그·리네임·한 문장 diff                                                              | 없음                       | build green                           |
| **T1** | 버그픽스(**파일 수 무관**) · 단일 파일 소기능 · 리팩터                                     | plan 경량 양식 (spec 면제) | 회귀 증거 동봉 + self-review          |
| **T2** | 아래 트리거 해당                                                                           | 기능정의서(LOCK) + plan    | ⑥ 적대적 리뷰 전면 + ⑦ walk(해당 시)  |
| **T3** | 아키텍처 변경 · 크로스앱 계약 · Nitro canonical API 계약 · 배포 파이프라인 · 과금/PII 코어 | Proposal + spec + plan     | T2 + **배포 후 prod 실연결 값 대조**  |
| **D**  | `design/` 캔버스 산출물 (상세페이지 섹션 · 썸네일)                                         | 없음 (오너 승인이 게이트)  | 렌더 대조 + **소스 기본값 반영 확인** |
| 실험   | 불확실성 1개 검증 스파이크                                                                 | appetite + 답할 질문 1개   | 없음 — 코드는 버리는 전제             |

### T2 트리거 목록

- 🆕 신규 화면 (페이지/모달/드로어/대시보드)
- 🔀 신규 사용자 플로우 (다단계 동선·상태 전이) — 발급·환불·재발급·개통일 변경
- 🔌 외부 연동 — **Maya eSIM B2B API** · 네이버 스마트스토어 Commerce API · Cafe24 · PG
- 🗄 Drizzle 스키마 변경 (prod 는 TypeORM camelCase — 정합 확인 필수)
- 💳 과금·PII 경로 (주문/고객 정보 read/write)
- 📂 다중 파일 신규 기능 / 접근이 불확실한 작업
- 📱 mobile 신규 화면 (Expo Router 라우트 추가)

### Tier 기록 (의무)

spec/plan 헤더 **pill** + 주간 SoT(`$NOMACOM_MANAGER/docs/weekly/frontend-current-week.md`, `nomacom-weekly` 스킬로 자기 트랙 행만) 트랙 행. 기록이 없으면 `nomacomfe-finish-branch` Step 0 이 게이트 적용 여부를 판정할 수 없다.

**양방향 이동 허용**: vibe 로 시작했는데 T2 트리거가 드러나면 승격 / spec 이 안 써지면 T1 강등.

## 불변식 (이식에서 보존해야 하는 것)

1. **관문 접합** — 검증 규칙은 새 의식이 아니라 모든 트랙이 지나는 관문(LOCK · finish-branch Step 0 · weekly closeout · 훅)에 접합한다
2. **fresh checker (maker-checker)** — 구현 측은 자기 산출물을 인증하지 않는다. 재검은 반드시 **새** subagent. 리뷰어는 보고만 (수정 금지)
3. **사람 게이트 2곳** — LOCK ack + 칸반 스윕. 심각도 이견은 사람이 arbiter (에이전트의 blocker 자체 강등 봉쇄)
4. **spec 은 검증 절차로 끝난다** — LOCK 조건. 준비 → 정상경로 구체값 → 상태/예외 유발법 → 데이터 대조
5. **[NEEDS CLARIFICATION] 마커** — 미답은 가정으로 안 메우고 마킹. 결정은 대화 로그가 아니라 spec §8 결정 표
6. **5질문 리듬** — 한 번에 하나 · 매 질문 추천안 동봉 · 5질문마다 중간 요약 · 탐색이 질문에 선행
7. **400 LOC 이중 상한** — plan 태스크 200–400 LOC + QA 리뷰 분할 400 LOC
8. **회귀 증거 동봉** — 종결 diff 에 증거 or 불가 사유 1줄 (아래 제약 참조)
9. **walk ≠ 회귀 커버리지** — 브라우저로 확인한 것은 자산이 아니다. 편입 판정 필수
10. **부트스트랩 SoT 단일화** — 브리프는 지시만, 절차는 `nomacomfe-worktree-setup` 소유
11. **문서 우선 변경 + as-built 원장** — LOCK 후 변경은 문서 먼저, 구현 이탈은 plan 에 소급 기입
12. **칸반은 스킬 관문에서만 전환** — setup→in-progress · QA→in-review · finish→completed

## ⚠️ nomacom 환경 제약 (m8 과 다른 지점)

프로세스를 형해화시키지 않으려면 아래를 규칙에 반영해야 한다.

| 제약                                                                                                  | 프로세스 대응                                                                                               |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **admin/client 테스트는 얇다** (INF-1 로 러너는 붙었다 — client 1343건(2026-10-04 W1-2 · W1-3 머지), admin 0건) | 회귀 테스트를 **우선 시도**하고, 대상이 순수 로직이 아니면 검증 증거(커맨드 출력·Orca 스크린샷)로 대체 + plan 에 사유 명시 |
| **검증 3층이 갖춰졌다** — 로컬(INF-1) · PR/dev CI(INF-2) · Dockerfile(INF-3)                          | 세 곳이 **같은 스크립트·같은 기준선**(`typecheck-gate.sh`, admin 0 / client 4 — 2026-09-23 W1-2 에서 7 → 4)을 쓴다. 다만 게이트는 «타입» 만 본다 — 동작 검증은 `nomacomfe-prod-push-check` 의 UI 수동 확인 몫 |
| **admin 스테이징 없음** — prod 가 첫 통합 환경                                                        | 데이터를 만드는 T3 는 **배포 후 값 대조**가 필수 게이트                                                     |
| **prod push = 즉시 배포** (무검증)                                                                    | `guard-prod-push.sh` 가 prod push 를 **차단**. m8 은 해제했지만 nomacom 은 유지                             |
| **브랜치 둘** — dev(개발·DS publish — 2026-10-04 `main` 에서 이름 변경) / prod(배포)                   | PR base 는 항상 `dev`. 승격은 dev → prod 한 방향 — prod↔dev sync 단계는 존재하지 않는다                     |
| **Orca setup hook 등록됨** (`yarn install`, run-by-default)                                           | `orca worktree create ... --setup run` 이 정상. m8 의 `--setup skip` 복사 금지                              |
| **prod DB 는 TypeORM camelCase**                                                                      | Drizzle 정의와 어긋날 수 있다. 스키마 관련 spec/plan 은 prod 실측으로 확인                                  |

> 이 제약들은 프로세스가 **완화할 뿐 해소하지 못한다**. 해소하려면 인프라 트랙(테스트 부트스트랩 → CI 게이트 → Dockerfile 게이트)이 별도로 필요하다 — Phase 3 후보로 기록.

## eSIM 도메인 불변 사실 (카피·검증에서 위배 금지)

- **사용일수는 자정이 아니라 첫 연결 시점부터 24h rolling** 차감
- **다국가 상품은 개통 후 자동 로밍** — 국가별 재개통 안내 금지
- iOS 17.4+ 는 Apple Universal Link(`esimsetup.apple.com`), Android 는 수동 코드 안내. MVNO 라 CoreTelephony entitled API 경로는 불가
- 리뷰 발췌는 **전면 긍정 리뷰만**

## 스킬 매핑

| 단계         | 스킬                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| 기획         | `nomacomfe-spec-session` → `grill-me` / `ask-questions-if-underspecified` |
| 계획         | `nomacomfe-write-plan`                                                    |
| 착수         | `nomacomfe-worktree-setup`                                                |
| 구현 중      | `systematic-debugging` · `dispatching-parallel-agents` · `zoom-out`       |
| 완료 선언 전 | `verification-before-completion`                                          |
| QA           | `nomacomfe-qa-session`                                                    |
| 통합         | `nomacomfe-finish-branch` (Step 0 = 집행 지점)                            |
| 배포         | `nomacomfe-prod-push-check`                                               |
| 세션 인계    | `handoff`                                                                 |
