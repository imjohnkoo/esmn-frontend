// spec D-17 · I-9 — 가입 화면이 그리는 필수 동의 글자 = 판 · 해시를 만든 상수(SIGNUP_CONSENT_LINES) 그대로인가.
// 소스가 아니라 템플릿 AST(vue/compiler-sfc)로 본다 — 체크박스 라벨에 글자를 직접 쓰거나 다른 표현식을 넣거나 체크를 더하면 실패한다.
// (글자를 바꾸려면 signup-consent.ts 의 LINES · textVersion · textHash 를 함께 올린다 — signup-consent.test.ts)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

interface TNode {
  type: number
  tag?: string
  props?: {
    type: number
    name: string
    value?: { content: string }
    arg?: { content: string }
    exp?: { content: string }
  }[]
  children?: TNode[]
}

const src = readFileSync(fileURLToPath(new URL('./signup.vue', import.meta.url)), 'utf8')
const { descriptor } = parse(src)

function collect(node: TNode, tag: string, out: TNode[] = []): TNode[] {
  if (node.type === 1 && node.tag === tag) out.push(node)
  for (const c of node.children ?? []) collect(c, tag, out)
  return out
}

describe('가입 동의 화면 글자(D-17)', () => {
  const boxes = collect(descriptor.template!.ast! as unknown as TNode, 'NCheckbox')

  it('필수 체크는 둘 · 라벨은 상수 두 줄을 그대로 바인딩한다(정적 label 0)', () => {
    expect(boxes).toHaveLength(2)
    const labels = boxes.map((b) => {
      const props = b.props ?? []
      expect(props.some((p) => p.type === 6 && p.name === 'label')).toBe(false)
      return props.find((p) => p.type === 7 && p.arg?.content === 'label')?.exp?.content
    })
    expect(labels).toEqual(['SIGNUP_CONSENT_LINES[0]', 'SIGNUP_CONSENT_LINES[1]'])
  })

  it('AC-1.4 — 두 체크는 조건 없이 늘 그려지고(v-if · v-show 0) 각자 다른 상태에 묶이며, 가입 버튼은 둘 다 켜져야 열린다', () => {
    for (const b of boxes) {
      const dirs = (b.props ?? []).filter((p) => p.type === 7).map((p) => p.name)
      expect(dirs).not.toContain('if')
      expect(dirs).not.toContain('show')
    }
    const models = boxes.map(
      (b) => (b.props ?? []).find((p) => p.type === 7 && p.name === 'model')?.exp?.content,
    )
    expect(models).toEqual(['agreeTerms', 'agreeAge'])
    expect(descriptor.scriptSetup!.content).toMatch(
      /const canSignUp = computed\(\(\) => agreeTerms\.value && agreeAge\.value && !busy\.value\)/,
    )
    expect(descriptor.scriptSetup!.content).toMatch(
      /if \(pwErr\.value \|\| !canSignUp\.value\) return/,
    )
  })

  it('라벨 상수와 보내는 판 · 해시는 같은 파일에서 온다 · 가입 요청은 그 상수를 그대로 보낸다', () => {
    const script = descriptor.scriptSetup!.content
    expect(script).toMatch(
      /import \{ SIGNUP_CONSENT, SIGNUP_CONSENT_LINES \} from '#shared\/consent\/signup-consent'/,
    )
    expect(script).toMatch(/consent: SIGNUP_CONSENT,\s*age14: true,/)
  })
})
