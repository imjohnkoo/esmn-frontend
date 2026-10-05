// 설치 가이드 화면 PNG 굽기 (client-guide spec F-3 · D-3).
//
//   PLAYWRIGHT=<playwright/index.mjs> node --experimental-strip-types --no-warnings=ExperimentalWarning \
//     apps/client/scripts/guide-screens/render.mjs [--only <key,key>]
//
// - 매니페스트 = app/content/guide/figures.ts (페이지와 같은 표). 키마다 public/guide-screens/<key>.<버전>.png 하나.
// - 화면 템플릿 = 같은 폴더의 screens.js · ui.css (2609 판 사본), 글꼴 = public/fonts/PretendardVariable.woff2.
//   네트워크를 쓰지 않는다 — 요청은 전부 이 디스크에서 채운다(같은 입력이면 같은 PNG).
// - 강조(빨간 테두리)가 창 밖으로 잘리면 그 키를 찍고 실패한다(spec DoD 3). 파일은 쓰지 않는다.
// - playwright 는 레포 의존성이 아니다 — design 생성기와 같이 PLAYWRIGHT 로 위치를 준다.
// - 지우는 일은 하지 않는다. 매니페스트에 없는 PNG 는 목록만 찍는다(guide.test.ts 가 고아 파일을 막는다).
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CLIENT = resolve(HERE, '../..')
const OUT = join(CLIENT, 'public/guide-screens')
const FONT = join(CLIENT, 'public/fonts/PretendardVariable.woff2')

const { GUIDE_FIGURES, FIGURE_WIDTH, FIGURE_SCALE, figureSize, figureSrc } = await import(
  join(CLIENT, 'app/content/guide/figures.ts')
)
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright')

const onlyArg = process.argv.indexOf('--only')
const only = onlyArg > 0 ? new Set(process.argv[onlyArg + 1].split(',')) : null
const keys = Object.keys(GUIDE_FIGURES).filter((k) => !only || only.has(k))
if (only && keys.length !== only.size) {
  console.error('⛔ 매니페스트에 없는 키:', [...only].filter((k) => !GUIDE_FIGURES[k]).join(', '))
  process.exit(1)
}

const FILES = {
  '/harness.html': ['text/html', join(HERE, 'harness.html')],
  '/ui.css': ['text/css', join(HERE, 'ui.css')],
  '/screens.js': ['text/javascript', join(HERE, 'screens.js')],
  '/fonts/PretendardVariable.woff2': ['font/woff2', FONT],
}

const browser = await chromium.launch()
const page = await browser.newPage({
  viewport: { width: FIGURE_WIDTH + 64, height: 1200 },
  deviceScaleFactor: FIGURE_SCALE,
})
await page.route('**/*', (route) => {
  const { pathname, host } = new URL(route.request().url())
  const file = host === 'guide.local' ? FILES[pathname] : null
  if (!file) return route.abort()
  return route.fulfill({ status: 200, contentType: file[0], body: readFileSync(file[1]) })
})
await page.goto('http://guide.local/harness.html')
await page.evaluate(async () => {
  await Promise.all(
    ['400', '600', '700', '800'].map((w) => document.fonts.load(`${w} 16px Pretendard`)),
  )
  await document.fonts.ready
})
const fontOk = await page.evaluate(() => document.fonts.check('700 16px Pretendard'))
if (!fontOk) {
  console.error('⛔ Pretendard 글꼴을 못 올렸다')
  process.exit(1)
}

mkdirSync(OUT, { recursive: true })
const clipped = []
let written = 0
for (const key of keys) {
  const fig = GUIDE_FIGURES[key]
  const { width, height } = figureSize(key)
  const result = await page.evaluate(
    ({ fig, width, height }) => {
      const stage = document.getElementById('stage')
      stage.replaceChildren()
      const el = document.createElement('figure')
      el.style.margin = '0'
      el.dataset.screen = fig.screen
      if (fig.state) el.dataset.state = fig.state
      if (fig.hl) el.dataset.hl = fig.hl.join(',')
      el.dataset.ar = String(fig.ar)
      el.dataset.focus = String(fig.focus)
      if (fig.zoom) el.dataset.zoom = String(fig.zoom)
      const win = document.createElement('div')
      win.className = 'shot__win'
      win.id = 'win'
      win.style.width = `${width}px`
      win.style.height = `${height}px`
      el.appendChild(win)
      stage.appendChild(el)
      if (!window.IG_renderScreen(el, win)) return { error: `화면 없음: ${fig.screen}` }
      // 강조 테두리(.hl-ring)가 창 안에 다 들어오는지 — 0.5px 까지 허용
      const box = win.getBoundingClientRect()
      const rings = [...win.querySelectorAll('.hl-ring')]
      const want = (fig.hl ?? []).length
      const out = rings
        .map((r) => r.getBoundingClientRect())
        .filter(
          (r) =>
            r.left < box.left - 0.5 ||
            r.top < box.top - 0.5 ||
            r.right > box.right + 0.5 ||
            r.bottom > box.bottom + 0.5,
        ).length
      const found = new Set(
        [...win.querySelectorAll('.is-hl')].map((e) => e.getAttribute('data-k')),
      ).size
      return { out, found, want }
    },
    { fig, width, height },
  )
  if (result.error) {
    console.error(`⛔ ${key}: ${result.error}`)
    process.exit(1)
  }
  if (result.found !== result.want || result.out > 0) {
    clipped.push(`${key} (강조 ${result.found}/${result.want} · 창 밖 ${result.out})`)
    continue
  }
  const png = await page.locator('#win').screenshot({ animations: 'disabled' })
  writeFileSync(join(CLIENT, 'public', figureSrc(key)), png)
  written++
}
await browser.close()

const known = new Set(Object.keys(GUIDE_FIGURES).map((k) => figureSrc(k).split('/').pop()))
const orphans = existsSync(OUT) ? readdirSync(OUT).filter((f) => !known.has(f)) : []
console.log(`PNG ${written}/${keys.length} → ${OUT}`)
if (orphans.length) console.log('매니페스트에 없는 파일(지우지 않음):', orphans.join(', '))
if (clipped.length) {
  console.error('⛔ 강조가 창 밖으로 잘렸거나 없다 — figures.ts 의 focus · zoom 을 고쳐라:\n  ' + clipped.join('\n  '))
  process.exit(1)
}
