import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { flagUrl, mapUrl, thumbUrl, type AssetManifest } from './assets'
import { optimizeMapSvg } from './map-svg'
import { ACTIVE_CATALOG_FILE, APP_DIR as APP, activeCatalog } from './test-data'

const catalogFile = ACTIVE_CATALOG_FILE
const catalog = activeCatalog()
const manifest = JSON.parse(
  readFileSync(`${APP}app/content/catalog-assets.json`, 'utf8'),
) as AssetManifest
const upcoming = JSON.parse(readFileSync(`${APP}app/content/catalog-upcoming.json`, 'utf8'))
  .countries as {
  iso2: string
}[]
const publicFile = (url: string) => `${APP}public${url}`

describe('자산 매니페스트 ↔ 카탈로그 (spec F-2 · D-14)', () => {
  it('매니페스트는 지금 쓰는 카탈로그 파일에서 만들었다(실 catalog.json 이 오면 다시 돌려야 한다)', () => {
    expect(manifest.source.catalog).toBe(catalogFile)
    expect(manifest.source.generatedAt).toBe(catalog.generatedAt)
  })

  it('상품마다 썸네일 · zone 마다 지도 · 나라마다 국기가 있고 파일이 실제로 있다', () => {
    for (const z of catalog.zones) {
      expect(existsSync(publicFile(mapUrl(manifest, z.map.src)))).toBe(true)
      for (const p of z.products)
        expect(existsSync(publicFile(thumbUrl(manifest, p.thumb)))).toBe(true)
      for (const c of z.countries)
        expect(existsSync(publicFile(flagUrl(manifest, c.iso2)))).toBe(true)
    }
    for (const c of upcoming) expect(existsSync(publicFile(flagUrl(manifest, c.iso2)))).toBe(true)
  })

  it('파일명의 해시 8자 = 파일 내용 sha256 앞 8자(손으로 바꾼 파일이 옛 캐시로 남지 않게)', () => {
    for (const url of [
      ...Object.values(manifest.thumbs),
      ...Object.values(manifest.maps),
      ...Object.values(manifest.flags),
    ]) {
      const hash = createHash('sha256')
        .update(readFileSync(publicFile(url)))
        .digest('hex')
      expect(url.split('.').at(-2), url).toBe(hash.slice(0, 8))
    }
  })

  it('매니페스트 키 = 파일 이름 앞부분(다른 상품 · zone · 나라 파일을 가리키지 않는다)', () => {
    for (const group of ['thumbs', 'maps', 'flags'] as const)
      for (const [key, url] of Object.entries(manifest[group]))
        expect(url.split('/').at(-1)!.split('.')[0], `${group}.${key}`).toBe(key)
  })

  it('같은 출처로 나가는 SVG(지도 · 국기)에 실행되는 내용이 없다', () => {
    for (const url of [...Object.values(manifest.maps), ...Object.values(manifest.flags)]) {
      const svg = readFileSync(publicFile(url), 'utf8')
      // 네임스페이스 붙은 script(<h:script>) · SMIL(<set> · <animate>) · javascript: 주소도
      expect(svg, url).not.toMatch(
        /<([\w-]+:)?script\b|\son\w+\s*=|<foreignObject|<(set|animate\w*)\b|javascript:|href\s*=\s*["'](?!#)/i,
      )
    }
  })

  it('지도마다 강조 그룹(그 zone 나라 · #c7b6ff)에 도형이 있다', () => {
    // 배경 그룹은 비어도 된다 — 몰타(MLT00)처럼 원본 배경이 화면 밖에만 있는 지도가 있다(가장자리 판정은 아래 단위 테스트)
    for (const [zone, url] of Object.entries(manifest.maps)) {
      const svg = readFileSync(publicFile(url), 'utf8')
      const hl = svg.match(/<g fill="#c7b6ff"[^>]*>([\s\S]*?)<\/g>/)?.[1] ?? ''
      expect(hl.match(/<path /g)?.length ?? 0, zone).toBeGreaterThan(0)
    }
  })

  it('파일명에 내용 해시 8자가 붙는다(쿼리스트링 버전 금지)', () => {
    for (const url of [
      ...Object.values(manifest.thumbs),
      ...Object.values(manifest.maps),
      ...Object.values(manifest.flags),
    ])
      expect(url).toMatch(/^\/catalog\/(thumbs|maps|flags)\/[A-Z0-9]+\.[0-9a-f]{8}\.(webp|svg)$/)
  })

  it('출력 폴더에 매니페스트 밖 파일이 없다(국기 LICENSE 제외)', () => {
    const listed = new Set(
      [
        ...Object.values(manifest.thumbs),
        ...Object.values(manifest.maps),
        ...Object.values(manifest.flags),
      ].map((u) => u.replace('/catalog/', '')),
    )
    for (const dir of ['thumbs', 'maps', 'flags'])
      for (const f of readdirSync(`${APP}public/catalog/${dir}`))
        if (f !== 'LICENSE') expect(listed.has(`${dir}/${f}`), `${dir}/${f}`).toBe(true)
    expect(readFileSync(`${APP}public/catalog/flags/LICENSE`, 'utf8')).toMatch(/MIT License/)
  })

  it('지도는 장당 250KB · 합계 8MB 이하, 글꼴 · 래스터 없음', () => {
    let total = 0
    for (const url of Object.values(manifest.maps)) {
      const f = publicFile(url)
      const size = statSync(f).size
      total += size
      expect(size, url).toBeLessThanOrEqual(250 * 1024)
      const svg = readFileSync(f, 'utf8')
      expect(svg).toMatch(/viewBox="/)
      expect(svg).not.toMatch(/<image|<text|@font-face|pstatic|NaN/)
      // 빈 지도 금지 — 도형이 남아 있어야 한다
      expect(svg.match(/<path [^>]*d="M/g)?.length ?? 0, url).toBeGreaterThan(0)
    }
    expect(total).toBeLessThanOrEqual(8 * 1024 * 1024)
  })

  it('썸네일은 400×400 webp', async () => {
    for (const url of Object.values(manifest.thumbs)) {
      const meta = await sharp(publicFile(url)).metadata()
      expect([meta.format, meta.width, meta.height]).toEqual(['webp', 400, 400])
    }
  })

  it('없는 키 · 논리 경로가 아닌 값은 던진다', () => {
    expect(() => thumbUrl(manifest, '/catalog/thumbs/XXX00U.webp')).toThrow(/썸네일/)
    expect(() => thumbUrl(manifest, 'https://shop-phinf.pstatic.net/a.png')).toThrow(/논리 경로/)
    expect(() => mapUrl(manifest, '/catalog/maps/XXX00.svg')).toThrow(/지도/)
    expect(() => flagUrl(manifest, 'zz')).toThrow(/국기/)
  })
})

describe('optimizeMapSvg', () => {
  const svg = (paths: string) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">\n<!-- c -->\n<g>${paths}</g>\n</svg>`

  it('viewBox 밖에만 있는 고리는 버리고 안쪽은 남긴다', () => {
    const out = optimizeMapSvg(svg('<path d="M10,10L50,10L50,50Z M300,300L350,300L350,350Z"/>'))
    expect(out).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g><path d="M10 10l40 0 0 40z"/></g></svg>',
    )
  })

  it('경로가 전부 밖이면 path 자체가 사라진다', () => {
    expect(optimizeMapSvg(svg('<path d="M300,300L350,300L350,350Z"/>'))).not.toContain('<path')
  })

  it('허용치보다 가까운 점은 솎고 정수로 반올림한다', () => {
    const out = optimizeMapSvg(
      svg('<path d="M10.4,10.4L10.9,10.6L11.2,10.8L40.2,10.3L40.4,40.6Z"/>'),
      2,
    )
    expect(out).toContain('d="M10 10l30 0 0 31z"')
  })

  it('M · L · Z 말고 다른 명령이 있으면 던진다', () => {
    expect(() => optimizeMapSvg(svg('<path d="M10,10C20,20 30,30 40,40Z"/>'))).toThrow(
      /지원하지 않는 명령/,
    )
  })

  it('y 축으로만 화면 밖인 고리(위 · 아래)도 버린다', () => {
    const out = optimizeMapSvg(
      svg('<path d="M10,10L50,10L50,50Z M10,-300L50,-300L50,-250Z M10,300L50,300L50,350Z"/>'),
    )
    expect(out).toContain('d="M10 10l40 0 0 40z"')
    expect(out).not.toMatch(/-300|300/)
  })

  // viewBox 0 0 100 100 · 여유 20 — 네 방향 모두 «걸친 고리는 남기고, 여유 밖은 버린다»
  it.each([
    ['왼쪽 가장자리에 걸침', 'M-50,40L10,40L10,60Z', true],
    ['오른쪽 가장자리에 걸침', 'M90,40L150,40L150,60Z', true],
    ['위쪽 가장자리에 걸침', 'M40,-50L60,-50L60,10Z', true],
    ['아래쪽 가장자리에 걸침', 'M40,90L60,90L60,150Z', true],
    ['오른쪽 아래 안쪽', 'M60,60L90,60L90,90Z', true],
    ['오른쪽 밖이지만 여유 안(110~118)', 'M110,40L118,40L118,60Z', true],
    ['왼쪽 밖이지만 여유 안', 'M-18,40L-10,40L-10,60Z', true],
    ['위쪽 밖이지만 여유 안', 'M40,-18L60,-18L60,-10Z', true],
    ['아래쪽 밖이지만 여유 안', 'M40,110L60,110L60,118Z', true],
    ['오른쪽 여유 밖(125~140)', 'M125,40L140,40L140,60Z', false],
    ['왼쪽 여유 밖', 'M-40,40L-25,40L-25,60Z', false],
    ['위쪽 여유 밖', 'M40,-40L60,-40L60,-25Z', false],
    ['아래쪽 여유 밖', 'M40,125L60,125L60,140Z', false],
  ])('%s → 남김 %s', (_n, d, kept) => {
    expect(optimizeMapSvg(svg(`<path d="${d}"/>`)).includes('<path'), d).toBe(kept)
  })

  it('점을 솎을 때 «마지막으로 남긴 점» 과 거리를 잰다(바로 앞 원본 점이 아니다)', () => {
    // 간격 1 인 점이 이어져도 남긴 점에서 2 가 되면 남긴다 — 앞 점과만 비교하면 해안선이 통째로 사라진다
    const out = optimizeMapSvg(svg('<path d="M0,0L1,0L2,0L3,0L4,0L4,1L4,2L4,3L4,4Z"/>'), 2)
    expect(out).toContain('d="M0 0l2 0 2 0 0 2 0 2z"')
  })

  it('거리는 가로 + 세로(대각선 1,1 은 2 — 남긴다)', () => {
    const out = optimizeMapSvg(svg('<path d="M0,0L1,1L10,0L10,10Z"/>'), 2)
    expect(out).toContain('d="M0 0l1 1 9 -1 0 10z"')
  })

  it('허용치와 같은 거리의 점은 남긴다(경계 포함)', () => {
    const out = optimizeMapSvg(svg('<path d="M10,10L12,10L40,10L40,40Z"/>'), 2)
    expect(out).toContain('d="M10 10l2 0 28 0 0 30z"')
  })

  it('반올림 뒤 겹친 점은 하나로 · 점이 세 개 미만이 되면 고리를 버린다', () => {
    expect(optimizeMapSvg(svg('<path d="M10,10L10.2,10.1L30,10L30,30Z"/>'), 0)).toContain(
      'd="M10 10l20 0 0 20z"',
    )
    expect(optimizeMapSvg(svg('<path d="M10,10L10.2,10.1L10.3,10.2Z"/>'), 0)).not.toContain('<path')
  })

  it('id · data-* 속성이 있어도 d 만 바꾸고 속성은 그대로 둔다', () => {
    const out = optimizeMapSvg(
      svg('<path id="Z1" data-d="x" fill="#ccc" d="M10,10L50,10L50,50Z" class="hl"/>'),
    )
    expect(out).toContain('<path id="Z1" data-d="x" fill="#ccc" d="M10 10l40 0 0 40z" class="hl"/>')
  })

  it('M · L 뒤에 좌표를 이어 쓴 암묵 L 도 읽는다', () => {
    expect(optimizeMapSvg(svg('<path d="M10,10 50,10 50,50Z"/>'))).toContain(
      'd="M10 10l40 0 0 40z"',
    )
    expect(optimizeMapSvg(svg('<path d="M10,10L50,10 50,50Z"/>'))).toContain(
      'd="M10 10l40 0 0 40z"',
    )
  })

  it('짝이 안 맞거나 읽을 수 없는 좌표는 NaN 을 쓰지 않고 던진다', () => {
    expect(() => optimizeMapSvg(svg('<path d="M10,10L50Z"/>'))).toThrow(/좌표를 읽지 못했다/)
    expect(() => optimizeMapSvg(svg('<path d="M10,10L50,x,50Z"/>'))).toThrow(/좌표를 읽지 못했다/)
    expect(() => optimizeMapSvg(svg('<path d="10,10L50,50Z"/>'))).toThrow(/좌표를 읽지 못했다/)
  })

  it.each([
    ['닫는 태그가 따로', '<path d="M10,10L50,10L50,50Z"></path>'],
    ['작은따옴표 d', "<path d='M10,10C1,1 2,2 3,3Z'/>"],
    ['transform', '<g transform="translate(-300,0)"><path d="M310,10L350,10L350,50Z"/></g>'],
  ])('읽지 않는 모양(%s)은 조용히 넘기지 않고 던진다', (_n, paths) => {
    expect(() => optimizeMapSvg(svg(paths))).toThrow(/읽을 수 없는 모양|transform/)
  })

  it('viewBox 가 없으면 던진다', () => {
    expect(() => optimizeMapSvg('<svg><path d="M1,1L2,2Z"/></svg>')).toThrow(/viewBox/)
  })
})
