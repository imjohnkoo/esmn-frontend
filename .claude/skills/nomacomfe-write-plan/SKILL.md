---
name: nomacomfe-write-plan
description: Write the coding plan (nomacom-wiki wiki/frontend/plans/) for nomacom-frontend work — T1 bugfix/refactor lightweight format (repro → expected → root cause → regression evidence pledge) or T2+ standard format (file plan, AC↔test mapping, regression scope, manual QA charter, 200–400 LOC task breakdown). Use before implementing any non-trivial change: bugfix planning, post-LOCK feature plans, refactor plans ("plan 작성", "코딩계획서").
---

# nomacomfe-write-plan

구현 착수 전 코딩계획서를 쓴다. **T1(버그픽스·소기능·리팩터)은 spec 없이 이 스킬로 직행**하고, T2+(spec LOCK 후)는 `nomacomfe-spec-session` Stage ⑤ 에서 호출된다.

**Announce at start:** "nomacomfe-write-plan 으로 계획서를 작성합니다 — [T1 경량 / T2+ 표준] 양식."

## 위치·포맷 (공통)

- `$NOMACOM_WIKI/wiki/frontend/plans/<app>/YYYY-MM-DD-<topic>-plan.md`(+ 같은 이름 `.html`) (크로스앱은 `wiki/frontend/plans/` 직하위) — 이 리포에 docs/ 는 없다(2026-09-22). frontmatter 는 `$NOMACOM_WIKI/schema/templates/plan.md`, 저장·커밋은 `nomacom-wiki-update`
- **`.md` + `.html` 두 벌 동시 산출** (루트 CLAUDE.md 규칙). `.md` = 에이전트가 읽는 정본, `.html` = john 이 브라우저로 훑는 용도. **둘 중 하나만 고치는 것 금지** — 이중 진실이 된다
- 헤더에 **Tier pill** (`T1`/`T2`/`T3`/`D`) — `nomacomfe-finish-branch` Step 0 이 QA 게이트 적용 여부를 이 값으로 판정
- **PR base = `dev` (항상).** plan 에 base 를 `prod` 로 적지 말 것 — prod 는 배포 트리거이지 개발 base 가 아니다
- 작성 후 `orca tab create --url file://<절대경로>` 로 열기 (Orca 내장 브라우저 — chrome extension 금지)

## T1 경량 양식 (버그픽스·단일 파일 소기능)

섹션 6개, 1페이지 이내:

1. **증상 / 재현 절차** — 어떤 입력·상태에서 무엇이 잘못되는가 (인시던트면 타임라인 한 줄)
2. **기대 동작 vs 현재 동작** — 판정 가능한 문장으로
3. **Root cause** — 원인 규명 전이면 `systematic-debugging` 부터. 증상 패치 금지
4. **수정 계획** — 파일·변경 요지 (한 문단이면 충분)
5. **회귀 증거 — 동봉 서약** (§ 아래 "테스트 환경 제약" 을 먼저 읽을 것)
6. **검증 커맨드** — 수정 확인에 돌릴 것 (테스트·typecheck·수동 스텝)

**리팩터 변형**: 1~3 대신 **"바뀌지 않아야 할 것" 목록** + 그것을 지키는 기존 커버리지 확인이 계획의 본체. 행동 불변이 완료 정의다.

**인시던트 예외**: 1순위는 지혈(롤백/수정). 재현·테스트는 트랙 **종결 조건**으로 미룬다 — plan 은 지혈 후 소급 작성해도 된다.

## T2+ 표준 양식 (spec LOCK 후)

1. **파일 계획** — 신규/수정 파일 목록 + 각 파일의 변경 요지
2. **핵심 설계** — SQL·타입·컴포넌트 구조 등 구현의 급소. 실질 트레이드오프가 있으면 대안과 선택 근거 (T3 는 필수)
3. **테스트 계획** (3요소):
   - **AC↔검증 매핑** — spec §4 기능ID / §7 DoD 각 항목 ↔ 검증 레벨 (unit / integration / E2E / **수동+채증**). 프론트엔드 확신은 integration/E2E 층에서 온다 — unit 대량생산으로 매핑을 채우지 말 것
   - **회귀 범위** — 이 변경이 건드릴 수 있는 기존 기능 목록
   - **수동 검증 차터** — `nomacomfe-qa-session` ⑦ acceptance walk 가 걸을 시나리오 (spec §7 E2E 검증 절차 참조)
4. **태스크 분해** — 태스크 1개 = 독립 검증·롤백 가능 단위, **diff 목표 200–400 LOC** (400 초과 시 리뷰 결함 검출률이 급락하므로 분할). 병렬 가능 태스크는 `[P]` 표시
5. **게이트** — 머지 전 통과할 것: build · typecheck · (해당 시) 테스트 · 적대적 리뷰 blocker/major 0

## ⚠️ 테스트 환경 제약 — nomacom 실태 (2026-09 기준)

**INF-1(2026-09-02) 로 러너는 붙었다** — `turbo run test`/`typecheck`/`lint` 가 실제로 돈다. 다만 커버리지는 아직 얇다.

| 대상                        | 회귀 증거 규칙                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/design-vue`       | **원칙 그대로** — vitest 있음(17 files / 129 tests). 회귀 테스트 동봉, 불가하면 사유 1줄                                                                         |
| `apps/client` | 순수 로직이면 **회귀 테스트 동봉**(vitest 1359건 있음 · 컴포넌트 테스트는 happy-dom · `server/**` · `app/**` · `shared/**` 의 `*.test.ts`). 화면·환경 의존이면 검증 증거(커맨드 출력·Orca 스크린샷) + 사유 명시 |
| `apps/admin` | 아직 테스트 0건(도메인 코드가 거의 없음). 로직이 들어오는 트랙부터 테스트 동봉 |
| `apps/mobile`               | `yarn workspace nomacom-mobile run typecheck` 통과 + Expo dev 부팅 확인이 최소 증거                                                                              |
| `design/` (D 트랙)          | 테스트 개념 없음 — **소스 기본값 반영 확인** 이 종결 조건 (슬라이더 런타임 값만 바꾸고 렌더하면 승인본과 산출물이 어긋난다)                                      |

> **"불가 사유" 가 영구 면제부가 되지 않게** — 이 사유가 쌓이는 것을 weekly SoT 에서 추적하고, 테스트 부트스트랩(Phase 3 인프라 트랙)을 착수 후보로 유지한다.

**순수 로직 버그는 테스트 선행 권장**: design-vue 또는 순수 util 이면 실패 테스트 먼저 → 실패 확인 → 수정. 선행 테스트는 에이전트가 몰래 재정의할 수 없는 객관적 "done" 정의다.

## nomacom 고유 주의

- **admin 은 스테이징 경로가 없다** — prod 가 첫 통합 환경이다. 데이터를 만드는 T3 변경은 배포 후 **prod 실연결 값 대조**를 게이트(5)에 명시
- **Drizzle ↔ prod DB 정합** — prod 는 TypeORM 이 만든 camelCase 스키마다. 스키마 변경 계획은 실제 prod 컬럼명을 확인하고 쓴다 ("초록 ≠ 값이 맞다")
- **Maya API 연동 변경** — 문서와 실거동이 다른 전례가 있다. 계획 단계에서 실 호출로 응답 형태를 확인한 뒤 설계
- **DS 변경은 두 앱 재배포** — `packages/design-{tokens,vue}/**` 변경은 admin + client 양쪽 workflow 를 트리거한다. 버전 bump 필요 여부를 게이트에 포함

## as-built 규칙

구현 중 계획 이탈(파일 추가·설계 변경·DDL)은 **plan 에 소급 기입**한다 — plan 은 계획서이자 트랙의 원장이다. 배포 결과(커밋 SHA·검증 결과)도 종결 시 as-built 섹션에 남긴다. `.md`/`.html` 양쪽 모두.

## 완료 후

- **T2+ (spec-session 경유)**: `nomacomfe-spec-session` Stage ⑤ 로 복귀 — 핸드오프 브리프에 plan 경로 포함
- **T1 단독**: 바로 구현 착수 (worktree 권장 — `nomacomfe-worktree-setup`). 종결 시 `nomacomfe-finish-branch` 가 회귀 증거 동봉 여부를 확인한다

## Integration

- **선행**: `nomacomfe-spec-session` (T2+) · `systematic-debugging` (T1 root cause)
- **후행**: `nomacomfe-worktree-setup` → 구현 → `nomacomfe-qa-session` → `nomacomfe-finish-branch`
