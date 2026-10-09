---
name: zoom-out
description: Explain an unfamiliar code section by mapping its callers and dependencies and locating it within the whole system. Use when you land in code you don't understand and need the surrounding structure — who uses this, what it depends on, where it sits across the esmn-frontend monorepo (admin/client apps + design-system packages) — before editing or debugging.
---

# zoom-out

낯선 코드 한 조각을 시스템 전체 지형에서 위치시킨다. **ad-hoc 컨텍스트 확장** — 대화 안에서만 쓰고 버리는 설명이지, `CLAUDE.md` 에 남기는 영구 문서가 아니다.

**Announce at start:** "I'm using the zoom-out skill to map this code's context."

## zoom-out vs 문서 갱신

|        | zoom-out                     | CLAUDE.md 갱신                |
| ------ | ---------------------------- | ----------------------------- |
| 산출물 | 대화 내 ad-hoc 설명 (저장 X) | 앱별 CLAUDE.md 반영 (영구)    |
| 시점   | "이 코드 지금 이해해야 함"   | 기능/스키마 변경 후           |
| 범위   | 한 지점 → 호출자/의존 맵     | 해당 섹션만 (전체 재작성 금지) |

탐색 중 빠른 위치 파악 → zoom-out. 문서로 남길 것 → 각 앱의 `CLAUDE.md`.
> ⚠️ 이 모노리포는 **루트 `docs/` 트리도 사용한다** — `specs`(기능정의서)·`plans`·`proposals`·`analysis`·`design-system`·`tasks`. 루트 CLAUDE.md 규칙 6 이 **신규 화면/플로우/외부연동은 기능정의서(`docs/specs/`) 선행**을 필수로 못박고 있으므로, 오리엔테이션 시 `docs/specs/`·`docs/plans/` 를 건너뛰지 말 것.

## Process

### 1. 대상 고정

"이 컴포넌트/컴포저블/server route/스키마가 뭘 하고 + 어디 속하는지" 한 문장으로.

### 2. 안쪽 → 바깥쪽 맵

- **What** — 이 모듈이 하는 일 (interface 관점: props/emits · 입력/출력 · 부수효과)
- **Callers (위로)** — 누가 import/사용하나? `Grep` 으로 import + 사용처. 어느 앱(admin / client)인지 또는 DS 패키지인지 표시
- **Dependencies (아래로)** — 무엇을 호출/의존하나? (composable / server util / 외부 API / Drizzle repository / `@imjohnkoo/design-vue`)
- **Cross-app** — `@imjohnkoo/design-tokens|vue|mobile` 경유 공유? 공유 eSIM 메인 DB 스키마? (DS 변경은 Turbo 가 admin+client 둘 다 리빌드 · design-mobile 은 mobile)
- **Data** — 어떤 Drizzle 스키마 read/write? eSIM 메인 DB(공유 — prod 는 TypeORM camelCase) vs admin 전용 DB?

### 3. 시스템 위치 한 장 요약

- 레이어 (Vue page/component → composable → server API route → service → repository → DB 중 어디)
- 인접 모듈 + 경계(seam)
- 관련 `.claude/rules/` (또는 `apps/*/.claude/rules/`) / memory 포인터 (있으면)

### 4. (선택) diagram

복잡하면 caller → this → deps 를 ASCII 또는 Mermaid 로.

## esmn-frontend 탐색 팁

- import 추적: `Grep` 로 `from '@imjohnkoo/design-vue'` / `from '~/...'` / 컴포넌트·컴포저블명
- 어느 앱인지: 경로 `apps/admin/...` vs `apps/client/...`, 공유면 `packages/design-*/...`
- server route: `apps/<app>/server/api/...` (Nitro) — middleware 는 `server/middleware/`
- DB: Drizzle 스키마 + repository. eSIM 메인 DB 는 공유(esmn-backend 와), admin 전용 DB 는 별도
- DS 영향: `packages/design-*/**` 변경은 Turbo `^build` 로 admin+client 자동 리빌드 (`.claude/rules/turbo.md`)
- rules: 모노리포 `.claude/rules/`, 앱별 `apps/{admin,client,mobile}/.claude/rules/`

## Integration

**Pairs with:**

- `systematic-debugging` / `systematic-debugging` — 버그 위치 파악 선행
- `nomacomfe-write-plan` — 맵에서 리팩터 대상이 드러나면 계획서로
- 영구 기록이 필요하면 해당 앱 `CLAUDE.md` 의 영향 섹션만 갱신 (루트 CLAUDE.md 「Maintaining This File」 규칙)
