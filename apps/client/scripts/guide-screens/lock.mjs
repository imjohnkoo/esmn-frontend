// 설치 가이드 PNG 구운 기록의 지문 계산 — render.mjs 와 guide.test.ts 가 같이 쓴다(같은 계산이어야 대조가 된다).
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')

/** 템플릿 · 하네스 · 생성기 · 글꼴 — 이것이 바뀌면 모든 창을 다시 굽는다 */
export function guideInputsHash(dir, fontPath) {
  const h = createHash('sha256')
  for (const f of ['harness.html', 'screens.js', 'ui.css', 'render.mjs', 'lock.mjs'])
    h.update(f).update(readFileSync(join(dir, f)))
  h.update('font').update(readFileSync(fontPath))
  return h.digest('hex')
}

/** 창 하나의 값(화면 · 상태 · 강조 · 비율 · 초점 · 배율) + 폭 · 배율 */
export function guideFigureHash(fig, width, scale) {
  // 대체 글(alt)은 그림에 안 들어가니 지문에서 뺀다
  const shape = { ...fig }
  delete shape.alt
  return sha256(JSON.stringify({ shape, width, scale }))
}
