// 공개 헬스 — 회원 정보는 싣지 않는다(member-client-auth F-18 · platform 만)
export default defineEventHandler((event) => ({
  status: 'ok',
  app: 'nomacom-client',
  commit: process.env.GIT_COMMIT ?? 'unknown',
  timestamp: new Date().toISOString(),
  auth: { platform: event.context.auth?.platform ?? null },
}))
