---
name: grill-me
description: Relentless one-question-at-a-time interview that sharpens a fuzzy idea into a decided spec — exploring the codebase, schema, and rules for answers before asking, and proposing a recommended answer with every question. Use when an idea or decision is still vague and needs interrogation (design direction, process/memory rules, infra choices, external-system decisions); when requirements themselves are unclear use ask-questions-if-underspecified instead.
---

# grill-me

당신을 인터뷰해서 머릿속 fuzzy 아이디어를 sharp 한 결정으로 끌어낸다. 한 번에 한 질문, 매 질문마다 추천 답안 동반, 묻기 전에 코드부터 탐색.

**Announce at start:** "I'm using the grill-me skill — I'll interrogate one question at a time until this is sharp."

## Branching — grill-me vs ask-questions-if-underspecified

| 상황                                                                                       | 어느 걸                            |
| ------------------------------------------------------------------------------------------ | ---------------------------------- |
| **무엇을** 만들지 자체가 불명확 (요구사항 공백)                                            | `ask-questions-if-underspecified`  |
| 무엇은 정해졌고 **어떻게/어느 방향** 인지 sharpen 필요 (설계·결정)                         | **`grill-me`**                     |
| schema/Drizzle migration / Nuxt server route / admin↔client cross-app / design-system 변경 | 코드·스키마 탐색 후 **`grill-me`** |

grill-me 는 도메인 무관 sharpening 도구. (esmn-frontend 엔 brainstorming skill 이 따로 없으므로 설계 대화는 grill-me 가 담당.)

## Rules of the interview

1. **한 번에 한 질문.** 질문 폭격 금지. 답을 듣고 다음 질문이 결정됨.
2. **묻기 전에 코드/메모리/룰 탐색.** 답이 repo·memory·`.claude/rules/`·`server/db/schema` 에 있으면 읽고 답을 제시 — 사용자에게 묻지 않음. 사용자 질문은 코드로 답 못 하는 것 (의도 / 트레이드오프 / 우선순위) 만.
3. **매 질문에 추천 답안.** "A 와 B 중 뭐가 맞나요?" 가 아니라 "저는 A 가 맞다고 봅니다 (이유). 동의하세요, 아니면 B 인가요?" — 빈 칸이 아니라 starting point 제시.
4. **Relentless.** 답이 모호하면 더 파고든다. "그건 상황에 따라" → "어떤 상황? 구체 케이스 하나만 주세요."
5. **5질문마다 중간 요약.** 지금까지의 결정을 요약하고 계속 팔지 확인 — 무한 인터뷰 방지 (Spec Kit /clarify 의 회당 5개 상한 준용).
6. **보류는 마킹하고 진행.** 사용자가 답 못 하거나 미루는 항목은 가정으로 메우지 말고 작성 중 문서에 `[NEEDS CLARIFICATION: 구체 질문]` 으로 남긴다 — spec LOCK / 구현 게이트가 잡는다.
7. **결정되면 멈춤.** 충분히 sharp 해지면 인터뷰 종료하고 결정 요약 + 다음 단계 제시.

## Process

### 1. 코드 먼저 탐색

질문 던지기 전에:

- repo 에서 관련 코드 / 기존 패턴 grep (`apps/admin`, `apps/client`, `apps/mobile`, `packages/design-*`)
- memory / `.claude/rules/` 에서 과거 결정 확인
- 이미 답이 있으면 그걸 제시하고 확인만 받음

### 2. 인터뷰 루프

- 가장 큰 불확실성부터 (가장 많은 후속 결정을 가르는 질문)
- 매 질문: 맥락 1줄 + 추천 답안 + 근거 + "동의 / 아니면?"
- 답 받으면 → 더 좁혀진 다음 질문
- 모호하면 → 같은 지점 더 파고듦

### 3. 결정 요약 — 귀속처는 문서

sharp 해지면:

- 결정된 항목 bullet 로 요약
- **spec 작성 맥락이면 결정을 즉시 spec §8 결정사항 표에 `resolved` 행으로 기록** — 대화 로그에만 남은 결정은 다음 세션에 승계되지 않는다. 보류분은 `open` 행 + `[NEEDS CLARIFICATION]` 마킹
- 미해결 / 보류 명시
- 다음 단계 제시 (구현 / memory write / ADR)

## When to capture the decision as memory

결정이 **셋 다** 충족하면 memory write 권장: (1) **hard to reverse** (schema / cross-app 라우팅 / 배포 정책), (2) **surprising without context** (코드만 보면 "왜?" 나옴), (3) **real trade-off** (진짜 대안이 있었음). 셋 중 하나라도 빠지면 skip (ephemeral / self-evident / reverse-engineerable).

## When to stop

- 핵심 결정이 다 내려졌고
- 사용자가 "이제 충분" 신호를 줬거나
- 남은 질문이 구현 중 자연스럽게 풀릴 detail 수준

과도한 grilling 도 안티패턴 — sharp 의 목적은 결정이지 완벽한 명세가 아님.

## Integration

**Called by:**

- `nomacomfe-spec-session` Stage ② — 기획 세션의 인터뷰 단계 (조사 노트의 잔여 불확실성만 가지고 진입)

**Flows to:**

- `ask-questions-if-underspecified` — 요구사항 공백이 드러나면 전환
- 구현 / ADR / memory write — 결정 확정 후

**Pairs with:**

- `systematic-debugging` / `systematic-debugging` — 버그 조사가 선행돼야 하는 경우
