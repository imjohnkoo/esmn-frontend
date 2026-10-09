---
name: nomacom-monitor
description: 서버 모니터링·배포 후 확인·Spark 재고·operator AC 판정 요청의 리포 쪽 진입점 — 실제 관측·판정은 nomacom-manager 의 monitor 세션(nomacom-monitor 스킬)이 양 리포를 한 번에 한다. Use when the user asks "서버 어때", "이심 재고 얼마나 남았어", "배포 정상이야", "에러 있나", "운영 AC 확인", or a gate skill needs post-deploy observation registered.
---

# nomacom-monitor — 리다이렉트 스텁 (정본 esmn-wiki `schema/repo-skill-monitor.md`, `sync-docs-convention.sh` 복사본 — 여기서 고치지 말 것)

이 리포 세션은 서버를 **관측하지 않는다**. 2026-09-22 부터 **nomacom-manager 의 `nomacom-monitor`** 가 monitor 세션(터미널 제목 `nomacom-monitor`)·automation `nomacom-monitor-daily`(평일 10:30 KST, 월요일 deep)로 esim-manager 서버 + Spark 벤더 축 + frontend admin/client + AWS 계정을 한 번에 본다. 최신 결과 = `$NOMACOM_MANAGER/docs/monitor/latest.md`(`$NOMACOM_MANAGER` fallback `~/dev/current-projects/nomacom-manager`). backend 의 옛 `nomacom-monitor`(reference.md · scripts)는 그쪽 `.claude/skills/nomacom-monitor/{reference,bin}/` 로 옮겨졌다(git 이력만 여기 남는다).

**Announce at start:** "nomacom-monitor 스텁 — 관측은 manager 의 monitor 세션이 합니다. 여기서는 등록/요청만."

## 이 리포 세션이 하는 것

1. **operator AC 등록** — `nomacom-weekly` 스킬 event `obs`: ⏰ 행의 **방법** 칸에 로그 그룹·이벤트·쿼리 축(또는 SQL·벤더 API), **기준** 칸에 기대값을 적는다. monitor 가 판정 시점 도래 시 결과 칸을 채우고 manager 가 커밋한다.
2. **hotfix 판정축** — prod 반영 때 ⏰ 행 한 줄(이벤트·기대값 0 / >0). 옛 `reference.md` › Step C fix→event 매핑 표는 manager `reference/backend/invariants.md` 로 옮겨졌고 **리포 세션이 직접 고치지 않는다** — 트랙 종결 때 manager 롤오버가 영구 항목만 승격.
3. **배포 알림** — `nomacom-weekly` event `prod`(`*-finish-branch`/`*-prod-push-check` 가 부른다). monitor 가 다음 실행 [C] 에서 배포 정상성·회귀 신호를 본다.
4. **즉시 확인이 필요할 때** — 사용자에게 «monitor 실행» 을 요청한다(`orca automations run <nomacom-monitor-daily id>` 또는 monitor 터미널에 «nomacom-monitor deploy 24» / «nomacom-monitor spark»). 리포 세션이 자동 트리거하지 않는다.
5. **로그 직접 조사(디버깅)** — backend 는 `nomacom-cloudwatch-query`(이 리포 스킬), frontend 는 `aws logs start-query --profile nomacom` 직접(`rules/deployment.md` 의 로그 그룹).

## 읽어도 되는 것

- 최신 스냅샷 `$NOMACOM_MANAGER/docs/monitor/latest.md` · 이력 `history.jsonl` · 절차 `$NOMACOM_MANAGER/.claude/skills/nomacom-monitor/SKILL.md`(읽기 전용) · Spark 축 함정 `reference/backend/s-spark.md`

## 하지 않는 것

- 6개 서브에이전트 스냅샷을 여기서 돌리지 않는다. manager 스킬·reference 편집 금지. 옛 plan/spec 의 «reference.md 매핑 표에 한 줄 추가» 지시는 기록 — 이제 ⏰ 행으로 대체한다.
