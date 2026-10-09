---
name: nomacom-wiki-update
description: How this repo's session writes documentation — this repo has no docs/; every document lives in esmn-wiki. Own execution docs (spec, plan, design, report, reference, repo-local decision/runbook, migration SQL) go straight into wiki/<backend|frontend>/ and are committed by this session (pull --rebase → own subtree only → lint hook → push); a backend↔frontend contract change is one line in wiki/contracts/CHANGELOG.md; cross-repo decisions/runbooks/domain facts/entities are drafts under wiki/_drafts/<CODE>/ that the nomacom-manager wiki session promotes after John's ack. Use when writing or saving a spec/plan/runbook ("spec 작성", "plan 저장", "문서 어디에"), when the user says "위키에 반영", "CHANGELOG 추가", "결정 기록해", "런북 올려", or when spec LOCK / finish-branch touched a backend↔frontend contract.
---

# nomacom-wiki-update — 문서는 전부 esmn-wiki 에 (정본 esmn-wiki `schema/repo-skill-wiki.md`, sync 복사본 — 여기서 고치지 말 것)

이 리포에는 `docs/` 가 없다(2026-09-22 결정 nomacom-wiki 0001). 실행 문서는 이 세션이 **직접** esmn-wiki 의 자기 트리(`wiki/<alias>/`)에 쓰고 커밋하고, 크로스리포 페이지는 초안만 쓰고 알리면 nomacom-manager 의 **wiki 세션**(스킬 `nomacom-wiki`, 터미널 `nomacom-wiki`)이 lint·승격(John ack)·index·log 를 한다.

**Announce at start:** "nomacom-wiki-update: [실행 문서 직접 커밋 / CHANGELOG 한 줄 / 크로스리포 초안]."

## 0. 경로 · 읽기

- `NOMACOM_WIKI` fallback `../esmn-wiki` → `~/dev/current-projects/esmn-wiki`. `NOMACOM_MANAGER` fallback `~/dev/current-projects/nomacom-manager`.
- alias = 이 워크트리의 `git remote get-url origin`: `esmn-backend` → `backend`, `esmn-frontend` → `frontend`. 자기 트리 = `$NOMACOM_WIKI/wiki/<alias>/`.
- 쓰기 전에 `$NOMACOM_WIKI/index.md` → `wiki/<alias>/README.md`(생성물 — 내 리포 문서 전체 목록) → 관련 페이지 → `wiki/contracts/CHANGELOG.md`. 이미 있는 문서를 새로 만들지 않는다.

## 1. 어디에 쓰나 (`$NOMACOM_WIKI/schema/placement.md`)

| 바뀐 것 | 위치 | 이 스킬의 동작 |
| --- | --- | --- |
| 기능정의서·계획서·설계·리포트·참고·리포 로컬 결정/런북·마이그레이션 SQL | `wiki/<alias>/{specs,plans,designs,reports,reference,decisions,runbooks,migrations}/` | **직접 쓰고 커밋**(2절) |
| backend↔frontend 계약(API·이벤트·shared entity·DB 스키마) | `wiki/contracts/CHANGELOG.md` 한 줄 | **직접 쓰고 커밋**(3절) |
| 둘 이상 리포에 걸치는 결정·런북·도메인 사실·외부 시스템 | `wiki/_drafts/<CODE>/<slug>.md` | **초안 + 알림**(4절) → wiki 세션 승격 |
| 기존 현재형 페이지(domains·entities·runbooks…)의 오류·보강 | 초안으로 «수정 제안»(`supersedes:` 또는 `## 제안` 절) | 정본을 직접 고치지 않는다 |

## 2. 실행 문서 — 쓰기·커밋

1. 템플릿: `cp $NOMACOM_WIKI/schema/templates/<spec|plan|decision-local|runbook>.md $NOMACOM_WIKI/wiki/<alias>/<dir>/YYYY-MM-DD-<topic>.md` (frontend 는 `<dir>/<app>/` 하위 허용). html 렌더는 같은 이름으로 옆에(선택) — **md 가 정본**, 둘 다 고친다.
2. frontmatter: `type` · `title` · **`repo: <이 리포>` 하나**(repos.yaml 키 `esmn-backend` | `esmn-frontend` — 옛 `nomacom-*` 키는 alias 라 lint L2 오류) · `status`(spec: draft → proposed → accepted = LOCK) · `owner` · `created/updated` · `sources`(권장 — 상위 proposal `repo://nomacom-manager/docs/proposals/…` 또는 spec 상대경로, 코드는 `repo://…@sha`) · `tags`.
3. 링크: 위키 안은 상대경로, 코드는 `[repo://<이 리포>/<path>#Lx-Ly@<sha>](퍼머링크)`. `python3 $NOMACOM_WIKI/scripts/wiki-linkify.py <file>` 로 맞춘다.
4. 커밋(자기 트리만):

```bash
cd $NOMACOM_WIKI && git pull --rebase --autostash
git add wiki/<alias>/                                   # 다른 트리 · index.md · wiki/*/README.md · log.md · _meta/ 금지
git commit -m "<alias>: <spec|plan|decision|runbook> <topic> (<CODE>)"   # pre-commit lint 가 막으면 [E] 를 고친다 — WIKI_SKIP_LINT 금지
git push origin main                                    # 거부되면 git pull --rebase 후 재시도 (다른 세션이 먼저 밀었을 뿐)
```

5. `index.md`·`wiki/<alias>/README.md` 는 손대지 않는다 — wiki 세션 daily 가 재생성한다(그 사이엔 `ls`·`git log` 로 찾는다).
6. 고객 데이터가 든 파일(백필 SQL·CSV) → `wiki/<alias>/_local/`(gitignore) — 커밋 금지. lint L8 이 전화·이메일·실명 평문을 막는다.

## 3. 계약 CHANGELOG 한 줄

`## 2026` 바로 아래(최신이 위)에 쓰고 2절과 같은 방법으로 커밋(`git add wiki/contracts/CHANGELOG.md`):

```
- YYYY-MM-DD · <계약(테이블·컬럼·엔드포인트·이벤트)> · <무엇이 어떻게> · <영향 리포> · [repo://<repo>/<path>#Lx-Ly@<sha>](https://github.com/imjohnkoo/<repo>/blob/<sha>/<path>#Lx-Ly)
```

sha 는 push 된 커밋만. 그 뒤 4절의 알림도 보낸다(`--ref wiki/contracts/CHANGELOG.md`).

## 4. 크로스리포 초안 + 알림

1. `mkdir -p $NOMACOM_WIKI/wiki/_drafts/<CODE>` · `cp $NOMACOM_WIKI/schema/templates/<decision|domain|runbook|entity>.md …/<slug>.md`. slug 는 kebab-case 영문, 결정은 번호 없이(승격 때 wiki 세션이 `NNNN-` 부여).
2. frontmatter: `type` · `title` · `repo: [esmn-backend, esmn-frontend]`(관여 리포 전부) · `status: proposed` · `owner` · `created/updated` · **`sources ≥ 1`**(`repo://…@sha`) · `tags`. 본문: TL;DR → 무엇/왜 → 하지 말 것 → 제약 → `## 관련`(아웃링크 ≥ 2) → `## 출처`. 코드로 grep 되는 것은 쓰지 않는다.
3. 자가 검증: `python3 $NOMACOM_WIKI/scripts/wiki-lint.py --repo $NOMACOM_WIKI 2>&1 | grep '<slug>'` — 내 파일의 E 가 0.
4. 초안도 자기 커밋으로 올린다(`git add wiki/_drafts/<CODE>/`, 2절과 같은 방법) — 유실 방지.
5. 알림(필수):

```bash
python3 $NOMACOM_MANAGER/scripts/weekly-notify.py --repo <backend|frontend> --track <CODE> --event wiki \
  --ref wiki/_drafts/<CODE>/<slug>.md --note "<한 줄: 무엇을 왜 — 승격 제안 dir(decisions|domains|runbooks|entities)>"
```

`nomacom-manager/docs/weekly/inbox.md` 에 남고(내구) `nomacom-wiki` 터미널에 nudge 된다. 즉시 확인이 필요하면 사용자에게 «wiki 세션 실행» 을 요청한다.

## 하지 않는 것

- 다른 리포 트리(`wiki/<다른 alias>/`) · 현재형 정본(`wiki/domains` `entities` `decisions` `runbooks` `overview` `infra` `research`) · `raw/` · `index.md` · `log.md` · `_meta/` 편집. 승격·편입은 wiki 세션(John ack).
- `git push --force` · `WIKI_SKIP_LINT=1` · `wiki-index.py` 맨 실행(nomacom-manager 의 `docs/INDEX.md` 까지 쓴다).

## Integration

- 호출: `*-spec-session`(spec 저장·LOCK) · `*-write-plan` / `*-writing-plans`(plan 저장) · `*-executing-plans`(plan 읽기) · `*-finish-branch`(as-built·계약 반영) · 사용자 요청.
- 상대: nomacom-manager `nomacom-wiki`(승격·위생) · `nomacom-weekly`(주간 SoT 행, event `wiki` 포함). 규약 정본 `$NOMACOM_WIKI/AGENTS.md` · `schema/placement.md` · `schema/frontmatter.md`.
