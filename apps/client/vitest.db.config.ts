import { defineConfig } from 'vitest/config'

// 로컬 전용 DB 통합 테스트(member-client-auth plan §3) — 기본 `test`(CI)에는 넣지 않는다(vitest.config.ts 머리 규칙).
// 준비: bash .claude/scripts/client-walk-db.sh up  →  yarn workspace nomacom-client test:db  →  끝나면 docker stop nomacom-walk-pg
// globalSetup 이 55432 서버 = nomacom-walk-pg 를 확인한 뒤에만 테스트 DB(member_auth_test)를 만든다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.db.test.ts'],
    globalSetup: ['./server/testing/member-db-setup.ts'],
    // 한 DB 를 같이 쓰므로 파일을 순서대로(테스트 안 동시성 시험은 그 파일 안에서 한다)
    fileParallelism: false,
    passWithNoTests: false,
    testTimeout: 30_000,
  },
})
