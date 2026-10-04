import { buildRobotsTxt } from '../../shared/utils/robots'

// robots.txt 는 정적 파일이 아니라 noindex 목록(shared/utils/robots.ts)에서 만든다 — 목록과 어긋나지 않게.
// public/robots.txt 를 다시 만들지 말 것: 정적 파일이 이 라우트보다 먼저 잡힌다.
export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  return buildRobotsTxt()
})
