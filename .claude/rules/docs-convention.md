# 문서 규약 — esmn-wiki 스키마 v1 (공통, 복사본)

> 정본·상세: `$NOMACOM_WIKI/schema/` (`frontmatter.md` · `placement.md` · `templates/`). 이 파일은 `ai-manager/scripts/sync-docs-convention.sh` 가 전파한다 — 여기서 고치지 말 것. 지식 지도(위키 먼저 읽기)는 루트 컨텍스트 파일의 「지식 지도 — esmn-wiki」 절.

- **이 리포에는 `docs/` 가 없다**(2026-09-22 결정 nomacom-wiki 0001). 기능정의서·계획서·설계·리포트·참고 문서·리포 로컬 결정·런북·마이그레이션 SQL 은 esmn-wiki **`wiki/<alias>/`**(esmn-backend → `wiki/backend/`, esmn-frontend → `wiki/frontend/`)에 쓴다 — 이 리포 세션이 직접 쓰고 커밋한다(자기 트리 + `wiki/_drafts/<CODE>/` + `wiki/contracts/CHANGELOG.md` 한 줄만). 절차 `nomacom-wiki-update` 스킬.
- **새 md 는 첫 줄부터 frontmatter**(`$NOMACOM_WIKI/schema/frontmatter.md`). 템플릿 `$NOMACOM_WIKI/schema/templates/{spec,plan,decision-local,runbook}.md`. html 렌더는 사람용 — md 옆에 같은 이름으로 두되 **md 가 정본**(둘 다 고친다).
- 둘 이상 리포에 걸치는 사실·결정·계약·런북 → `wiki/_drafts/<CODE>/` 초안 + `weekly-notify.py --event wiki` → nomacom-manager 의 wiki 세션이 승격(John ack). backend↔frontend 계약 변경은 `wiki/contracts/CHANGELOG.md` 한 줄 직접.
- 링크(0019): 위키 안은 상대경로, 다른 리포는 `[repo://<repo>/<path>#Lx-Ly@<sha>](GitHub 퍼머링크)` 병기. 절대경로·`file://`·`[[…]]`·`raw://` 금지(변환 `python3 $NOMACOM_WIKI/scripts/wiki-linkify.py <file>`). 시크릿·평문 PII 금지 — 고객 데이터 파일은 `wiki/<alias>/_local/`(gitignore).
- 커밋: `git -C $NOMACOM_WIKI` 로 자기 트리만, 먼저 `pull --rebase`; pre-commit lint(`wiki-lint.py --staged`) 통과 필수(`WIKI_SKIP_LINT` 금지). `index.md`·`wiki/<alias>/README.md`·`log.md`·`_meta/` 는 생성물·wiki 세션 몫.
- 미래형(T3 Proposal·recon·handoff·roadmap)과 주간 SoT(`docs/weekly/`)·관측(`docs/monitor/`)은 nomacom-manager — 주간 행은 `nomacom-weekly` 스킬, 관측 요청은 `nomacom-monitor` 스텁.
