/**
 * 설치 가이드 인라인 표기 파서(client-guide plan §2) — 콘텐츠에 HTML 을 쓰지 않으려는 작은 표기.
 *
 *   {{eSIM 추가}}        누를 버튼 · 메뉴 이름 (형광 밑줄)
 *   [[설정 › 셀룰러]]     메뉴 경로 (굵게 · `›` 에서만 줄이 바뀐다)
 *   **굵게**             강조
 *   ((Wi-Fi나))          줄바꿈 금지 묶음
 *
 * 이름 · 경로 바로 뒤의 한글 조사(«를» · «에서» …)는 같은 토막에 붙인다 — 조사가 다음 줄로 떨어지지 않게
 * (2609 판 `typo.js` 규칙). 짝이 안 맞는 표기는 던진다 — 테스트가 콘텐츠 전부를 이 파서로 읽는다.
 */

export type GuideInline =
  | { t: 'text'; v: string }
  | { t: 'ui'; v: string; particle: string }
  | { t: 'path'; parts: string[]; particle: string }
  | { t: 'b'; v: string }
  | { t: 'nw'; v: string }

const TOKEN = /\{\{(.+?)\}\}|\[\[(.+?)\]\]|\*\*(.+?)\*\*|\(\((.+?)\)\)/g
const STRAY = /\{\{|\}\}|\[\[|\]\]|\*\*|\(\(|\)\)/
const PARTICLE = /^[가-힣]+/

export function parseGuideInline(src: string): GuideInline[] {
  const out: GuideInline[] = []
  let last = 0
  let pendingParticle: { t: 'ui' | 'path' } | null = null

  const pushText = (text: string) => {
    if (!text) return
    if (STRAY.test(text))
      throw new Error(`guide inline: 짝이 안 맞는 표기 — ${JSON.stringify(src)}`)
    let rest = text
    if (pendingParticle) {
      const m = rest.match(PARTICLE)
      if (m) {
        const prev = out[out.length - 1] as Extract<GuideInline, { t: 'ui' | 'path' }>
        prev.particle = m[0]
        rest = rest.slice(m[0].length)
      }
    }
    pendingParticle = null
    if (rest) out.push({ t: 'text', v: rest })
  }

  for (const m of src.matchAll(TOKEN)) {
    pushText(src.slice(last, m.index))
    pendingParticle = null
    const [, ui, path, bold, nw] = m
    if (ui !== undefined) {
      out.push({ t: 'ui', v: ui, particle: '' })
      pendingParticle = { t: 'ui' }
    } else if (path !== undefined) {
      const parts = path.split('›').map((p) => p.trim())
      if (parts.some((p) => !p))
        throw new Error(`guide inline: 빈 경로 토막 — ${JSON.stringify(src)}`)
      out.push({ t: 'path', parts, particle: '' })
      pendingParticle = { t: 'path' }
    } else if (bold !== undefined) {
      out.push({ t: 'b', v: bold })
    } else if (nw !== undefined) {
      out.push({ t: 'nw', v: nw })
    }
    last = m.index + m[0].length
  }
  pushText(src.slice(last))
  return out
}

/** 표기를 걷어 낸 글자 — 원본 대조 · 검색 · 금지어 검사용 (경로는 « › » 로 잇는다) */
export function guidePlainText(src: string): string {
  return parseGuideInline(src)
    .map((s) => {
      if (s.t === 'ui') return s.v + s.particle
      if (s.t === 'path') return s.parts.join(' › ') + s.particle
      return s.v
    })
    .join('')
}
