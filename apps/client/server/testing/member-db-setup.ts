// 로컬 전용 DB 통합 테스트 globalSetup(member-client-auth plan §3) — `yarn workspace nomacom-client test:db`.
// ⛔ prod 에 닿지 않게: 127.0.0.1:55432 로 붙은 서버가 docker 컨테이너 nomacom-walk-pg 와 **같은 서버**(postmaster 시작 시각 일치)인지
//    먼저 확인하고 다르면 멈춘다(55432 에 prod 터널이 떠 있던 전례 — memory local_test_docker_db_only).
// 그 컨테이너 안에 테스트 전용 DB member_auth_test 를 매번 새로 만들고 위키 SQL 3개(+ FK 대상 최소 표)로 실 스키마를 만든다.
// walk DB(walk) 자체는 건드리지 않는다.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import postgres from 'postgres'
import type { TestProject } from 'vitest/node'

const CONTAINER = 'nomacom-walk-pg'
const ADMIN_URL = 'postgres://walk:walk@127.0.0.1:55432/walk'
const TEST_DB = 'member_auth_test'
export const MEMBER_TEST_DB_URL = `postgres://walk:walk@127.0.0.1:55432/${TEST_DB}`
const FILES = [
  '2026-10-01-consent-log-migration.sql',
  '2026-10-15-member-account-migration.sql',
  '2026-11-11-member-web-order-migration.sql',
]
// A1 SQL 전제 — prod 의 backend 표 대신 PK 하나(client 는 이 두 표를 이 트랙에서 읽지도 쓰지도 않는다)
const STUBS = `
CREATE TABLE master_order (master_order_id BIGSERIAL PRIMARY KEY);
CREATE TABLE esim_issuance (esim_issuance_id BIGSERIAL PRIMARY KEY);
`

const START_SQL = 'SELECT extract(epoch FROM pg_postmaster_start_time())::text AS t'

export default async function setup(project: TestProject) {
  const wiki = process.env.NOMACOM_WIKI ?? join(homedir(), 'dev/current-projects/esmn-wiki')
  const dir = join(wiki, 'wiki/backend/migrations')
  const sqls = FILES.map((f) => readFileSync(join(dir, f), 'utf8'))

  // docker 대상 = 이 기계의 데몬(unix 소켓)만 — client-walk-db.sh check_docker 와 같은 판정
  const dockerHost = process.env.DOCKER_HOST ?? ''
  const endpoint = execFileSync('docker', [
    'context',
    'inspect',
    '--format',
    '{{.Endpoints.docker.Host}}',
  ])
    .toString()
    .trim()
  if ((dockerHost && !dockerHost.startsWith('unix://')) || !endpoint.startsWith('unix://')) {
    throw new Error(
      `docker daemon is not local (DOCKER_HOST=${dockerHost || '-'} · context=${endpoint}) — refusing`,
    )
  }

  const inContainer = execFileSync('docker', [
    'exec',
    CONTAINER,
    'env',
    '-i',
    'PATH=/usr/local/bin:/usr/bin:/bin',
    'psql',
    '-X',
    '-h',
    '/var/run/postgresql',
    '-U',
    'walk',
    '-d',
    'walk',
    '-At',
    '-c',
    START_SQL,
  ])
    .toString()
    .trim()

  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} })
  try {
    const [{ t }] = await admin.unsafe<{ t: string }[]>(START_SQL)
    if (t !== inContainer) {
      throw new Error(
        `127.0.0.1:55432 is not ${CONTAINER} (postmaster start ${t} ≠ ${inContainer}) — refusing`,
      )
    }
    await admin.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB} WITH (FORCE)`)
    await admin.unsafe(`CREATE DATABASE ${TEST_DB}`)
  } finally {
    await admin.end()
  }

  const db = postgres(MEMBER_TEST_DB_URL, { max: 1, onnotice: () => {} })
  try {
    await db.unsafe(STUBS)
    for (const sql of sqls) await db.unsafe(sql)
  } finally {
    await db.end()
  }
  project.provide('memberDbUrl', MEMBER_TEST_DB_URL)
}

declare module 'vitest' {
  export interface ProvidedContext {
    memberDbUrl: string
  }
}
