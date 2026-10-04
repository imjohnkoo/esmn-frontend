/**
 * zone 지도 SVG 축소 — 2609 생성기 지도(Natural Earth · public domain)는 합계 31.5MB(78 zone)라 그대로 못 싣는다.
 *  1. viewBox 밖(여유 20)에만 있는 고리(ring)는 버린다
 *  2. 앞 점과 가로 + 세로 거리가 `tolerance` 미만인 점을 솎는다(기본 2 — 390px 화면에서 0.6px 이하)
 *  3. 좌표를 정수로 반올림하고 상대 좌표(`l`)로 적는다 · 주석 · 태그 사이 공백 제거
 * 2026-09-23 실측: 78 zone 31.5MB → 7.27MB, 장당 최대 184KB(plan §2.3 상한 8MB · 250KB).
 * 원본 경로는 절대 좌표 M · L · Z 만 쓴다 — 다른 명령 · 읽을 수 없는 좌표가 보이면 망가뜨리지 않도록 throw 한다.
 */

type Pt = [number, number]

const MARGIN = 20

/**
 * 경로 문자열을 고리 목록으로 — 절대 좌표 M · L(좌표를 이어 쓴 암묵 L 포함) · Z 만 받는다.
 * 모르는 글자 · 짝이 안 맞는 숫자 · 숫자가 아닌 값은 전부 throw — 조용히 버리거나 NaN 을 쓰지 않는다.
 */
function parseRings(d: string): Pt[][] {
  const rings: Pt[][] = []
  let cur: Pt[] = []
  let cmd = ''
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?|[^\s,]/gi) ?? []
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i]!
    if (/^[A-Za-z]$/.test(t)) {
      if (t === 'Z' || t === 'z') {
        if (cur.length) rings.push(cur)
        cur = []
        cmd = ''
      } else if (t === 'M' || t === 'L') {
        cmd = t
      } else {
        throw new Error(`지도 경로에 지원하지 않는 명령 «${t}» — M · L · Z 만`)
      }
      i++
      continue
    }
    const x = Number(t)
    const y = Number(tokens[i + 1])
    if (!cmd || !Number.isFinite(x) || !Number.isFinite(y))
      throw new Error(`지도 경로 좌표를 읽지 못했다(«${tokens.slice(i, i + 2).join(' ')}»)`)
    if (cmd === 'M') {
      if (cur.length) rings.push(cur)
      cur = [[x, y]]
      cmd = 'L' // M 뒤에 이어 쓴 좌표는 L 이다(SVG 규칙)
    } else {
      cur.push([x, y])
    }
    i += 2
  }
  if (cur.length) rings.push(cur)
  return rings
}

function simplify(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 3) return pts
  const keep: Pt[] = [pts[0]!]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!
    const q = keep[keep.length - 1]!
    if (Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) >= tol) keep.push(p)
  }
  keep.push(pts[pts.length - 1]!)
  return keep
}

function encodeRing(ring: Pt[]): string {
  const pts: Pt[] = []
  for (const [x, y] of ring) {
    const p: Pt = [Math.round(x), Math.round(y)]
    const last = pts[pts.length - 1]
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p)
  }
  if (pts.length < 3) return ''
  let [px, py] = pts[0]!
  const rel = pts.slice(1).map(([x, y]) => {
    const s = `${x - px} ${y - py}`
    px = x
    py = y
    return s
  })
  return `M${pts[0]![0]} ${pts[0]![1]}l${rel.join(' ')}z`
}

export function optimizeMapSvg(svg: string, tolerance = 2): string {
  const vb = svg
    .match(/viewBox="([^"]+)"/)?.[1]
    ?.split(/\s+/)
    .map(Number)
  if (!vb || vb.length !== 4 || vb.some((n) => !Number.isFinite(n)))
    throw new Error('지도에 viewBox 가 없다')
  const [x0, y0, w, h] = vb as [number, number, number, number]
  // 읽는 모양은 `<path … d="…"/>`(스스로 닫힘 · 큰따옴표) 하나뿐이다 — 다른 모양 · transform 은 조용히 넘기지 않고 멈춘다
  // (transform 을 무시하면 화면 안의 고리를 밖으로 보고 버린다)
  const paths = svg.match(/<path\b/g)?.length ?? 0
  const readable = svg.match(/<path([^>]*?)\sd="([^"]+)"([^>]*)\/>/g)?.length ?? 0
  if (paths !== readable)
    throw new Error(`지도 path ${paths - readable}개가 읽을 수 없는 모양 — <path … d="…"/> 만`)
  if (/\stransform\s*=/.test(svg))
    throw new Error('지도에 transform 이 있다 — 좌표를 풀어 둔 원본만')
  const visible = (ring: Pt[]) => {
    const xs = ring.map((p) => p[0])
    const ys = ring.map((p) => p[1])
    return !(
      Math.max(...xs) < x0 - MARGIN ||
      Math.min(...xs) > x0 + w + MARGIN ||
      Math.max(...ys) < y0 - MARGIN ||
      Math.min(...ys) > y0 + h + MARGIN
    )
  }
  return svg
    .replace(
      // d 앞에 공백을 요구한다 — `id="…"` · `data-d="…"` 의 끝 글자를 d 로 잡지 않게
      /<path([^>]*?)\sd="([^"]+)"([^>]*)\/>/g,
      (_all, before: string, d: string, after: string) => {
        const enc = parseRings(d)
          .filter(visible)
          .map((r) => encodeRing(simplify(r, tolerance)))
          .join('')
        return enc ? `<path${before} d="${enc}"${after}/>` : ''
      },
    )
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .trim()
}
