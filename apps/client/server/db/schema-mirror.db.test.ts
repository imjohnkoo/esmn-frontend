// F-1 — Drizzle 미러 ↔ 위키 SQL 로 만든 실 표(이름 · NOT NULL) 대조. prod 쪽 대조는 V2(매니저 pg_catalog 실측)
import { getTableColumns, getTableName } from 'drizzle-orm'
import { afterAll, describe, expect, it } from 'vitest'
import { connectMemberDb } from '../testing/member-db'
import * as schema from './schema'

const { client } = connectMemberDb()
afterAll(() => client.end())

const TABLES = [
  schema.serviceUser,
  schema.serviceUserIdentity,
  schema.serviceUserSession,
  schema.serviceUserOrderLink,
  schema.serviceUserChallenge,
  schema.webOrder,
  schema.consentLog,
]

describe('미러 열 = 실 표 열', () => {
  it.each(TABLES.map((t) => [getTableName(t), t] as const))('%s', async (name, table) => {
    const rows = await client<{ column_name: string; is_nullable: string }[]>`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ${name} ORDER BY ordinal_position`
    const db = rows.map((r) => `${r.column_name}:${r.is_nullable === 'NO' ? 'NN' : 'N'}`).sort()
    const mirror = Object.values(getTableColumns(table))
      .map((c) => `${c.name}:${c.notNull ? 'NN' : 'N'}`)
      .sort()
    expect(mirror).toEqual(db)
  })
})
