import { describe, expect, it } from 'vitest'
import { createSSRApp, h, type VNode } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { BUSINESS_INFO } from '../content/legal/business'
import { PRIVACY_DOC } from '../content/legal/privacy'
import { REFUND_DOC } from '../content/legal/refund'
import { TERMS_DOC } from '../content/legal/terms'
import { P9_4_PENDING } from '../content/pending'
import { parseLegalMarkdown } from './legal-markdown'
import { footerParts, renderBlocks, renderBusinessLines, renderDoc, renderNoticeList } from './legal-render'

/** client-shell spec F-12 · F-20 · D-36 — 블록 · 실문서를 실제 HTML 로 그려 본다(서버 렌더 — 브라우저 없이) */
const ssr = (node: () => VNode | VNode[]) =>
  renderToString(createSSRApp({ render: () => h('div', node()) }))
const render = (md: string) => ssr(() => renderBlocks(parseLegalMarkdown(md)))

/** HTML → 화면 글자(낭독기 전용 «(새 창)» 제외) */
const visible = (html: string) =>
  html
    .replace(/<span class="legal-md__sr sr-only">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')

describe('renderBlocks — 그린 HTML', () => {
  it('장 · 조 제목 · 번호 항(시작 번호) · 하위 글머리 · 굵게 · 표(제목 칸 scope) · 확정 전 표기', async () => {
    const html = await render(
      [
        '## 제4장 청약철회',
        '**제12조 (청약철회)**',
        '3. 셋째 **굵게** 항',
        '4. 넷째 항',
        '   - 하위',
        '',
        '| 수탁자 | 업무 |',
        '| --- | --- |',
        `| (주)누리고 ${P9_4_PENDING} | 알림톡 |`,
      ].join('\n'),
    )
    expect(html).toContain('<h2 class="legal-md__h2">제4장 청약철회</h2>')
    expect(html).toMatch(
      /<h3 class="legal-md__h3">제12조 <span class="legal-md__nb">\(청약철회\)<\/span><\/h3>/,
    )
    expect(html).toMatch(
      /<ol class="legal-md__ol" start="3"><li>셋째 <strong>굵게<\/strong> 항<\/li><li>넷째 항<ul class="legal-md__ul"><li>하위<\/li><\/ul><\/li><\/ol>/,
    )
    expect(html).toContain('<th scope="col">수탁자</th>')
    expect(html).toContain('role="region"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('<span class="legal-md__pending">(확정 전)</span>')
    expect(html).not.toContain(P9_4_PENDING)
  })

  it('표 영역 이름 = 바로 앞 제목(같은 제목 아래 둘째 표부터 번호) — 낭독기에서 표끼리 구분된다', async () => {
    const t = '| a | b |\n| - | - |\n| 1 | 2 |'
    const html = await render(
      `| x | y |\n| - | - |\n| 0 | 0 |\n\n## 1. 목적\n${t}\n\n${t}\n\n**제2조 (정의)**\n${t}`,
    )
    expect([...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1])).toEqual([
      '표 1',
      '1. 목적 표',
      '1. 목적 표 2',
      '제2조 (정의) 표',
    ])
  })

  it('앞에 제목이 없는 표는 문서 제목으로 — «표 1» 로 읽히지 않는다', async () => {
    const doc = { slug: 'refund', title: '취소·환불 정책', markdown: '| 구분 | 기준 |\n| - | - |\n| 발급 전 | 전액 |\n' } as const
    const html = await ssr(() => renderDoc(doc))
    expect([...html.matchAll(/aria-label="([^"]+)"/g)].map((m) => m[1])).toEqual(['취소·환불 정책 표'])
  })

  it('표 최소 폭 = 열마다 120px(최소 320)', async () => {
    const six = await render(
      '| a | b | c | d | e | f |\n| - | - | - | - | - | - |\n| 1 | 2 | 3 | 4 | 5 | 6 |',
    )
    expect(six).toContain('min-width:720px')
    const two = await render('| a | b |\n| --- | --- |\n| 1 | 2 |')
    expect(two).toContain('min-width:320px')
  })

  it('링크 — 사이트 안은 같은 탭, 바깥 https 는 새 탭 · noopener · 낭독기에 «(새 창)»', async () => {
    const html = await render('[약관](/terms) · [조회](https://www.ftc.go.kr/x)')
    expect(html).toContain('<a href="/terms" class="legal-md__link">약관</a>')
    expect(html).toContain(
      '<a href="https://www.ftc.go.kr/x" class="legal-md__link" target="_blank" rel="noopener">조회<span class="legal-md__sr sr-only"> (새 창)</span></a>',
    )
  })

  it('짧은 어절은 «·» · 괄호에서 갈리지 않게 한 덩어리(nowrap) — 긴 덩어리 · 일반 어절은 그대로', async () => {
    const html = await render(
      '이름·휴대전화번호 (esimmany.com)는 보통어절 「소비자분쟁해결기준」에 아주긴덩어리·아주긴덩어리·아주긴덩어리',
    )
    expect(html).toContain('<span class="legal-md__nb">이름·휴대전화번호</span>')
    expect(html).toContain('<span class="legal-md__nb">(esimmany.com)는</span>')
    expect(html).toContain('<span class="legal-md__nb">「소비자분쟁해결기준」에</span>')
    expect(html).not.toContain('<span class="legal-md__nb">보통어절</span>')
    const nums = await render('번호: 704-24-01747 (평일 09:00–18:00, 휴무)')
    expect(nums).toContain('<span class="legal-md__nb">704-24-01747</span>')
    expect(nums).toContain('<span class="legal-md__nb">09:00–18:00,</span>')
    expect(await render('카카오톡 채널 @이심마니 문의')).toContain('<span class="legal-md__nb">@이심마니</span>')
    expect(html).not.toContain('<span class="legal-md__nb">아주긴덩어리')
  })

  it('문단은 <p> — 제목 태그가 아니다(낭독기 제목 탐색)', async () => {
    const html = await render('## 장\n\n첫 문단\n\n둘째 문단')
    expect(html).toContain('<p class="legal-md__p">첫 문단</p><p class="legal-md__p">둘째 문단</p>')
  })

  it('HTML · 스크립트는 글자로 — 태그가 만들어지지 않는다', async () => {
    const html = await render('문단 <script>alert(1)</script> <img src=x onerror=alert(1)>')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
})

describe.each([TERMS_DOC, PRIVACY_DOC, REFUND_DOC])('renderDoc($slug) — 실문서를 그대로 그린다', (doc) => {
  /** 게시용 마크다운 → 화면에 보여야 할 글자(꾸밈 기호 · 번호 · 구분행 · 표 칸 경계 제거, 자리표시자 → 표기) — 공백은 비교하지 않는다 */
  const expected = doc.markdown
    .split('\n')
    .filter((l) => !/^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(l))
    .map((l) =>
      (/^#{2,3}\s/.test(l) ? l.replace(/^#{2,3}\s+/, '') : l.replace(/^\s*(?:\d+\.|[-*])\s+/, ''))
        .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1')
        .replace(/\*\*/g, '')
        .replace(/\|/g, ''),
    )
    .join('')
    .split(P9_4_PENDING)
    .join('(확정 전)')
    .replace(/\s+/g, '')

  it('화면 글자 = 원문 글자(한 글자도 빠지거나 더해지지 않는다) · 제목 · 자리표시자 이름 0', async () => {
    const html = await ssr(() => renderDoc(doc))
    const shown = visible(html)
    expect(shown.startsWith(doc.title)).toBe(true)
    expect(shown.slice(doc.title.length).replace(/\s+/g, '')).toBe(expected)
    expect(shown).not.toMatch(/[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+/)
  })

  it('블록 수 그대로 — 문단 · 제목 · 표 개수가 파싱 결과와 같다', async () => {
    const html = await ssr(() => renderDoc(doc))
    const blocks = parseLegalMarkdown(doc.markdown)
    const count = (t: string) => blocks.filter((b) => b.t === t).length
    expect((html.match(/<p class="legal-md__p">/g) ?? []).length).toBe(count('p'))
    expect((html.match(/<h2 class="legal-md__h2">/g) ?? []).length).toBe(count('h2'))
    expect((html.match(/<h3 class="legal-md__h3">/g) ?? []).length).toBe(count('h3'))
    expect((html.match(/role="region" aria-label="[^"]+" tabindex="0"/g) ?? []).length).toBe(count('table'))
  })

  it('표시 번호 = 원문 번호(목록마다 시작 번호 + 차례)', async () => {
    const html = await ssr(() => renderDoc(doc))
    const source = [...doc.markdown.matchAll(/^\s*(\d+)\.\s/gm)].map((m) => Number(m[1]))
    // 그린 HTML 에서 <ol start> 와 그 목록의 바로 아래 <li> 개수로 화면 번호를 다시 센다
    const shown: number[] = []
    const re = /<ol class="legal-md__ol"(?: start="(\d+)")?>|<\/ol>|<li>|<\/li>|<ul[^>]*>|<\/ul>/g
    const stack: { ordered: boolean; next: number; depth: number }[] = []
    let depth = 0
    for (const m of html.matchAll(re)) {
      const tag = m[0]
      if (tag.startsWith('<ol')) stack.push({ ordered: true, next: Number(m[1] ?? 1), depth })
      else if (tag.startsWith('<ul')) stack.push({ ordered: false, next: 0, depth })
      else if (tag === '</ol>' || tag === '</ul>') stack.pop()
      else if (tag === '<li>') {
        const top = stack[stack.length - 1]!
        if (top.ordered && depth === top.depth) shown.push(top.next++)
        depth++
      } else depth--
    }
    expect(shown).toEqual(source)
  })
})

describe('renderBusinessLines — 푸터 사업자정보 줄(F-7)', () => {
  it('04 1절 7줄 차례 · 공정위 조회 새 탭(낭독기 «(새 창)») · 호스팅 «(확정 전)» · © 는 따로(푸터가 그린다)', async () => {
    const { lines: info, copyright, legalLinks } = footerParts(BUSINESS_INFO)
    expect(copyright).toBe('© 2026 노마컴. All rights reserved.')
    expect(legalLinks).toBe('이용약관 | 개인정보처리방침 | 취소·환불 정책 | 사업자정보')
    const html = await ssr(() => renderBusinessLines(info))
    const lines = [...html.matchAll(/<p class="site-footer__line">(.*?)<\/p>/g)].map((m) =>
      visible(m[1]!),
    )
    expect(lines).toEqual([
      '이심마니 | 상호: 노마컴 | 대표: 구장회',
      '사업자등록번호: 704-24-01747 사업자정보확인',
      '통신판매업신고: 제 2023-경기광주-1950 호',
      '주소: 제주특별자치도 제주시 신대로 145, 멘써빌딩 2층 (1-27호)(연동)',
      '전화: 070-8064-5232 (평일 09:00–18:00, 주말·공휴일 휴무) | 이메일: esimmany@naver.com',
      '개인정보보호책임자: 구장회',
      '호스팅 서비스: (확정 전)',
    ])
    expect(html).toContain(
      '<a href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=7042401747" class="legal-md__link" target="_blank" rel="noopener">사업자정보확인<span class="legal-md__sr sr-only"> (새 창)</span></a>',
    )
    expect(copyright).toBe('© 2026 노마컴. All rights reserved.')
    expect(html).not.toContain(P9_4_PENDING)
  })
})

describe('renderNoticeList — 발급 화면 고지 목록(05-A · F-21)', () => {
  it('줄마다 한 항목 · 지정한 줄만 굵게 · 사이트 안 링크도 새 창(팝업 상태를 잃지 않게) · 낭독기 «(새 창)»', async () => {
    const html = await ssr(() =>
      renderNoticeList(['첫 줄', '둘째 3,500원', '기기 확인 [지원 기기 확인](/supported-devices)'], [1]),
    )
    expect(html).toMatch(/^<div><ul class="issue-notice__list"><li>첫 줄<\/li><li><strong>둘째 3,500원<\/strong><\/li>/)
    expect(html).toContain(
      '<a href="/supported-devices" class="legal-md__link" target="_blank" rel="noopener">지원 기기 확인<span class="legal-md__sr sr-only"> (새 창)</span></a>',
    )
  })
})

