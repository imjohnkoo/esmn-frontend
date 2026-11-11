// walk-mail-mock.mjs — 회원 walk(member-client-auth E2E-0 ②) 전용 backend `internal/notify/email` 대역.
// 127.0.0.1 에만 묶는다 · 실제 발송 0 · 받은 본문(kind · to · vars)을 <출력 파일>에 한 줄 JSON 으로 덧붙인다(스크래치 경로만 쓸 것 —
// 코드 · 링크가 들어 있다). 헤더 X-Internal-Auth = client-walk-server.sh 의 walk 고정 값이 아니면 401 · 다른 경로 404.
// 사용: node .claude/scripts/walk-mail-mock.mjs <port> <출력 파일>
import { appendFileSync } from 'node:fs'
import { createServer } from 'node:http'

const [port, out] = process.argv.slice(2)
if (!/^[1-9]\d{3,4}$/.test(port ?? '') || !out) {
  console.error('사용: node walk-mail-mock.mjs <port> <출력 파일>')
  process.exit(2)
}

createServer((req, res) => {
  let raw = ''
  req.on('data', (c) => (raw += c))
  req.on('end', () => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (req.headers['x-internal-auth'] !== 'walk-internal-secret')
      return send(401, { message: 'Unauthorized' })
    if (req.method !== 'POST' || req.url !== '/internal/notify/email')
      return send(404, { message: 'Not Found' })
    try {
      const { kind, to, vars } = JSON.parse(raw)
      appendFileSync(out, `${JSON.stringify({ kind, to, vars, at: new Date().toISOString() })}\n`)
      send(202, { result: 'SENT', messageId: 'walk-mock' })
    } catch {
      send(400, { message: 'bad body' })
    }
  })
}).listen(Number(port), '127.0.0.1', () => console.log(`walk-mail-mock 127.0.0.1:${port} → ${out}`))
