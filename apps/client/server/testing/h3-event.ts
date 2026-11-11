// 테스트 전용 — 실제 h3 이벤트(노드 req · res)를 만든다. Nitro 는 server/testing 을 스캔하지 않는다(번들 밖).
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import { createEvent, type H3Event } from 'h3'

export function makeEvent(
  opts: { method?: string; url?: string; headers?: Record<string, string> } = {},
): H3Event {
  const req = new IncomingMessage(new Socket())
  req.method = opts.method ?? 'GET'
  req.url = opts.url ?? '/'
  req.headers = Object.fromEntries(
    Object.entries(opts.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]),
  )
  return createEvent(req, new ServerResponse(req))
}

/** 응답에 쓰인 Set-Cookie 줄들 */
export function setCookieLines(event: H3Event): string[] {
  const v = event.node.res.getHeader('set-cookie')
  return v == null ? [] : Array.isArray(v) ? v.map(String) : [String(v)]
}
