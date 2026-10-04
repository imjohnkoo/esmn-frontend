/**
 * 카탈로그 자산 생성 — spec F-2 · D-7 · D-14. 카탈로그(K1)가 가리키는 이미지만 만든다.
 *
 *   yarn workspace nomacom-client catalog:assets --design <design 폴더>
 *
 * --design = 2609 자산이 있는 `design/` 폴더(W1-0 머지 전에는 smartstore-assets 워크트리, 뒤에는 리포 루트 design/).
 *            **읽기만 한다** — design/ 은 이 트랙이 고치지 않는다. 상대경로는 **리포 루트** 기준(예: `--design design`).
 * ⚠️ rep-v1 PNG(`design/thumbnails/out/`)는 gitignore 라 머지로 옮겨지지 않는다 — main 에서 돌리려면 먼저
 *    `node design/thumbnails/figma-2609/render-v1.mjs` 로 재렌더한다(spec ①.5 W1-0).
 * 입력:  thumbnails/out/rep-v1/{SKU}/{SKU}_00_rep.png (1000px) · products/_generator/maps/{ZONE}.svg
 *        · flag-icons(MIT) flags/1x1/{iso2}.svg · app/content/catalog-upcoming.json(준비 중 나라 국기)
 * 출력:  public/catalog/thumbs/{SKU}.{hash8}.webp (400px) · maps/{ZONE}.{hash8}.svg (map-svg.ts 축소)
 *        · flags/{iso2}.{hash8}.svg · flags/LICENSE · app/content/catalog-assets.json(매니페스트)
 * 출력 폴더에서 매니페스트에 없는 옛 파일은 지운다(이 스크립트가 만든 폴더만). 표본 픽스처로는 `--allow-fixture` 일 때만 돈다
 *   (그렇지 않으면 커밋된 실 자산을 지운다).
 * 원본이 하나라도 없으면 아무것도 쓰지 않고 실패한다.
 */
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import type { AssetManifest } from '../shared/catalog/assets'
import { CATALOG_DIR, CATALOG_FILES } from '../shared/catalog/files'
import { optimizeMapSvg } from '../shared/catalog/map-svg'
import { parseCatalog } from '../shared/catalog/validate'

const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(APP, 'public/catalog')
const MANIFEST = join(APP, 'app/content/catalog-assets.json')
// 끌어올림(hoist) 위치에 기대지 않고 패키지 해석으로 찾는다
const FLAGS = dirname(createRequire(import.meta.url).resolve('flag-icons/package.json'))
const THUMB_PX = 400
const MAP_TOLERANCE = 2
/** 원본 위치가 다른 zone — 2609 생성기 overrides 기준 */
const MAP_OVERRIDES: Record<string, string> = {
  EU022: 'products/southern-eu/assets/maps/iberia-pd.svg',
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : undefined
}

function hash8(buf: Buffer | string): string {
  return createHash('sha256').update(buf).digest('hex').slice(0, 8)
}

function loadCatalog() {
  const file = CATALOG_FILES.map((f) => join(APP, CATALOG_DIR, f)).find((f) => existsSync(f))
  if (!file) throw new Error(`카탈로그가 없다 — ${CATALOG_DIR}/${CATALOG_FILES.join(' 또는 ')}`)
  return { file, catalog: parseCatalog(JSON.parse(readFileSync(file, 'utf8'))) }
}

async function main() {
  const given = arg('design')
  if (!given) throw new Error('--design <2609 design 폴더> 가 필요하다')
  // yarn workspace 는 스크립트를 apps/client 에서 돌린다(INIT_CWD 도 그 폴더) — 상대경로는 리포 루트 기준으로 푼다
  const design = resolve(process.env.PROJECT_CWD ?? resolve(APP, '../..'), given)
  if (!existsSync(design)) throw new Error(`--design 폴더가 없다(${design})`)
  const { file, catalog } = loadCatalog()
  // 표본으로 돌면 커밋된 실 자산(표본 밖 zone)을 옛 파일로 보고 지운다 — 표본은 명시할 때만
  if (catalog.fixture && !process.argv.includes('--allow-fixture'))
    throw new Error(
      '표본 픽스처로는 돌리지 않는다 — server/data/catalog.json(W1-1)을 먼저 두거나 --allow-fixture',
    )
  const upcoming = JSON.parse(
    readFileSync(join(APP, 'app/content/catalog-upcoming.json'), 'utf8'),
  ) as {
    countries: { iso2: string }[]
  }

  const jobs = {
    thumbs: catalog.zones.flatMap((z) =>
      z.products.map((p) => ({
        key: p.sku,
        src: join(design, `thumbnails/out/rep-v1/${p.sku}/${p.sku}_00_rep.png`),
      })),
    ),
    maps: catalog.zones.map((z) => ({
      key: z.zone,
      src: join(design, MAP_OVERRIDES[z.zone] ?? `products/_generator/maps/${z.zone}.svg`),
    })),
    flags: [
      ...new Set([
        ...catalog.zones.flatMap((z) => z.countries.map((c) => c.iso2)),
        ...upcoming.countries.map((c) => c.iso2),
      ]),
    ]
      .sort()
      .map((iso2) => ({ key: iso2, src: join(FLAGS, `flags/1x1/${iso2.toLowerCase()}.svg`) })),
  }
  const missing = Object.values(jobs)
    .flat()
    .filter((j) => !existsSync(j.src))
  if (missing.length)
    throw new Error(
      `원본이 없다 ${missing.length}건:\n${missing.map((j) => `- ${j.src}`).join('\n')}`,
    )

  const manifest: AssetManifest = {
    source: { catalog: file.replace(`${APP}/`, ''), generatedAt: catalog.generatedAt },
    thumbs: {},
    maps: {},
    flags: {},
  }
  const written: Record<'thumbs' | 'maps' | 'flags', Set<string>> = {
    thumbs: new Set(),
    maps: new Set(),
    flags: new Set(),
  }
  for (const dir of ['thumbs', 'maps', 'flags'] as const)
    mkdirSync(join(OUT, dir), { recursive: true })

  for (const j of jobs.thumbs) {
    const buf = await sharp(j.src)
      .resize(THUMB_PX, THUMB_PX, { fit: 'cover' })
      .webp({ quality: 82 })
      .toBuffer()
    const name = `${j.key}.${hash8(buf)}.webp`
    writeFileSync(join(OUT, 'thumbs', name), buf)
    manifest.thumbs[j.key] = `/catalog/thumbs/${name}`
    written.thumbs.add(name)
  }
  for (const j of jobs.maps) {
    const svg = optimizeMapSvg(readFileSync(j.src, 'utf8'), MAP_TOLERANCE)
    const name = `${j.key}.${hash8(svg)}.svg`
    writeFileSync(join(OUT, 'maps', name), svg)
    manifest.maps[j.key] = `/catalog/maps/${name}`
    written.maps.add(name)
  }
  for (const j of jobs.flags) {
    const svg = readFileSync(j.src)
    const name = `${j.key}.${hash8(svg)}.svg`
    writeFileSync(join(OUT, 'flags', name), svg)
    manifest.flags[j.key] = `/catalog/flags/${name}`
    written.flags.add(name)
  }
  copyFileSync(join(FLAGS, 'LICENSE'), join(OUT, 'flags/LICENSE'))
  written.flags.add('LICENSE')

  for (const dir of ['thumbs', 'maps', 'flags'] as const)
    for (const f of readdirSync(join(OUT, dir))) if (!written[dir].has(f)) rmSync(join(OUT, dir, f))

  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(
    `✔ 자산 — 썸네일 ${jobs.thumbs.length} · 지도 ${jobs.maps.length} · 국기 ${jobs.flags.length} (카탈로그 ${manifest.source.catalog})`,
  )
}

main().catch((e) => {
  console.error(`⛔ ${e instanceof Error ? e.message : e}`)
  process.exit(1)
})
