---
name: nomacom-weekly
description: Update this repo's rows in the nomacom weekly SoT (nomacom-manager docs/weekly/<repo>-current-week.md) — add or edit only your own track block, flip item markers with evidence (dev/prod sha, PR #n, LOCK), add ⏰ observation rows or INBOX lines, self-check with weekly-render.py --check, then notify the manager with weekly-notify.py. Never commit that file. Use at skill gates (spec LOCK, worktree bootstrap, QA, merge to dev, prod, operator AC), when a sub-goal finishes or blocks, or when the user says "주간", "weekly", "current week", "트랙 행", "진행 기록", "주간에 기록", "INBOX 에", "⏰ 등록".
---

# nomacom-weekly — 주간 SoT 행 갱신 + manager 알림

> 이 파일은 `esmn-wiki/schema/repo-skill-weekly.md` 의 복사본(`ai-manager/scripts/sync-docs-convention.sh`)이다 — 여기서 고치지 말 것. 규격의 정본은 `$NOMACOM_MANAGER/.claude/rules/weekly.md`(m8 결정 0017 이식, nomacom-wiki 결정 0001). 양 리포에 같은 이름(`nomacom-weekly`)으로 들어간다.

**Announce at start:** "nomacom-weekly: [<CODE>] <event> 를 주간 SoT 에 반영합니다."

## 전제 (매번 확인)

- `MGR=${NOMACOM_MANAGER:-$HOME/dev/current-projects/nomacom-manager}` — 없으면 이 스킬은 **중단**하고 완료·블로커를 사용자에게 한 줄로 보고한다.
- 리포 = 이 워크트리의 `git remote get-url origin`: `esmn-frontend` → `--repo frontend`, `esmn-backend` → `--repo backend`. 파일 = `$MGR/docs/weekly/<repo>-current-week.md`.
- 규격은 매번 `$MGR/.claude/rules/weekly.md` 를 읽는다(짧다). 여기 적힌 형식과 다르면 **그쪽이 맞다**.
- 통합 브랜치: frontend·backend 둘 다 **`dev`**(frontend 는 2026-10-04 main→dev rename · origin/main 없음). 배포는 둘 다 `prod`.

## 절차

1. **읽기** — 파일 전체를 Read 한다(자기 블록만 고치더라도). 트랙 코드는 리포 안에서 유일 — 크로스리포 트랙은 양 리포 파일에 같은 코드.
2. **자기 블록 찾기/만들기** — `## 트랙` 아래 `### [<CODE>] …` 헤딩. 없으면 맨 아래에 새 블록:
   ```
   ### [CODE] 제목 · T2 · spec repo://esmn-wiki/wiki/<alias>/specs/… · plan repo://esmn-wiki/wiki/<alias>/plans/… · 세션 <orca 워크트리명>
   - [ ] 첫 세부 목표
   ```
   헤딩 토큰은 ` · ` 로 구분(Tier `T0~T3` · `spec`/`plan` + `repo://esmn-wiki/…` 링크(문서는 위키에 있다 · 옛 `nomacom-wiki` 키 헤딩도 그대로 풀린다) · `세션 <이름>`). 링크는 절대경로 금지.
3. **항목 갱신** — 마커 `[ ]` `[x]` `[~]` `[!]` `[-]`, 형식 `- [x] 라벨 — 증거`. `[x]` 에는 증거 필수: `dev <sha>`(frontend·backend, origin/dev 포함 — frontend 의 옛 `main <sha>` 증거도 origin/dev 로 검증된다) · `prod <sha>`(origin/prod 포함) · `PR #n` · `LOCK`. 배포 후 판정이 남으면 `## ⏰ 관측` 표에 `| [CODE] | 항목 | 판정 시점 | 방법 | 기준 | 대기 |` 행(backend 는 operator AC 전부 여기). 분류 안 된 발견은 `## INBOX` 에 `- (YYYY-MM-DD) 한 줄`.
   - 다른 트랙·`## 최우선`·집계는 손대지 않는다. 노트는 한 줄 — 서사는 spec/plan as-built 에.
   - Edit 가 «파일이 바뀌었다» 로 거부되면 다른 세션이 고친 것이다 → **다시 Read 하고 자기 블록만 재편집**(덮어쓰기 금지). 이 리포의 PostToolUse prettier 훅이 남의 md 를 재포맷할 수 있으니 manager 파일은 **Edit 도구 대신 셸(python/sed)로 해당 줄만** 고치고 `git -C $MGR diff --stat` 으로 줄 수를 확인한다.
4. **자가 검증** — `python3 $MGR/scripts/weekly-render.py --check` → `[E]` 는 고치고 다시. `[W] [x] 증거 없음` 은 사람 판단 항목일 때만 남긴다.
5. **알림** — `python3 $MGR/scripts/weekly-notify.py --repo <repo> --track <CODE> --event <event> --ref <sha|PR #n> --note "<한 줄>"`. inbox 에 기록되고 `nomacom-manager` 터미널이 있으면 즉시 전달된다("터미널 없음" 이어도 정상 — inbox 로 처리된다).
6. **커밋하지 않는다.** nomacom-manager 의 `git add/commit/push` 금지 — manager 가 검증(`✔ mgr`) 후 커밋한다. 워크트리의 자기 리포·위키 커밋과는 무관.

## 관문 → event 대응

| 시점 | event | 쓰는 것 |
| --- | --- | --- |
| spec LOCK(`nomacomfe-spec-session` · backend spec) | `lock` | 헤딩(Tier · spec/plan 링크) + `- [x] spec LOCK — dev <sha>` |
| 워크트리 부트스트랩(`*-worktree-setup`) | `in-progress` | 헤딩에 `· 세션 <워크트리명>`, 착수 항목 `[~]` |
| QA 통과(`nomacomfe-qa-session`) | `note` | `- [x] QA ⑥ blocker 0/major 0/minor n — dev <sha>` (+ ⏰ 행이면 `obs`) |
| 통합 브랜치 머지(`*-finish-branch`) | `dev-merged` | `- [x] dev 머지 — PR #n dev <sha>` (frontend·backend 공통) |
| prod 반영(`*-prod-push-check` 뒤) | `prod` | `- [x] prod 배포 — prod <sha>` |
| operator AC 등록 · hotfix 판정축 등록 | `obs` | ⏰ 행 추가 — 방법·기준 칸에 로그 그룹·이벤트·기대값. 결과 칸(`PASS|FAIL|판정불가`)은 manager 의 monitor 세션이 채운다(`nomacom-monitor` 스텁 참조) |
| 막힘 | `blocked` | 해당 항목 `[!] … — 사유` |
| 트랙 종결 | `done` | 남은 항목 정리(`[x]`/`[-]`) |
| 위키 크로스리포 초안(`nomacom-wiki-update` 가 직접 호출) | `wiki` | inbox 한 줄(`--ref` = 위키 파일 경로) — manager 의 wiki 세션이 lint·승격 |
| 그 밖의 기록 요청 | `note` | INBOX 한 줄 또는 노트 한 줄 |

## Gotchas

- «dev 머지 = 배포» 가 아니다 — frontend 는 `prod` ref 이동(Dockerfile 게이트, 훅이 직접 push 차단), backend 는 prod 브랜치 반영이 `prod <sha>` 의 근거다. 통합 sha 에 `prod` 라벨을 붙이면 manager 검증에서 FAIL 로 돌아온다.
- 증거 sha 는 push 된 것만(로컬 전용 커밋은 `sha 없음`). PR 번호는 `PR #n` 표기.
- 파일이 400줄을 넘기면 lint 가 경고한다 — 트랙에 서사가 들어온 것이니 as-built 로 옮긴다.
- 2026-09-22 이전 주차의 HTML 보드는 `esmn-wiki/raw/weekly/` 아카이브 — 읽기만, 갱신 금지.

## Integration

- 호출자: `nomacomfe-spec-session` · `nomacomfe-worktree-setup`·`nomacom-worktree-setup` · `nomacomfe-qa-session` · `nomacomfe-finish-branch`·`nomacom-finish-branch` · `nomacom-monitor` 스텁(등록 안내). 사용자 요청("주간에 기록해")으로도 단독 실행.
- 상대: nomacom-manager `nomacom-manager`(검증·렌더·커밋·롤오버). 규격 `$MGR/.claude/rules/weekly.md`.
