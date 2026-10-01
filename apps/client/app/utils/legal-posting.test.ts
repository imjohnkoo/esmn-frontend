import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  BLOCK_RULES,
  DOC_RULES,
  PENDING_MARK,
  blockModuleSource,
  docSource,
  forbiddenIn,
  moduleSource,
  sha256,
  toBlock,
  toPosting,
  unsupportedIn,
} from '../../scripts/legal-posting'

/** client-shell spec F-12 · D-25 · D-29 · D-36 — 정본 → 게시 변환 규칙(legal-pages 08 D절). 태그는 전부 이 테스트가 지어낸 것 */
const none = { notes: [], placeholders: [] }
const NOTE = '`[검토: 예시 메모]`'
const SLOT = '`[확인: 예시 명칭]`'
const rules = { notes: [sha256(NOTE)], placeholders: [sha256(SLOT)] }

describe('toPosting — 걷어 낼 것', () => {
  it('제목의 «— 초안 vX» · frontmatter · 인용 블록(이어지는 줄까지) · 결정 기록(제목 수준 무관) · 구분선', () => {
    const src = [
      '---',
      'type: draft',
      'note: 원가 1,234원',
      '---',
      '# 이용약관 — 초안 v0.2.4',
      '> 상태: 내부 메모',
      '이어지는 인용 줄(앞에 > 없음)',
      '',
      '## 제1장',
      '본문',
      '---',
      '### 결정 기록 — 내부',
      '원가 1,234원',
      '#### 하위 메모',
      '더 내부',
      '## 제2장',
      '본문 둘',
    ].join('\n')
    const { title, body } = toPosting(src, none)
    expect(title).toBe('이용약관')
    expect(body).toBe('## 제1장\n본문\n## 제2장\n본문 둘\n')
    expect(body).not.toMatch(/원가|내부|인용|type:/)
  })

  it('인용 블록 바로 뒤(빈 줄 없이)의 제목 · 목록 · 표 · 한 줄 굵게는 새 블록 — 빠지지 않는다', () => {
    const src =
      '# 문서\n> 메모\n**제13조 (보상)**\n> 메모\n1. 항\n> 메모\n| a | b |\n| - | - |\n| 1 | 2 |\n> 메모\n## 제2장'
    expect(toPosting(src, none).body).toBe(
      '**제13조 (보상)**\n1. 항\n| a | b |\n| - | - |\n| 1 | 2 |\n## 제2장\n',
    )
  })

  it('인용 블록은 빈 줄에서 끝난다 — 그 뒤 문단(서문)은 남는다', () => {
    expect(toPosting('# 문서\n> 메모\n이어지는 메모\n\n서문 문장\n\n## 1. 장', none).body).toBe(
      '서문 문장\n\n## 1. 장\n',
    )
  })

  it('들여쓴 인용(목록 항 아래 메모)도 걷는다', () => {
    expect(toPosting('# 문서\n1. 항\n   > 내부 메모: 원가 1,234원\n2. 둘', none).body).toBe(
      '1. 항\n2. 둘\n',
    )
  })

  it.each([
    ['번호 붙은 제목', '## 8. 결정 기록\n원가 1,234원\n## 9. 다음\n본문', '## 9. 다음\n본문\n'],
    ['띄어쓰기 없는 제목', '## 결정기록\n원가\n## 다음\n본문', '## 다음\n본문\n'],
    ['한 줄 굵게', '**결정 기록**\n원가\n**제2조 (정의)**\n본문', '**제2조 (정의)**\n본문\n'],
    ['같은 수준 제목에서 끝난다', '### 결정 기록\n원가\n### 다음\n본문', '### 다음\n본문\n'],
    [
      '안의 굵은 줄 · 낮은 제목도 함께 걷는다',
      '### 결정 기록\n**(a) 안**\n원가 3,000원\n#### 하위\n내부\n## 제2장\n본문',
      '## 제2장\n본문\n',
    ],
    ['괄호 머리', '## (내부) 결정 기록\n원가\n## 다음\n본문', '## 다음\n본문\n'],
    ['부록 머리', '## 부록 — 결정 기록\n원가\n## 다음\n본문', '## 다음\n본문\n'],
    ['부록 콜론 · 붙여 씀', '## 부록: 결정기록\n원가\n## 다음\n본문', '## 다음\n본문\n'],
    ['번호 + 부록', '## 7. 부록 — 결정 기록\n원가\n## 8. 다음\n본문', '## 8. 다음\n본문\n'],
    ['부록 A', '## 부록 A — 결정 기록\n원가\n## 다음\n본문', '## 다음\n본문\n'],
    ['내부', '## 내부 결정 기록\n원가\n## 다음\n본문', '## 다음\n본문\n'],
    ['부록 A.', '## 부록 A. 결정 기록\n원가\n## 다음\n본문', '## 다음\n본문\n'],
    ['부록 1)', '## 부록 1) 결정 기록\n원가\n## 다음\n본문', '## 다음\n본문\n'],
    ['의사결정 기록', '## 의사결정 기록\n원가\n## 다음\n본문', '## 다음\n본문\n'],
    ['결정 로그', '## 결정 로그\n원가\n## 다음\n본문', '## 다음\n본문\n'],
    ['참고 —', '## 참고 — 결정 기록\n원가\n## 다음\n본문', '## 다음\n본문\n'],
  ])('«결정 기록» 절 — %s', (_, body, out) => {
    expect(toPosting(`# 문서\n${body}`, none).body).toBe(out)
  })

  it.each([
    '## 제5장 결정 기록의 보관\n본문',
    '## 5. 결정 기록의 보관\n본문',
    '## 결정 기록과 근거\n원가',
    '## 결정기록표\n원가',
    '## 결정 기록들\n원가',
    '## 7. 결정 기록과 검토 메모\n원가',
    '**결정 기록과 근거**\n원가',
    '## 의사 결정 기록\n원가',
    '## 내부 의사결정 기록\n원가',
    '## 부록 A-1 — 결정 기록\n원가',
    '• 결정 기록: 원가',
    '※ 결정 기록 — 원가',
    '(결정 기록) 원가',
    '«결정 기록» 원가',
    '· 결정 기록',
    '① 결정 기록',
    '■ 결정 기록',
    '▶ 결정 기록',
    '○ 결정 기록',
    '「결정 기록」',
    '"결정 기록"',
    '— 결정 기록',
    '【결정 기록】',
    '가. 결정 기록',
    'A. 결정 기록',
    '부록 — 결정 기록',
    '내부 결정 기록:',
    '제3절 결정 기록',
    '**결정 기록** (내부)\n원가',
    '**결정 기록** — 게시 제외\n원가',
    '- **결정 기록**\n원가',
    '1. 결정 기록\n원가',
    '결정 기록:\n원가',
    '| 결정 기록 | 값 |\n| - | - |\n| a | b |',
    '## **결정** 기록\n원가',
    '## 결정·기록\n원가',
    '## 결정-기록\n원가',
  ])('«결정 기록» 이 든 제목인데 걷는 절로 판정되지 않으면 멈춘다(사람이 정한다) — %s', (body) => {
    expect(() => toPosting(`# 문서\n${body}`, none)).toThrow(/걷을지 남길지/)
  })

  it('인용 블록 안의 «결정 기록» 줄은 인용째 걷힌다 — 멈추지 않는다', () => {
    expect(toPosting('# 문서\n> 결정 기록: 내부\n> **결정 기록** 메모\n\n본문', none).body).toBe('본문\n')
  })

  it('맨 대괄호로 쓴 메모 · 값 자리도 해시로(백틱 없는 글자의 sha256)', () => {
    const bare = { notes: [sha256('[검토: 맨 메모]')], placeholders: [sha256('[확인: 맨 값]')] }
    expect(toPosting('# 문서\n문장. [검토: 맨 메모]\n이름 [확인: 맨 값] 끝', bare).body).toBe(
      `문장.\n이름 ${PENDING_MARK} 끝\n`,
    )
  })

  it('제목에 태그 · 백틱이 남으면 throw', () => {
    expect(() => toPosting('# 이용약관 [확인: 시행일] — 초안 v0.3\n본문', none)).toThrow(/제목에 태그/)
  })

  it('BOM 이 있어도 frontmatter 를 걷는다', () => {
    expect(toPosting('﻿---\nkey: v\n---\n# 문서\n본문', none).body).toBe('본문\n')
  })

  it('알려진 검토 메모(해시)는 지우고 · 값 자리(해시)는 그 글자만 확정 전 표시로(앞의 이름은 남는다) · 코드 백틱은 글자만', () => {
    const src = `# 문서\n- 문장이다. ${NOTE}\n| (주)회사 ${SLOT} | 업무 |\n- \`app.esimmany.com\``
    const out = toPosting(src, rules)
    expect(out.body).toBe(`- 문장이다.\n| (주)회사 ${PENDING_MARK} | 업무 |\n- app.esimmany.com\n`)
    expect(out.pendingCount).toBe(1)
  })

  it.each([
    ['처음 보는 백틱 태그', '# 문서\n| 책임자 | `[확인: 성명]` |'],
    ['처음 보는 맨 대괄호 태그', '# 문서\n문장 [변호사: 질문]'],
    ['두 줄에 걸친 태그', '# 문서\n문장 [검토: 앞부분\n뒷부분]'],
    ['주소가 아닌 괄호가 붙은 태그', '# 문서\n문장 [확인: 값](설명)'],
    ['http 링크', '# 문서\n[조회](http://example.com)'],
    ['다른 호스트로 풀리는 // 링크', '# 문서\n[조회](//evil.example)'],
  ])('%s 는 throw(그 태그의 sha256 을 알려 준다) — 빈칸 · 내부 글자로 게시되지 않게', (_, src) => {
    expect(() => toPosting(src, none)).toThrow(
      /처음 보는 태그.*맨 글자 [0-9a-f]{64} · 백틱 포함 [0-9a-f]{64}/,
    )
  })

  it.each([
    ['제목 없음', '본문만', /문서 제목/],
    ['닫히지 않은 frontmatter', '---\na: b\n# 문서', /frontmatter/],
    ['값 자리가 인용 블록 안에만', `# 문서\n> 메모 ${SLOT}\n\n본문 ${NOTE}`, /게시 본문에 없다/],
    ['값 자리 바로 옆에 영문', `# 문서\nAWS${SLOT} ${NOTE}`, /옆에 영문/],
    ['값 자리 바로 뒤에 숫자', `# 문서\n${SLOT}1 ${NOTE}`, /옆에 영문/],
    ['지원하지 않는 문법', '# 문서\n#### 깊은 제목', /지원하지 않는 문법/],
  ])('%s 은 throw', (_, src, re) => {
    expect(() => toPosting(src, rules.notes.length && src.includes(SLOT) ? rules : none)).toThrow(
      re,
    )
  })

  it('정본이 바뀌어 알려진 메모 · 값 자리를 못 찾으면 throw(글자 대신 해시 앞자리만 알린다)', () => {
    expect(() => toPosting('# 문서\n본문', rules)).toThrow(
      new RegExp(`찾지 못했다.*sha256 ${sha256(NOTE).slice(0, 12)}`),
    )
  })

  it('링크 [글자](https 또는 /경로) 는 태그가 아니다', () => {
    expect(
      toPosting('# 문서\n[사업자정보확인](https://www.ftc.go.kr/x) · [약관](/terms)', none).body,
    ).toBe('[사업자정보확인](https://www.ftc.go.kr/x) · [약관](/terms)\n')
  })
})

describe('docSource — 절 하나만 떼어 «# 제목» 을 붙인다(04 2절 → /business)', () => {
  const src = '# 문서\r\n## 1. 첫\n하나\n## 2. 둘\n본문\n```\n## 코드 안\n```\n끝\n## 2.5 다음\n남\n## 3. 셋\n'
  it('그 절의 줄만 · 제목은 규칙의 것 · 코드 블록 안 «## » 는 끝이 아니다 · «## 2.5» 는 다른 절(거기서 끝난다)', () => {
    expect(docSource(src, { section: '## 2.', title: '둘째' })).toBe('# 둘째\n본문\n```\n## 코드 안\n```\n끝')
    expect(docSource(src, { section: '## 2.5', title: '다음' })).toBe('# 다음\n남')
    expect(docSource(src, { section: '## 3.', title: '셋째' })).toBe('# 셋째\n')
  })
  it('section 이 없으면 원문 그대로', () => {
    expect(docSource(src, {})).toBe(src)
  })
  it('절이 없거나 머리가 둘이거나 제목이 없으면 멈춘다', () => {
    expect(() => docSource(src, { section: '## 9.', title: 'x' })).toThrow(/절 머리가 0개/)
    expect(() => docSource('## 2. 가\n## 2. 나\n', { section: '## 2.', title: 'x' })).toThrow(/절 머리가 2개/)
    expect(() => docSource(src, { section: '## 2.' })).toThrow(/제목/)
  })
})

describe('unsupportedIn — 렌더러가 조용히 깨뜨리는 문법은 가져오기에서 실패', () => {
  it.each([
    ['#### 제목', '# 한 단계'],
    ['줄 머리 «2026.»', '2026. 9. 1. 시행'],
    ['같은 들여쓰기에 번호 · 글머리 섞임', '1. 하나\n- 둘'],
    ['목록 3단', '- a\n  - b\n    - c'],
    ['들여쓴 표', '  | a | b |'],
    ['백슬래시 이스케이프', '별표 \\* 글자'],
    ['링크 주소 안 괄호', '[x](https://a.b/x_(y))'],
    ['표 칸 안 굵게에 |', '| **a|b** | c |\n| - | - |'],
    ['표 둘째 줄이 구분행이 아님', '| a | b |\n| 1 | 2 |'],
    ['구분행이 셋째 줄', '| a | b |\n| - | - |\n| --- | --- |'],
    ['칸 수가 머리행과 다름', '| a | b |\n| - | - |\n| 1 | 2 | 3 |'],
    ['| 로 끝나지 않는 표 줄', '| a | b |\n| - | - |\n| 1 | 2'],
    ['«1)» 목록', '1) 첫째 항'],
    ['«+» 글머리', '+ 항목'],
    ['HTML 태그', '| a<br>b | c |'],
    ['HTML 개체', '띄어&nbsp;쓰기'],
    ['이미지', '![그림](https://a.kr/x.png)'],
    ['짝 없는 **', '**굵게 시작만'],
    ['별표 하나(기울임)', '*기울임*'],
    ['밑줄 굵게', '__굵게__'],
    ['닫는 # 이 붙은 제목', '## 제1장 ##'],
    ['들여쓴 제목', '   ## 제목'],
    ['밑줄식 제목 · 구분선', '제목\n==='],
    ['내용 없는 목록 항목', '1. 항\n2.'],
    ['첫 항목보다 얕은 항목', '   - 가\n- 나'],
    ['표 칸 경계를 넘는 굵게', '| **a | b** |\n| - | - |\n| 1 | 2 |'],
    ['빈 줄 뒤 하위 목록', '1. 가\n\n   - 나'],
    ['빈 줄 뒤 둘째 문단', '1. 항\n\n   둘째 문단\n2. 다'],
    ['내용 없는 제목', '## '],
    ['인용', '> 메모'],
  ])('%s', (_, body) => {
    expect(unsupportedIn(body).length).toBeGreaterThan(0)
  })
  it('지원하는 모양은 통과 — 번호 항 + 하위 글머리(2단) · 표 · 굵게 · 링크', () => {
    expect(
      unsupportedIn(
        '## 제1장\n**제1조 (목적)**\n1. 항 **굵게**\n   - 하위\n2. 둘\n\n| **구분** | **내용** |\n|:-:|---|\n| 1 | [x](/terms) |\n',
      ),
    ).toEqual([])
  })
})

describe('toBlock — 정본 한 절의 코드 블록에서 줄 고르기', () => {
  const src = [
    '# 문서',
    '## 1. 첫 절',
    '설명',
    '```',
    '상호: 노마컴 | 대표: 홍길동',
    '번호: 1-2-3 [조회]',
    `호스팅: ${SLOT.slice(1, -1)}`,
    '```',
    '## 2. 둘째 절',
    '```',
    '상호: 다른 값',
    '```',
  ].join('\n')
  const block = {
    file: 'x.md',
    exportName: 'X',
    section: '## 1.',
    pick: [
      { key: 'name', startsWith: '상호:' },
      { key: 'num', startsWith: '번호:' },
      { key: 'host', startsWith: '호스팅:' },
    ],
    links: { '[조회]': 'https://www.ftc.go.kr/x' },
    notes: [],
    placeholders: [sha256(SLOT.slice(1, -1))],
  }
  it('그 절의 첫 코드 블록에서만 · 링크 표시 → [글자](주소) · 값 자리 → 확정 전 표시', () => {
    expect(toBlock(src, block)).toEqual({
      lines: {
        name: '상호: 노마컴 | 대표: 홍길동',
        num: '번호: 1-2-3 [조회](https://www.ftc.go.kr/x)',
        host: `호스팅: ${PENDING_MARK}`,
      },
      pendingCount: 1,
    })
  })
  it('줄 머리 기호를 걷는다(05-A «• » · «☐ »)', () => {
    const out = toBlock('## A.\n```\n• 안내 한 줄\n☐ (필수) 동의\n```', {
      ...block,
      section: '## A.',
      pick: [
        { key: 'a', startsWith: '• 안내', strip: '• ' },
        { key: 'b', startsWith: '☐ (필수)', strip: '☐ ' },
      ],
      links: {},
      placeholders: [],
    })
    expect(out.lines).toEqual({ a: '안내 한 줄', b: '(필수) 동의' })
  })
  it('같은 머리로 시작하는 줄이 그 블록에 2개면 throw(어느 줄인지 모른다)', () => {
    expect(() =>
      toBlock('## 1.\n```\n상호: 가\n상호: 나\n```', {
        ...block,
        pick: [{ key: 'name', startsWith: '상호:' }],
        placeholders: [],
      }),
    ).toThrow(/2개다/)
  })
  it('절 끝에서 멈춘다 — 그 절에 코드 블록이 없으면 다음 절의 블록을 쓰지 않는다', () => {
    expect(() =>
      toBlock('## 1. 첫 절\n설명뿐\n## 2. 둘째 절\n```\n상호: 다른 값\n```', {
        ...block,
        pick: [{ key: 'name', startsWith: '상호:' }],
        placeholders: [],
      }),
    ).toThrow(/코드 블록이 없다/)
  })
  it('고르지 않은 줄은 skip(줄 글자 sha256)에 있어야 한다 — 정본에 줄이 늘거나 건너뛰던 줄이 바뀌면 멈춘다', () => {
    const two = '## 1.\n```\n상호: 노마컴\n  새 줄  \n\n```'
    const one = { ...block, pick: [{ key: 'name', startsWith: '상호:' }], placeholders: [] }
    expect(() => toBlock(two, one)).toThrow(/고르지도 건너뛰지도 않았다/)
    expect(toBlock(two, { ...one, skip: [{ sha256: sha256('새 줄'), why: '예시' }] }).lines).toEqual({ name: '상호: 노마컴' })
    expect(() => toBlock(two.replace('새 줄', '바뀐 줄'), { ...one, skip: [{ sha256: sha256('새 줄'), why: '예시 줄' }] })).toThrow(
      /고르지도 건너뛰지도/,
    )
    expect(() =>
      toBlock('## 1.\n```\n상호: 노마컴\n```', { ...one, skip: [{ sha256: sha256('새 줄'), why: '예시 줄' }] }),
    ).toThrow(/건너뛸 줄을 정본에서 찾지 못했다\(정본이 바뀌었다\): 예시 줄/)
  })
  it('절의 코드 블록은 정확히 1개 — 둘째 블록(새 동의 · 새 고지)을 조용히 버리지 않는다 · 닫히지 않은 블록도 멈춘다', () => {
    const one = { ...block, pick: [{ key: 'name', startsWith: '상호:' }], placeholders: [] }
    // 목록 아래 4칸 들여쓴 펜스 · 인용 안 펜스도 블록으로 센다
    expect(() => toBlock('## 1. 첫\n```\n상호: 노마컴\n```\n- 항목\n    ```\n    ☐ (필수) 새 동의\n    ```\n', one)).toThrow(/코드 블록이 2개다/)
    expect(() => toBlock('## 1. 첫\n```\n상호: 노마컴\n```\n> ```\n> ☐ (필수) 새 동의\n> ```\n', one)).toThrow(/코드 블록이 2개다/)
    // 닫히지 않은 펜스(인용 · 목록 안)는 절 경계를 무너뜨린다 — 멈춘다
    expect(() => toBlock('## 1. 첫\n```\n상호: 노마컴\n```\n> ```로 감싼 메모\n## 2. 둘\n본문\n', one)).toThrow(/닫히지 않은 코드 블록/)
    expect(() => docSource('## 2. 둘\n> ```로 감싼 메모\n표\n## 3. 셋\n다른 절\n', { section: '## 2.', title: 't' })).toThrow(/닫히지 않은 코드 블록/)
    expect(() => toBlock('## 1. 첫\n```\n상호: 노마컴\n```\n설명\n```\n☐ (필수) 새 동의\n```\n', one)).toThrow(/코드 블록이 2개다/)
    expect(() => toBlock('## 1. 첫\n```\n상호: 노마컴\n', one)).toThrow(/닫히지 않/)
  })
  it('절 머리는 정확히 그 번호 · 코드 블록 경계는 펜스 규칙대로(«```코드``` 설명» 은 펜스가 아니다 · ~~~ 안의 ``` 는 닫지 않는다)', () => {
    const one = { ...block, pick: [{ key: 'name', startsWith: '상호:' }], placeholders: [] }
    expect(toBlock('## 1.5 앞\n```\n상호: 다른 절\n```\n## 1. 첫\n```\n상호: 노마컴\n```', one).lines.name).toBe('상호: 노마컴')
    expect(
      toBlock('## 1. 첫\n```코드``` 설명\n```\n상호: 노마컴\n```\n## 2. 둘\n본문', one).lines.name,
    ).toBe('상호: 노마컴')
    expect(() => toBlock('## 1. 첫\n~~~\n상호: 노마컴\n```\n~~~\n', one)).toThrow(/고르지도 건너뛰지도/)
    expect(() => toBlock('```\n## 1. 코드 안\n```\n## 1. 첫\n```\n상호: 노마컴\n```', one)).not.toThrow()
  })
  it('정본에 이미 [글자](주소) 로 쓰인 링크 표시에는 주소를 다시 붙이지 않는다', () => {
    const out = toBlock('## 1.\n```\n번호: 1 [조회](https://www.ftc.go.kr/x)\n```', {
      ...block,
      pick: [{ key: 'num', startsWith: '번호:' }],
      placeholders: [],
    })
    expect(out.lines.num).toBe('번호: 1 [조회](https://www.ftc.go.kr/x)')
  })
  it.each([
    ['절이 없다', { section: '## 9.' }, /절 머리가 0개/],
    ['고를 줄이 없다', { pick: [{ key: 'z', startsWith: '없는 줄:' }] }, /0개다/],
    ['값 자리 해시가 정본에 없다', { placeholders: [sha256('[다른 태그]')] }, /찾지 못했다/],
  ])('%s 면 throw', (_, patch, re) => {
    expect(() => toBlock(src, { ...block, ...patch })).toThrow(re)
  })
})

describe('forbiddenIn — 공개 금지어(공급사 명칭 영문 · 한글 · 내부 용어 · 사람 · 번호 · 개발 경로)', () => {
  it.each([
    'Sparks 회선',
    'TSim 프로파일',
    'Maya',
    'Airalo',
    '스파크스',
    '티심',
    '마야',
    '에어알로',
    'Phase 2',
    'phase 2',
    '초안',
    'Proposal',
    'proposal r12',
    'John 결정',
    'H-001',
    'K9',
    'R-1',
    'R2',
    'B-8',
    'E7',
    'Q8',
    'D-29',
    'P9-22',
    'W1-6',
    'A6',
    'C4',
    'L1~L6',
    '{N}GB',
    '/checkout-preview 페이지',
    'apps/client 경로',
    'legal-pages 폴더',
    'Phase1',
    'phase2',
    'INF-1',
    'E2E-8',
    'p9-4',
    'w1-2',
    'D-100',
    '06_확인목록.md',
    'server/api/v1/verify',
    'nomacom-manager',
    'esim-manager',
    '유심사',
    '도시락',
    '로밍도깨비',
    '말톡',
    'TODO 확인',
    'TBD',
    '변호사 확인',
    '안내는 /business 페이지에',
    '고객센터(/support)',
    '매일 자정 기준',
    '한국시간 자정',
    '당일자정 기준',
    '익일자정까지',
    '한국시간자정 기준',
    '0시 기준',
    '00시 기준',
    '24시 기준',
    '0시부터',
    '00:00 기준',
    '24:00 기준',
    '00:00까지',
    '0시를 기준으로',
    '매일 0시에 차감',
    '0 시 기준',
    '24시 정각',
    '00:00(한국시간) 기준',
    '한국시간 00:00에',
    '오전 12시 기준',
    '밤 12시까지',
    '자정보다 늦게',
    '매일 0시(한국시간)에 초기화',
    '0시(KST) 기준',
    '0시 이후',
    '00:00 이후',
    '00시 이후',
    '24시 이후',
    '현지 시간 0시 초기화',
    '0시 KST 기준',
    '00:00 KST 기준',
    '한국시간 0시.',
    '00:00(KST)',
    '0시가 되면',
    '0시마다',
    '0시 리셋',
    '0시~24시',
    '00시 00분 기준',
    '24시가 지나면',
    '한국시간 0:00 기준',
    '23:59 까지',
    '00 : 00',
    '영시에',
    '밤 열두 시',
    '12 AM',
    'at midnight',
    'MIDNIGHT',
    '12:00 AM',
    '12:00 a.m.',
    '12 a.m',
    '오전 12:00',
    '밤 12:00',
    '밤열두시',
    '새벽영시',
    '0시경',
    '0시쯤',
    '매일 0시로 초기화',
    '0시면',
    '0시와 24시',
    '24시경',
    '00시께',
    '열두 시쯤',
    '영시로',
    '23시 59분까지',
    '오후 11시 59분',
    '[결제 테스트](/checkout-preview)',
    'esimmany.com/checkout-preview',
    '/api/v1/activate',
    'W1-12',
    'r15',
    '`코드`',
  ])('%s 는 걸린다', (t) => {
    expect(forbiddenIn(t).length).toBeGreaterThan(0)
  })
  it.each([
    '제12조 제3항',
    '(주)누리고(Solapi)',
    'Amazon Web Services',
    '24시간 단위',
    'eSIM 프로파일',
    'SM-DP+',
    'app.esimmany.com',
    '070-8064-5232',
    '[약관](/terms) · [고객센터](/support)',
    '사업자정보확인',
    '판매자정보',
    '이용자정보 · 제공자정보 · 수탁자정보 · 운영자정보',
    '24 시간 이상',
    '10시 기준',
    '20:00 기준',
    '10:00 기준',
    '변경 반영시 안내',
    '운영시간',
    '열두 시간',
    '열두 시즌',
    '12 amendments',
    '영 시행',
    '점심 12:00~13:00',
    '24시간 이상 연속 장애',
    '10:00 기준',
    'tools.google.com/dlpage/gaoptout',
    '5G 망',
    '보존합니다',
  ])('%s 는 걸리지 않는다', (t) => {
    expect(forbiddenIn(t)).toEqual([])
  })
})

describe('규칙 파일 — 공개 리포에 내부 검토 메모 글자가 없다', () => {
  const all = [...Object.values(DOC_RULES), ...Object.values(BLOCK_RULES)]
  it('메모 · 값 자리는 전부 sha256(64자 16진수)', () => {
    for (const r of all)
      for (const h of [...r.notes, ...r.placeholders]) expect(h).toMatch(/^[0-9a-f]{64}$/)
  })
  it.each(['../../scripts/legal-posting.ts', '../../scripts/legal-import.mjs'])(
    '%s 원문에 검토 태그 글자가 없다(콜론 유무 무관)',
    (file) => {
      const src = readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8')
      expect(src).not.toMatch(/\[(?:법률검토|법률 검토|확인|검토|결정|Phase|변호사)/)
    },
  )
  it('문서 · 조각 규칙(정본 파일 이름 고정)', () => {
    expect(Object.fromEntries(all.map((r) => [r.exportName, r.file]))).toEqual({
      TERMS_DOC: '01_이용약관.md',
      PRIVACY_DOC: '02_개인정보처리방침.md',
      REFUND_DOC: '03_취소환불정책.md',
      BUSINESS_DOC: '04_사업자정보-고객센터.md',
      CHECKOUT_NOTICE: '05_고지문구-동의체크-FAQ.md',
      BUSINESS_INFO: '04_사업자정보-고객센터.md',
      ISSUE_NOTICE: '05_고지문구-동의체크-FAQ.md',
    })
  })
})

describe('moduleSource · blockModuleSource — 생성 모듈', () => {
  it('값 자리는 주어진 상수 이름으로 · 본문 해시 머리줄 · 백틱 · ${ 이스케이프 · 출처는 주석에만', () => {
    const src = moduleSource(
      'privacy',
      { title: '방침', body: `a ${PENDING_MARK} \`b\` \${c}\n`, pendingCount: 1 },
      '02_x.md · legal-pages @abc1234',
      'PENDING_CONST',
    )
    expect(src).toContain("import { PENDING_CONST } from '../pending'")
    expect(src).toContain('a ${PENDING_CONST} \\`b\\` \\${c}')
    expect(src).toMatch(/^\/\/ sha256\(본문\): [0-9a-f]{64}$/m)
    expect(src).toContain('// 정본: 02_x.md · legal-pages @abc1234')
    expect(src).not.toMatch(/source:/)
  })
  it('본문의 백슬래시는 템플릿 문자열에서 그대로 살아남는다', () => {
    const src = moduleSource(
      'terms',
      { title: '약관', body: 'a \\ b\n', pendingCount: 0 },
      '01_x.md · legal-pages @abc1234',
      'PENDING_CONST',
    )
    expect(src).toContain('markdown: `a \\\\ b')
  })
  it('조각 — 값 자리 있는 줄만 템플릿 문자열 · 나머지는 따옴표 · as const', () => {
    const src = blockModuleSource(
      'business',
      { lines: { a: "상호: '노마컴'", b: `호스팅: ${PENDING_MARK}` }, pendingCount: 1 },
      '04_x.md ## 1. · legal-pages @abc1234',
      'PENDING_CONST',
    )
    expect(src).toContain("import { PENDING_CONST } from '../pending'")
    expect(src).toContain("  a: '상호: \\'노마컴\\'',")
    expect(src).toContain('  b: `호스팅: ${PENDING_CONST}`,')
    expect(src).toContain('export const BUSINESS_INFO = {')
    expect(src).toContain('} as const')
  })
})
