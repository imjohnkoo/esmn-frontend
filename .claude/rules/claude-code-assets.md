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
  - ⭐ **2026-10-05 구멍 · 오탐 수정**(QA ⑥ 리뷰 일곱 회차 — 6회차 blocker 1: 래퍼 판정이 줄을 넘어 앞 줄 `gh run watch` 가 뒤 줄 따옴표 목적지를 숨김 · major 1: `docker build --push` / 4회차 major 2: 공백 없이 줄인 graphql mutation · `bash -o pipefail -c` / 5회차 major 3: 공백 든 JSON `--input` 의 prod ref · 여러 줄 따옴표 · 주석 안 `<<EOF` · 따옴표 없는 heredoc 본문의 `$(…)` · 백틱): 앞단이 따옴표를 아는 스캐너(awk)다 — 작은따옴표 안은 글자 그대로, 큰따옴표 · 맨 글자의 $(…) · 백틱은 명령으로 따로 뽑고, 공백이 든 따옴표 문자열(메시지 · 본문 · 쿼리)은 자리표시로 걷고(graphql ref · 머지 mutation 이름은 표식), 한 단어 따옴표는 벗기고, bash -c · eval 문자열과 주석을 다룬다. 그 위에서 명령 경계(줄바꿈 포함)로 쪼개 세그먼트 **어디든** push · gh api · gh pr · gh workflow 를 본다(if · then · until · timeout · nice · 절대경로 접두도 잡고, 따옴표 안 글자로는 막지 않는다). 막는 것: 목적지 prod(bare · heads/ · refs/heads/ · 따옴표 · + · 리다이렉트 · #), force 3형태, --mirror · --all · 글롭, -c remote.*.push, xargs, gh api 의 prod ref 쓰기(메서드 대소문자 무관 · 필드 붙여 쓰기 · --input · -F x=@-) · 머지 · dispatch, prod base PR, workflow 수동 실행(ci · design-system-publish 외), graphql ref 변경 · 머지 mutation 전부. heredoc 판정은 따옴표 · `$(…)` · 백틱 · 주석 · `$((…))` 상태를 스택으로 아는 awk 하나(줄마다 sed 없음) — 받는 쪽은 같은 파이프라인 뒤 명령(`| bash`) → 받는 명령이 데이터 소비자(git · gh · cat · tee · jq …)면 데이터 → 받는 명령이 셸 · 인터프리터면 그것 → 그 밖에는 논리 줄 어디든 셸 낱말이면 셸 본문(dev 판 넓이 — 8회차: 좁게 보던 판정이 `2>&1` · `${VAR}` · 중괄호에서 셸 본문을 놓쳤다) 순으로 정하고, 셸 · 인터프리터 본문은 밖 글과 **따로** 판정한다(본문의 `don't` · `it's` · `12"` 가 닫는 줄 뒤 명령을 숨기지 않게). 닫는 줄은 bash 처럼 정확히 비교하고(`<<-` 면 앞 탭만), 본문은 논리 줄(줄 이음 · 열린 따옴표)이 끝난 뒤부터, 한 줄의 heredoc 여럿은 차례로 읽는다. 따옴표 없는 구분자(`<<EOF`) 본문은 큰따옴표 문자열처럼 다뤄 안의 `$(…)` · 백틱을 명령으로 보고, heredoc 으로 쓴 **그 파일**을 같은 명령에서 실행할 때만 그 본문도 명령으로 본다(`git add .` · 다른 스크립트 실행이 모든 데이터 heredoc 을 명령으로 만들던 오탐 — 7회차 major). 문자열을 명령으로 받는 래퍼(bash/sh/fish -c · eval · trap · watch · flock/su/npx/script -c · env -S · tmux · ssh · git rebase -x · submodule foreach · `git -c alias.x=` · `bash <<<` · orca --text)를 다시 본다. 그 밖에 따옴표 친 옵션(`"--force"` · `"--base=prod"`) · `\git` · `${X:-prod}` · 공백 여럿 · `branch=prod` · `/graphql` · `gh run rerun` · JSON `force:true` · `docker image push` · `buildx --push` · `reset -q --hard` · `aws --profile … ssm` · 주석 끝 «\» · 줄 이음 직후 `#`(주석이 아니다) · 줄 이음 뒤 `bash -c` 문자열 · `--text=` · here-string `<<<` · 닫히지 않은 heredoc(되살려 본다) · 인터프리터 본문의 짝 없는 따옴표(셸 기준 — 이스케이프 따옴표 포함) · `docker compose -f/-p … push` · `docker-compose push` · `buildx imagetools create` · 변수에 담은 graphql mutation · ANSI-C 문자열(`$` + 작은따옴표) · `"$SHELL"` · `$SHELL -c` · `parallel` · push 자리표시 목적지(`{}`) · 숫자 ID · curl 로 부르는 workflow dispatch · `aws deploy create-deployment` 를 다룬다. `--input` 본문 판정은 ref · 머지 · PR · contents · graphql 엔드포인트만(이슈 댓글 본문의 `refs/heads/prod` 글자로 막지 않는다) · `bash -n` 은 실행이 아니다. 9회차: 셸 낱말 경계를 넓혀 `(bash)` · `{ …; bash; }` · `bash>log` · `"bash"` · `$(…)` 안 heredoc(안쪽 명령 · 안쪽이 cat 이면 바깥 `bash -c` · `eval`) · 파이프 뒤 서브셸 · `while … eval` · `| parallel` · `| at` · `>(bash)` · `gh codespace ssh` 를 셸 본문으로 본다 · 인터프리터가 스크립트 파일을 받으면 heredoc 은 데이터 · `gh pr -R … create` · curl 본문 `@-` · `git config remote.*.push` · `npm exec -c` · `$(which bash) -c` 도 다룬다. curl · wget · httpie 로 부르는 GitHub API 는 쓰는 메서드 · 본문이 있을 때만 막는다(조회는 통과). 파이프라인 어느 단계든 실패하면(pipefail) · awk · sed 가 죽으면 fail-closed 다. 글자는 바이트로 다룬다(`LC_ALL=C` — macOS awk 가 한글 한 글자 중간을 자른 창에 match 하다 죽던 잠복 결함). 여전히 못 보는 길: 변수에 담은 목적지(읽어 들인 값 포함) · 현재 브랜치가 prod 일 때 목적지 없는 push · `git push origin HEAD` · upstream · push.default · gh pr merge · REST PR 머지(`PUT pulls/N/merge` — gh pr merge 와 같다) · 표준 입력으로 받은 셸 스크립트(echo … | sh) · 이어 붙인 따옴표 · 파일에서 읽는 쿼리 · python 등 다른 언어 코드 안의 셸 문자열(python -c · subprocess) · 따옴표 안 탭 · $'…' 의 8진수 · 16진 이스케이프 · case 패턴의 «)» 가 든 $(…) · 공백 든 파일 이름으로 쓰고 실행하는 스크립트 · bash 5 만 받는 `EOF)` 닫는 줄(이 환경 zsh 는 거부) · 여러 줄로 연 중괄호 묶음 뒤 `} | bash` · 치환에 담은 push 목적지 — 실수 방지용이지 악의적 우회 방어선이 아니다. 알고 두는 오탐(안전 쪽): `| ssh 호스트 '원격 명령'` 으로 받는 heredoc 은 원격 명령을 읽지 못해 셸 본문으로 본다. 성능(macOS · bash 5 · 7회차 실측): 일상형 230–420KB 1–3.5초 · 따옴표 친 heredoc 2MB 0.5초 안 · 따옴표 없는 heredoc 의 한 줄 JSON 1.7MB 약 4초 · `$(…)` 안 따옴표 없는 heredoc 1.9MB 약 8초 · python heredoc 1MB 약 18초 · 꾸민 입력(닫히지 않은 `$(` 3000개) 약 11초 — 기본 훅 제한(600초) 안, 넘치면 판정 없이 진행(fail-open)이라 큰 글은 파일로.
  - ⚠️ **완화·강화 시 회귀 테스트 필수**: `.claude/hooks/guard-prod-push.test.sh` (인라인 ALLOW 31 · BLOCK 36 + 케이스 파일 `guard-prod-push.cases.txt` ALLOW 335 · BLOCK 637 을 LF · CRLF 로 + fail-closed 5(jq 없음 · awk 실패 · awk 출력 뒤 실패 · sed 출력 뒤 실패 · awk 빈 출력) — 총 2016판정. 차단은 «permissionDecision deny» 로 확인 · 훅은 테스트를 돌린 bash 로 부른다 — `/bin/bash …test.sh` 가 3.2 판정)
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
