// 테스트 전용 — DB 통합 테스트가 쓰는 연결 · 초기화(member-db-setup 이 만든 member_auth_test 만)
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { inject } from 'vitest'
import * as schema from '../db/schema'

export function connectMemberDb() {
  const url = inject('memberDbUrl')
  if (!url.endsWith('/member_auth_test')) throw new Error('member test DB only')
  const client = postgres(url, { max: 10, onnotice: () => {} })
  return { client, db: drizzle(client, { schema }) }
}

/** 회원 표 전부 비우기(테스트 사이) */
export async function resetMemberTables(client: postgres.Sql): Promise<void> {
  await client.unsafe(
    'TRUNCATE service_user_challenge, service_user_session, service_user_identity, service_user_order_link, web_order, consent_log, master_order, service_user RESTART IDENTITY CASCADE',
  )
}
