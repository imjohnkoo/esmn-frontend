# Claude Code 보조 자산 카탈로그

`.claude/` 디렉토리에 프로젝트 전용 Claude Code 보조 자산을 둡니다. 새 세션 시작 시 자동 로드됩니다.

## 구조

```
.claude/
├── skills/        # model-invoked, 자동 트리거되는 도메인 가이드
├── hooks/         # PostToolUse / PreToolUse 셸 훅 (+ 회귀 테스트)
├── rules/         # CLAUDE.md 에서 참조하는 도메인 rules (monorepo 공유)
├── scripts/       # 운영 스크립트
├── settings.json        # 팀 공유 권한/hook 등록/attribution
└── settings.local.json  # 개인 설정 (git 미추적)
```

> **`.claude/` 는 git 추적된다** (2026-09-02 전환). `settings.local.json` 과 `scheduled_tasks.lock` 만 ignore.
> 그 전에는 `.claude/*` 전량이 gitignore 여서 스킬·훅을 고쳐도 워크트리 간 전파가 없고 이력도 남지 않았다.

## Hooks

- **PostToolUse (Edit|Write|MultiEdit)** → `.claude/hooks/format-on-edit.sh` — prettier 자동 포맷 (.vue, .ts, .tsx, .js, .jsx, .json, .md, .yml, .yaml, .css)
- **PreToolUse (Bash)** → `.claude/hooks/guard-prod-push.sh` — **prod push** / `gh api` prod ref 쓰기 / ref force 되감기 / force push / `docker push` / `git reset --hard` / `aws ssm put|delete` 차단
  - ⭐ **2026-09-02 재작성**. 이전 판(29줄)은 문서가 기술한 «prod push 차단 · ssm put 차단» 이 **실제로는 없었다** — 문서를 믿고 행동하면 안 막히는 상태였다.
  - 판정은 **명령 경계(`;` `&&` `||` `|` `()` `&`)로 쪼갠 세그먼트 단위**다. 복합 명령의 다른 토큰을 오인하지 않기 위함 (`gh api -f sha=` 를 force push 로, 뒤쪽 `echo ...origin/prod` 를 prod push 로 읽는 오탐).
  - prod 판정은 **단어 경계**다 — `feat/product-detail`·`fix/reproduce-issue` 오탐 방지.
  - `git -C <path> push` 같은 **전역 옵션 삽입**도 정규화 후 판정 (Orca 워크트리 상시 사용).
  - heredoc 본문은 «데이터» 라 판정에서 제외 (커밋 메시지 안의 명령 예시로 막히지 않게).
  - jq 부재 시 **fail-closed** — 안전장치가 조용히 사라지는 것보다 시끄럽게 막힌다.
  - ⚠️ **완화·강화 시 회귀 테스트 필수**: `.claude/hooks/guard-prod-push.test.sh` (ALLOW 22 / BLOCK 15, 37케이스)
  - ⚠️ m8-frontend 는 2026-08-15 에 prod 차단을 **해제**했다(게이트가 Dockerfile 로 이동). **nomacom 은 유지** — Dockerfile 게이트가 없어 prod push = 무검증 즉시 배포다.

> ⛔ **`agents/` · `commands/` 는 2026-09-02 폐기했다.** agents 15 + commands 8. nomacom 도메인
> (Maya·eSIM·Drizzle·Expo) 지식이 0 이었고, commands 8개 중 5개는 frontmatter 자체가 없어
> 스킬 리스팅에 «build-fix: Build and Fix» 처럼 **제목을 반복하는 description** 으로 노출돼
> 트리거 신호가 0 이었다. 로스터 비용만 매 세션 ~1,220 토큰. 이식된 `nomacomfe-*` 스킬과
> 역할도 중복이다(code-reviewer ↔ qa-session ⑥ / planner ↔ spec-session / tdd-guide ↔ write-plan).
> m8-frontend 는 같은 세트를 2026-08-15 에 «319세션 호출 0건» 으로 폐기했다.
> **신규 워크플로는 `commands/` 가 아니라 `skills/<name>/SKILL.md`** 로 만든다.

## Skills 카탈로그

### 프로세스 스킬 (자체)

| 스킬                        | 목적                                                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `nomacomfe-spec-session`    | 기획 오케스트레이터 — Tier 판정 → 실측 조사(병렬) → 인터뷰 → spec 작성·LOCK → plan → Orca 워크트리 핸드오프. 사람 게이트는 LOCK ack 하나        |
| `nomacomfe-write-plan`      | 코딩계획서 — T1 경량(재현→root cause→회귀 증거 서약) / T2+ 표준(AC↔검증 매핑·회귀 범위·수동 차터·200–400 LOC 분해). **테스트 인프라 제약 반영** |
| `nomacomfe-qa-session`      | 머지 전 QA — ⑥ 적대적 리뷰 fresh subagent(spec+diff 만, blocker/major 0=통과, 재검은 새 subagent) + ⑦ acceptance walk(Orca 내장 브라우저)       |
| `nomacomfe-finish-branch`   | **Step 0 Tier/QA 게이트**(집행 지점) → 빌드 검증 → 머지/PR 옵션 → 칸반 전환 → cleanup(승인 게이트)                                              |
| `nomacomfe-worktree-setup`  | Orca 워크스페이스 부트스트랩 — **`--setup run` 전제**(hook 등록됨) · `.env.local` symlink · base=dev · 칸반 in-progress                        |
| `nomacomfe-prod-push-check` | prod 배포 전 pre-flight (트리거 여부·마이그레이션·DS bump·UI 수동 검증)                                                                         |

### 범용 스킬

| 스킬                              | 출처                   | 목적                                                                                              |
| --------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `grill-me`                        | m8-frontend 이식       | 1-질문 인터뷰로 fuzzy 아이디어 sharpen (모호한 _결정_). 5질문 리듬 + `[NEEDS CLARIFICATION]` 마커 |
| `ask-questions-if-underspecified` | m8-backend 이식 (개정) | 요구사항 모호 시 질문. 마커 규약 + 결정 귀속처 = spec §8                                          |
| `handoff`                         | m8-frontend 이식       | 긴 세션 압축 → 다음 agent 인계 문서 (PII redaction 규칙 포함)                                     |
| `zoom-out`                        | m8-frontend 이식       | 낯선 코드의 호출자·의존 매핑으로 시스템 내 위치 파악                                              |
| `dispatching-parallel-agents`     | m8-backend 이식        | 독립 task 들을 sub-agent 에 병렬 위임                                                             |
| `systematic-debugging`            | m8-backend 이식        | root cause 우선 디버깅                                                                            |
| `verification-before-completion`  | m8-backend 이식        | "완료" 선언 전 빌드/테스트 증거 강제                                                              |

### Vendored (외부 출처)

| 스킬         | 출처                      | 목적                                              |
| ------------ | ------------------------- | ------------------------------------------------- |
| `vue`        | onmax/nuxt-skills@00fb59d | Vue 3 Composition API, defineModel, composables   |
| `nuxt`       | onmax/nuxt-skills@00fb59d | Nuxt 4+ server routes, middleware, runtime config |
| `vite`       | onmax/nuxt-skills@00fb59d | Vite config, plugins, library mode (DS 빌드용)    |
| `vitest`     | onmax/nuxt-skills@00fb59d | Vitest 테스트 패턴, mocking, coverage             |
| `vueuse`     | onmax/nuxt-skills@00fb59d | VueUse composables 카탈로그 (268개)               |
| `ts-library` | onmax/nuxt-skills@00fb59d | TS library publishing (`@imjohnkoo/design-*`)     |

## Vendoring 정책 (외부 출처)

`onmax/nuxt-skills` 6개 스킬은 **frontmatter 에 `source: onmax/nuxt-skills@<sha>` + `vendored_at: <date>`** 로 출처를 추적합니다. 자동 업데이트 차단 — supply chain 리스크 방지.

- 갱신 확인: `.claude/scripts/sync-nuxt-skills.sh` (upstream 과 diff 만 출력, 자동 머지 없음)
- 권장 주기: 분기 1회 + Nuxt/Vue major 릴리스 시

## 관련 rules

- `.claude/rules/dev-process.md` — **Tier·게이트·QA 정본** (프로세스 v2)
- `.claude/rules/turbo.md` — Turbo 의존 그래프 + 커맨드
- `.claude/rules/deployment.md` — CodeDeploy 배포 흐름 + path filter
- `.claude/rules/ssm-paths.md` — SSM 경로 + Secret naming
- `.claude/rules/design-system-publish.md` — GitHub Packages publish + 버전 bump
