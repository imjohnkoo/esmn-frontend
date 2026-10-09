---
name: handoff
description: Compact the current conversation into a handoff document that another agent can pick up without rebuilding context. Use when ending a long session, switching machines, hitting context limits, or asking next session to focus on a specific follow-up.
argument-hint: '다음 세션의 focus (선택)'
---

# Handoff

현재 대화를 압축 정리해 다음 agent (다른 세션 / 다른 머신 / fresh context) 가 그대로 이어받을 수 있는 임시 문서로 저장.

**Announce at start:** "I'm using the handoff skill to compact this conversation."

## Output Location

`$TMPDIR/nomacomfe-handoff-<YYYY-MM-DD-HHMM>.md` (macOS 기본 `$TMPDIR` 사용, 없으면 `/tmp`). 저장 후 절대 경로 사용자에게 보고 + `open <path>` 호출.

**docs/ 에 저장 금지** — 핸드오프는 1-session 압축물. 영속 사실은 memory / plan / ADR 로 분리.

## Document Structure

```markdown
# Handoff — <topic> (YYYY-MM-DD HH:MM KST)

## What this session was for

<1-2 문장. 어떤 문제 / 작업이었는지>

## What was decided / done

- <concrete outcome 1>
- <concrete outcome 2>

## What's NOT in this doc (reference these instead)

- Plan: `$NOMACOM_WIKI/wiki/frontend/plans/<file>`
- PR: https://github.com/imjohnkoo/esmn-frontend/pull/<n>
- Memory: `[[memory_slug]]`
- Diff: `git log <branch> -5 --oneline` or `git diff <base>...HEAD`
- Code: `apps/{admin,client,mobile}/<path>:<line>`

## Current state (snapshot)

- Branch: <branch>
- Worktree: <path>
- Last commit: <sha + subject>
- Pending TaskList: <bullet>
- Build status: <pass/fail/skipped> (turbo / typecheck / vitest)

## Next session focus

<args 그대로, 없으면 plan 참조>

## Suggested skills

다음 세션 시작 시 호출 후보 (focus 에 맞게 1-2개만):

- `nomacomfe-prod-push-check` — prod push 전
- `nomacomfe-finish-branch` — worktree 작업 완료 단계
- `nuxt` / `vue` / `vitest` / `ts-library` — 기술 영역 작업
- `systematic-debugging` — 재현 어려운 버그 / 성능 회귀

## Open questions

- <해결 안 된 결정 포인트>
- <사용자 답변 대기 항목>
```

## Rules

### No duplication

이미 다른 영속 위치 (plan / PR / memory / 코드) 에 있는 내용은 **reference (path / URL / slug) 로만 표시**. 본문 복붙 금지. 이유: 동기화 책임 회피 + 다음 agent 가 fresh source 에서 읽음.

### PII / Secrets redaction

**Redact** (`***REDACTED***`):

- 고객 PII — 전화번호 / 이메일 / 주문자명 / 카드번호 / 주문번호 원문 / eSIM ICCID·활성화 코드
- 스마트스토어 판매자 식별자 / Maya API client secret / 개인 토큰
- API key / SSM secret value / Bearer token / DB 접속정보

**보존** (프론트 디버깅 / 운영 핸드오프에 필수):

- PR 번호 / branch / commit sha
- route path (`server/api/...`) / component 명 / composable 명 / Pinia store 명
- log group / metric / alarm 이름
- design-token / `@imjohnkoo/design-{vue,mobile}` 컴포넌트 이름

### Args = next session focus

`/handoff "admin merchant restructure PR 리뷰"` 처럼 인자 받으면:

- "Next session focus" 섹션에 그대로 사용
- "Suggested skills" 도 focus 에 맞춰 정렬

### Don't fabricate

세션 안에서 발생한 사실만 기록. 추측 / 본 적 없는 코드 / 안 들어본 결정 추가 금지. 모르는 건 "Open questions" 로.

## Integration

**Called by:**

- 사용자 직접 (`/handoff`, `/handoff "<focus>"`)
- 긴 세션 종료 시 (context limit 근접)

**Pairs with:**

- memory 시스템 — 영속 사실 = memory, 1-session 상태 = handoff
- `nomacomfe-prod-push-check` / `nomacomfe-finish-branch` — Suggested skills 에서 참조
