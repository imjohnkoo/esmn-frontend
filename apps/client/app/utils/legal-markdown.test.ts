import { describe, expect, it } from 'vitest'
import { P9_4_PENDING } from '../content/pending'
import {
  blocksText,
  inlineText,
  parseInline,
  parseLegalMarkdown,
  type LegalBlock,
} from './legal-markdown'

type List = Extract<LegalBlock, { t: 'list' }>
type Table = Extract<LegalBlock, { t: 'table' }>

describe('parseInline — 굵게 · 링크 · 자리표시자만', () => {
  it('굵게 · https 링크 · 사이트 경로 링크 · 자리표시자', () => {
    expect(parseInline(`가 **나** [다](https://a.kr/x) [라](/terms) ${P9_4_PENDING} 끝`)).toEqual([
      { t: 'text', text: '가 ' },
      { t: 'b', children: [{ t: 'text', text: '나' }] },
      { t: 'text', text: ' ' },
      { t: 'a', href: 'https://a.kr/x', children: [{ t: 'text', text: '다' }] },
      { t: 'text', text: ' ' },
      { t: 'a', href: '/terms', children: [{ t: 'text', text: '라' }] },
      { t: 'text', text: ' ' },
      { t: 'pending', token: P9_4_PENDING },
      { t: 'text', text: ' 끝' },
    ])
  })

  it('굵게 · 링크 안의 자리표시자도 가른다 — 화면에 원래 토큰이 새지 않는다', () => {
    const xs = parseInline(`**AWS ${P9_4_PENDING} 법인** [회사 ${P9_4_PENDING}](/refund)`)
    expect(inlineText(xs)).toBe('AWS (확정 전) 법인 회사 (확정 전)')
    expect(JSON.stringify(xs)).not.toContain('"text":"P9_4_PENDING')
  })

  it.each([
    'javascript:alert(1)',
    '//evil.example',
    '/\\evil.example/a',
    'http://a.kr',
    'data:text/html,x',
  ])('안전하지 않은 링크 %s 는 글자 그대로', (href) => {
    const out = parseInline(`[x](${href})`)
    expect(out.some((x) => x.t === 'a')).toBe(false)
    expect(inlineText(out)).toBe(`[x](${href})`)
  })

  it('HTML 은 해석하지 않는다 — 글자로 남는다', () => {
    expect(parseInline('<b>x</b><script>y</script>')).toEqual([
      { t: 'text', text: '<b>x</b><script>y</script>' },
    ])
  })
})

describe('parseLegalMarkdown — 약관 · 방침의 모양', () => {
  const md = [
    '## 제1장 총칙',
    '',
    '**제1조 (목적)**',
    '이 약관은 목적을 정합니다.',
    '',
    '**제2조 (정의)**',
    '1. 첫째 항입니다.',
    '2. 둘째 항 **굵게** 입니다.',
    '   - 하위 하나',
    '   - 하위 둘',
    '3. 셋째 항',
    '',
    '| 구분 | 목적 |',
    '| --- | --- |',
    '| 발급 | 본인 확인 |',
    `| ${P9_4_PENDING} | 발송 |`,
    '',
    '- 글머리 하나',
    '- 글머리 둘',
  ].join('\n')
  const blocks = parseLegalMarkdown(md)

  it('장 = h2 · 한 줄 전체 굵게 = 조 제목(h3) · 문단 · 번호 항 · 하위 글머리 · 표 · 글머리', () => {
    expect(blocks.map((b) => b.t)).toEqual(['h2', 'h3', 'p', 'h3', 'list', 'table', 'list'])
    const ol = blocks[4] as List
    expect([ol.ordered, ol.start, ol.items.length]).toEqual([true, 1, 3])
    expect(inlineText(ol.items[1]!.text)).toBe('둘째 항 굵게 입니다.')
    const sub = ol.items[1]!.children[0] as List
    expect(sub.ordered).toBe(false)
    expect(sub.items.map((x) => inlineText(x.text))).toEqual(['하위 하나', '하위 둘'])
    const table = blocks[5] as Table
    expect([table.head.length, table.rows.length]).toEqual([2, 2])
    expect(table.rows[1]![0]).toEqual([{ t: 'pending', token: P9_4_PENDING }])
  })

  it('번호 항이 2부터 시작하면 그 번호로', () => {
    expect((parseLegalMarkdown('2. 둘\n3. 셋')[0] as List).start).toBe(2)
  })

  it.each(['\u2028', '\u2029', '\r'])(
    '제목 줄 끝의 %j 같은 줄 구분 문자도 줄 끝 — 제목 · 문단 · 조 제목으로 갈린다(무한 반복 없음)',
    (sep) => {
      const blocks = parseLegalMarkdown(`## 제1장${sep}본문 한 줄\n\n**제1조**${sep}둘`)
      expect(blocks.map((b) => [b.t, blocksText([b])])).toEqual([
        ['h2', '제1장'],
        ['p', '본문 한 줄'],
        ['h3', '제1조'],
        ['p', '둘'],
      ])
    },
  )

  it.each([
    [`AWS${P9_4_PENDING}`, 'AWS', ''],
    [`${P9_4_PENDING}A`, '', 'A'],
    [`${P9_4_PENDING}_1`, '', '_1'],
  ])('자리표시자에 영대문자 · 숫자 · 밑줄이 붙어도(%s) 자리표시자로 가른다 — 상수 이름이 화면에 새지 않는다', (src, before, after) => {
    expect(parseInline(src)).toEqual([
      ...(before ? [{ t: 'text', text: before }] : []),
      { t: 'pending', token: P9_4_PENDING },
      ...(after ? [{ t: 'text', text: after }] : []),
    ])
  })

  it('표 구분행은 둘째 줄 하나(`-` 1개 이상 · `:` 허용) — 다른 줄의 `---` 칸은 본문으로 남는다', () => {
    const [a] = parseLegalMarkdown('| a | b |\n|:-:|-|\n| --- | x |\n| 1 | 2 |') as Table[]
    expect(a!.head.map(inlineText)).toEqual(['a', 'b'])
    expect(a!.rows.map((r) => r.map(inlineText))).toEqual([
      ['---', 'x'],
      ['1', '2'],
    ])
    const [b] = parseLegalMarkdown('| a | b |\n| - | - |\n| 1 | 2 |') as Table[]
    expect(b!.rows).toHaveLength(1)
  })

  it('보이는 글자 — 자리표시자는 «(확정 전)», 꾸밈 기호는 없다', () => {
    const text = blocksText(blocks)
    expect(text).toContain('제1조 (목적)')
    expect(text).toContain('(확정 전) | 발송')
    expect(text).not.toContain('**')
  })
})

describe('parseLegalMarkdown — 목록 · 문단 경계', () => {
  it('목록 항목의 이어지는 줄은 모아서 한 번에 — 줄을 넘는 **굵게** 가 기호로 남지 않는다', () => {
    const [l] = parseLegalMarkdown('1. **가 나\n   다** 끝\n   - **하위\n     둘** 끝') as List[]
    expect(l!.items[0]!.text).toEqual([
      { t: 'b', children: [{ t: 'text', text: '가 나 다' }] },
      { t: 'text', text: ' 끝' },
    ])
    const sub = l!.items[0]!.children[0] as List
    expect(sub.items[0]!.text).toEqual([
      { t: 'b', children: [{ t: 'text', text: '하위 둘' }] },
      { t: 'text', text: ' 끝' },
    ])
  })

  it('첫 항목보다 얕게 들여쓴 항목은 새 목록 — 앞 항목 글자에 삼켜지지 않는다', () => {
    const blocks = parseLegalMarkdown('1. 가\n\n   - 나\n2. 다') as List[]
    expect(blocks.map((b) => [b.ordered, b.start, b.items.map((i) => inlineText(i.text))])).toEqual([
      [true, 1, ['가']],
      [false, 1, ['나']],
      [true, 2, ['다']],
    ])
  })

  it.each([
    ['한 줄 굵게', '문단\n**제1조 (목적)**', 'h3'],
    ['제목', '문단\n## 제1장', 'h2'],
    ['### 제목', '문단\n### 소제목', 'h3'],
    ['표', '문단\n| a | b |\n| - | - |', 'table'],
    ['* 글머리', '문단\n* 항목', 'list'],
  ])('문단은 빈 줄 없이 오는 %s 앞에서 끝난다', (_, md, t) => {
    expect(parseLegalMarkdown(md).map((b) => b.t)).toEqual(['p', t])
  })

  it('굵게 안의 링크 · 링크 안의 굵게(1단)', () => {
    expect(parseInline('**[약관](/terms)** · [**방침**](/privacy)')).toEqual([
      { t: 'b', children: [{ t: 'a', href: '/terms', children: [{ t: 'text', text: '약관' }] }] },
      { t: 'text', text: ' · ' },
      { t: 'a', href: '/privacy', children: [{ t: 'b', children: [{ t: 'text', text: '방침' }] }] },
    ])
  })
})
