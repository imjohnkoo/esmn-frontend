/**
 * Token build script
 * Reads JSON token files → outputs CSS custom properties + JS/TS constants + flat JSON
 *
 * Modes:
 *   (default)     build CSS/JS/JSON artifacts into dist/
 *   --check       lint design-vue token fallbacks against JSON values (no write)
 *   --fix         rewrite drifted fallbacks to match JSON token values
 *
 * All CSS variables carry the `--n-` prefix. The prefix exists so the token layer
 * never collides with Tailwind v4's `@theme` namespace (`--color-*`, `--spacing-*`,
 * `--radius-*`, `--font-*`, `--shadow-*`, `--breakpoint-*` are all Tailwind-owned).
 * A consuming app bridges them by *reference*, never by copying values:
 *
 *   @theme { --color-primary-500: var(--n-color-primary-500); }
 */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
  statSync,
} from 'fs'
import { resolve, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const SRC = dirname(fileURLToPath(import.meta.url))
const DIST = resolve(SRC, '..', 'dist')
const DESIGN_VUE_SRC = resolve(SRC, '../../design-vue/src')
const REPO_ROOT = resolve(SRC, '../../..')

/** CSS variable prefix. Every emitted custom property is `--n-<name>`. */
const PREFIX = '--n-'

// --- Types ---

/** One layer of a box-shadow. Kept as a structured object so React Native
 *  (`@imjohnkoo/design-mobile`) can map it to shadowOffset/shadowRadius/shadowColor.
 *  CSS composes the layers into a single comma-separated value. */
interface ShadowLayer {
  x: string
  y: string
  blur: string
  spread: string
  color: string
}

/** Numeric motion tokens (`motion.json`). Numbers so React Native
 *  (`@imjohnkoo/design-mobile`) reads them as-is — `withTiming({ duration })`,
 *  `Easing.bezier(...easing)`, `withSpring(spring)`. CSS gets composed strings. */
interface Motion {
  duration: Record<string, number>
  easing: Record<string, [number, number, number, number]>
  /** App only (Reanimated `withSpring`) — never emitted as CSS. */
  spring: Record<string, { duration: number; dampingRatio: number }>
  stagger: Record<string, number>
}

// --- Helpers ---

function loadJson<T = Record<string, unknown>>(filename: string): T {
  return JSON.parse(readFileSync(resolve(SRC, filename), 'utf-8')) as T
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

/**
 * Flatten nested JSON into token entries.
 * e.g. { primary: { 500: "#6239FF" } } → [["color-primary-500", "#6239FF"]]
 */
function flattenTokens(
  obj: Record<string, unknown>,
  prefix: string,
  entries: [string, string][] = [],
): [string, string][] {
  for (const [key, value] of Object.entries(obj)) {
    const name = prefix ? `${prefix}-${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      flattenTokens(value as Record<string, unknown>, name, entries)
    } else {
      entries.push([name, String(value)])
    }
  }
  return entries
}

/** Convert kebab-case token name to camelCase JS identifier. */
function toCamelCase(str: string): string {
  return str.replace(/[-.](\w)/g, (_, c: string) => c.toUpperCase())
}

/** Compose shadow layers into a single CSS box-shadow value. */
function composeShadow(layers: ShadowLayer[]): string {
  if (layers.length === 0) return 'none'
  return layers.map((l) => `${l.x} ${l.y} ${l.blur} ${l.spread} ${l.color}`).join(', ')
}

/** camelCase JSON key → kebab-case CSS name (`inOut` → `in-out`). */
const keysOf = (o: object) =>
  Object.keys(o)
    .map((k) => JSON.stringify(k))
    .join(' | ')

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/**
 * Compose motion tokens into CSS entries. Kept out of `flattenTokens`, which would
 * stringify the bezier arrays (`0.23,1,0.32,1`) and leak spring objects into CSS.
 * The old `transition.*` strings in base.json stay as-is — new code uses these.
 */
function composeMotion(m: Motion): [string, string][] {
  return [
    ...Object.entries(m.duration).map(([k, v]) => [`motion-duration-${kebab(k)}`, `${v}ms`]),
    ...Object.entries(m.easing).map(([k, v]) => [
      `motion-easing-${kebab(k)}`,
      `cubic-bezier(${v.join(', ')})`,
    ]),
    ...Object.entries(m.stagger).map(([k, v]) => [`motion-stagger-${kebab(k)}`, `${v}ms`]),
  ] as [string, string][]
}

/** Aggregate every token across source JSON files into a `--n-NAME → value` map. */
function loadAllTokens(): Map<string, string> {
  const tokens = new Map<string, string>()

  const sources: Array<{ file: string; prefix: string }> = [
    { file: 'colors.json', prefix: 'color' },
    { file: 'typography.json', prefix: 'font' },
    { file: 'spacing.json', prefix: 'spacing' },
    { file: 'breakpoints.json', prefix: 'breakpoint' },
    { file: 'base.json', prefix: '' },
    // Component tokens carry their own namespace (btn, table, sidebar, …)
    { file: 'components.json', prefix: '' },
  ]
  for (const { file, prefix } of sources) {
    for (const [name, value] of flattenTokens(loadJson(file), prefix)) {
      tokens.set(`${PREFIX}${name}`, value)
    }
  }

  // Shadows are layer arrays → composed separately.
  const shadows = loadJson<Record<string, ShadowLayer[]>>('shadows.json')
  for (const [name, layers] of Object.entries(shadows)) {
    tokens.set(`${PREFIX}shadow-${name}`, composeShadow(layers))
  }

  for (const [name, value] of composeMotion(loadJson<Motion>('motion.json'))) {
    tokens.set(`${PREFIX}${name}`, value)
  }

  return tokens
}

// --- Lint ---

/** Recursively collect files with the given extensions under `root`. */
function walk(root: string, exts: string[], out: string[] = []): string[] {
  if (!existsSync(root)) return out
  for (const entry of readdirSync(root)) {
    const p = resolve(root, entry)
    if (statSync(p).isDirectory()) walk(p, exts, out)
    else if (exts.some((e) => p.endsWith(e))) out.push(p)
  }
  return out
}

/** Compute 1-based line number from a character offset. */
function lineOf(text: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < text.length; i++) {
    if (text.charCodeAt(i) === 10) line++
  }
  return line
}

/**
 * Normalize a CSS value for equality comparison:
 *   - trim, lowercase (hex colors, `rgba()`), collapse whitespace runs
 * Does NOT attempt unit conversion (rem ≠ px) — that would mask real drift.
 */
function normalizeValue(v: string): string {
  return v.trim().toLowerCase().replace(/\s+/g, ' ')
}

interface DriftError {
  file: string
  line: number
  name: string
  expected: string
  actual: string
}

interface VarCall {
  /** Start index of the full `var(...)` expression */
  start: number
  /** End index (exclusive) — just past the closing `)` */
  end: number
  name: string
  fallback: string | null
}

/**
 * Paren-balanced scan for `var(--n-NAME[, FALLBACK])`. Handles nested parens
 * inside fallbacks (`rgba(...)`, `calc(...)`, nested `var(...)`). Returns one
 * entry per top-level call; nested `var()` inside a fallback is not returned
 * separately.
 */
function scanVarCalls(text: string): VarCall[] {
  const results: VarCall[] = []
  const head = new RegExp(`var\\(\\s*(${PREFIX}[a-z0-9-]+)\\s*`, 'g')
  for (const match of text.matchAll(head)) {
    const name = match[1]
    const afterName = (match.index ?? 0) + match[0].length
    const nextChar = text[afterName]
    let fallback: string | null = null
    let end: number
    if (nextChar === ')') {
      end = afterName + 1
    } else if (nextChar === ',') {
      // Scan for the balanced closing paren, starting after the comma.
      let depth = 1
      let i = afterName + 1
      while (i < text.length && depth > 0) {
        const c = text[i]
        if (c === '(') depth++
        else if (c === ')') {
          depth--
          if (depth === 0) break
        }
        i++
      }
      if (depth !== 0) continue // unterminated — skip
      fallback = text.slice(afterName + 1, i).trim()
      end = i + 1
    } else {
      continue // malformed var() — skip
    }
    results.push({ start: match.index ?? 0, end, name, fallback })
  }
  return results
}

/** Files the linter inspects. nomacom keeps component CSS inside SFC
 *  `<style scoped>` blocks, so `.vue` is scanned alongside plain `.css`. */
function lintTargets(): string[] {
  return walk(DESIGN_VUE_SRC, ['.css', '.vue'])
}

function lintFallbacks(): DriftError[] {
  const tokens = loadAllTokens()
  const errors: DriftError[] = []
  for (const file of lintTargets()) {
    const text = readFileSync(file, 'utf-8')
    for (const call of scanVarCalls(text)) {
      if (!tokens.has(call.name)) continue // component-local var, not a token
      if (call.fallback === null) continue // no fallback — fail-loud mode, OK
      if (call.fallback.includes('var(')) continue // token-to-token chain, OK
      const expected = tokens.get(call.name)!
      if (normalizeValue(expected) === normalizeValue(call.fallback)) continue
      errors.push({
        file,
        line: lineOf(text, call.start),
        name: call.name,
        expected: expected.trim(),
        actual: call.fallback,
      })
    }
  }
  return errors
}

function runCheck() {
  const errors = lintFallbacks()
  if (errors.length === 0) {
    console.log('✅ No token fallback drift')
    return
  }
  console.error(`\n❌ ${errors.length} token fallback drift(s):\n`)
  for (const e of errors) {
    console.error(`  ${relative(REPO_ROOT, e.file)}:${e.line}`)
    console.error(`    ${e.name}`)
    console.error(`    expected "${e.expected}"`)
    console.error(`    got      "${e.actual}"`)
  }
  console.error(
    '\nFix: run `yarn workspace @imjohnkoo/design-tokens fix` to auto-update fallbacks\n' +
      '     to JSON values, or update the JSON source if the CSS value is intended.',
  )
  process.exit(1)
}

/**
 * Rewrite each `var(--n-NAME, WRONG)` → `var(--n-NAME, RIGHT)` in place.
 * Only patches fallback literals that drift from the JSON value. Leaves
 * comments, nested-var fallbacks, and non-token local vars untouched.
 */
function runFix() {
  const tokens = loadAllTokens()
  let fixedFiles = 0
  let fixedOccurrences = 0

  for (const file of lintTargets()) {
    const original = readFileSync(file, 'utf-8')
    const calls = scanVarCalls(original)
    let patched = original
    let localFixes = 0
    // Rewrite from the end backwards so earlier offsets stay valid.
    for (let i = calls.length - 1; i >= 0; i--) {
      const call = calls[i]
      if (!tokens.has(call.name)) continue
      if (call.fallback === null) continue
      if (call.fallback.includes('var(')) continue
      const expected = tokens.get(call.name)!
      if (normalizeValue(expected) === normalizeValue(call.fallback)) continue
      patched =
        patched.slice(0, call.start) + `var(${call.name}, ${expected})` + patched.slice(call.end)
      localFixes++
    }
    if (localFixes > 0) {
      writeFileSync(file, patched)
      fixedFiles++
      fixedOccurrences += localFixes
      console.log(`  ✅ ${relative(REPO_ROOT, file)}  (${localFixes})`)
    }
  }

  if (fixedOccurrences === 0) {
    console.log('✨ Nothing to fix — all fallbacks match JSON tokens.')
    return
  }
  console.log(`\n🔧 Patched ${fixedOccurrences} fallback(s) across ${fixedFiles} file(s).`)
  console.log('   Review the diff and re-run `--check` to confirm.')
}

// --- Build ---

function build() {
  console.log('🎨 Building design tokens...')

  const cssDir = resolve(DIST, 'css')
  const jsDir = resolve(DIST, 'js')
  const jsonDir = resolve(DIST, 'json')
  ensureDir(cssDir)
  ensureDir(jsDir)
  ensureDir(jsonDir)

  const colors = loadJson('colors.json')
  const typography = loadJson('typography.json')
  const spacing = loadJson('spacing.json')
  const breakpoints = loadJson('breakpoints.json')
  const base = loadJson('base.json')
  const components = loadJson('components.json')
  const shadows = loadJson<Record<string, ShadowLayer[]>>('shadows.json')
  const motion = loadJson<Motion>('motion.json')
  const motionTokens = composeMotion(motion)

  const allTokens: [string, string][] = [
    ...flattenTokens(colors, 'color'),
    ...flattenTokens(typography, 'font'),
    ...flattenTokens(spacing, 'spacing'),
    ...flattenTokens(breakpoints, 'breakpoint'),
    ...flattenTokens(base, ''),
    ...Object.entries(shadows).map(
      ([name, layers]) => [`shadow-${name}`, composeShadow(layers)] as [string, string],
    ),
    // Component tokens last so they can reference the scales declared above.
    ...flattenTokens(components, ''),
  ]

  // --- CSS ---
  const cssLines = [
    '/* Auto-generated by @imjohnkoo/design-tokens — DO NOT EDIT */',
    '/* Source: packages/design-tokens/src/*.json */',
    '',
    ':root {',
    ...allTokens.map(([name, value]) => `  ${PREFIX}${name}: ${value};`),
    '  /* Motion — new code uses these; the old --n-transition-* strings stay for existing CSS */',
    ...motionTokens.map(([name, value]) => `  ${PREFIX}${name}: ${value};`),
    '}',
    '',
  ]
  writeFileSync(resolve(cssDir, 'tokens.css'), cssLines.join('\n'))
  console.log(
    `  ✅ dist/css/tokens.css (${allTokens.length + motionTokens.length} variables)`,
  )

  // --- JS (ESM + CJS) ---
  const jsLines = [
    '/* Auto-generated by @imjohnkoo/design-tokens — DO NOT EDIT */',
    '',
    ...allTokens.map(([name, value]) => `export const ${toCamelCase(name)} = ${JSON.stringify(value)}`),
    // Motion stays numeric in JS (ms numbers · bezier tuples · springs) — not CSS strings.
    `export const motion = ${JSON.stringify(motion)}`,
    '',
  ]
  const js = jsLines.join('\n')
  writeFileSync(resolve(jsDir, 'index.js'), js)
  writeFileSync(resolve(jsDir, 'index.mjs'), js)
  writeFileSync(resolve(jsDir, 'index.cjs'), js.replace(/^export const /gm, 'module.exports.'))

  const dtsLines = [
    '/* Auto-generated by @imjohnkoo/design-tokens — DO NOT EDIT */',
    '',
    ...allTokens.map(([name]) => `export declare const ${toCamelCase(name)}: string`),
    `export declare const motion: {`,
    `  readonly duration: Readonly<Record<${keysOf(motion.duration)}, number>>`,
    `  readonly easing: Readonly<Record<${keysOf(motion.easing)}, readonly [number, number, number, number]>>`,
    `  readonly spring: Readonly<Record<${keysOf(motion.spring)}, { readonly duration: number; readonly dampingRatio: number }>>`,
    `  readonly stagger: Readonly<Record<${keysOf(motion.stagger)}, number>>`,
    `}`,
    '',
  ]
  writeFileSync(resolve(jsDir, 'index.d.ts'), dtsLines.join('\n'))
  console.log(`  ✅ dist/js/index.{js,mjs,cjs,d.ts} (${allTokens.length} exports)`)

  // --- Structured JSON (consumed by @imjohnkoo/design-mobile) ---
  writeFileSync(
    resolve(jsonDir, 'tokens.json'),
    JSON.stringify(
      { colors, typography, spacing, shadows, breakpoints, ...base, components, motion },
      null,
      2,
    ) + '\n',
  )
  console.log('  ✅ dist/json/tokens.json')

  console.log('🎨 Token build complete!')
}

// --- Entry ---

if (process.argv.includes('--check')) {
  runCheck()
} else if (process.argv.includes('--fix')) {
  runFix()
} else {
  build()
}
