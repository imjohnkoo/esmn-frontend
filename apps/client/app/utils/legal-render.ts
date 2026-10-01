/**
 * 법정 문서 블록 → VNode(client-shell spec F-12 · F-20 · D-36). LegalMarkdown.vue · IssuerBusinessInfo.vue 가 부르고,
 * 테스트는 vue/server-renderer 로 실문서를 그려 본다. HTML 해석 없음(innerHTML · v-html 금지) — 글자는 전부 텍스트 노드.
 * 확정 전 값은 pending.ts 의 표기(displayValue).
 * ⚠️ 이 파일에 자리표시자 이름 · 화면 표기를 직접 쓰지 않는다(콘텐츠 게이트 D-17).
 */
import { h, type VNode } from 'vue'
import { displayValue } from '../content/pending'
import {
  inlineText,
  parseInline,
  parseLegalMarkdown,
  type Inline,
  type LegalBlock,
  type LegalMarkdownDoc,
} from './legal-markdown'

type Child = VNode | string

/** 이웃한 글자 조각을 하나로 — 서버 렌더는 붙은 텍스트 노드를 하나로 내보내므로 hydration 이 어긋나지 않게 */
function merge(xs: Child[]): Child[] {
  const out: Child[] = []
  for (const x of xs) {
    const prev = out[out.length - 1]
    if (typeof x === 'string' && typeof prev === 'string') out[out.length - 1] = prev + x
    else out.push(x)
  }
  return out
}

/** 어절이 «·» · 괄호 · 낫표 · 줄표에서 갈리지 않게 — 공백 없는 짧은 덩어리(18자 이하)는 한 줄에 둔다
 * («이름·휴대전화번호», «(esimmany.com)는», «704-24-01747», «09:00–18:00,») */
const KEEP = /[·「」()\-–]/
function renderText(text: string): Child[] {
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((p) =>
      !/\s/.test(p) && p.length <= 18 && KEEP.test(p) ? h('span', { class: 'legal-md__nb' }, p) : p,
    )
}

const newTabNote = () => h('span', { class: 'legal-md__sr' }, ' (새 창)')

export function renderInlines(xs: Inline[]): Child[] {
  return merge(
    xs.flatMap((x): Child[] => {
      if (x.t === 'text') return renderText(x.text)
      if (x.t === 'b') return [h('strong', renderInlines(x.children))]
      if (x.t === 'pending')
        return [h('span', { class: 'legal-md__pending' }, displayValue(x.token))]
      // 사이트 안 경로는 같은 탭, 바깥(https)은 새 탭 — 화면 낭독기에는 «(새 창)»
      return x.href.startsWith('/')
        ? [h('a', { href: x.href, class: 'legal-md__link' }, renderInlines(x.children))]
        : [
            h('a', { href: x.href, class: 'legal-md__link', target: '_blank', rel: 'noopener' }, [
              ...renderInlines(x.children),
              newTabNote(),
            ]),
          ]
    }),
  )
}

/** 한 블록. tableLabel = 표 영역 이름(renderBlocks 가 바로 앞 제목에서 만든다) */
export function renderBlock(b: LegalBlock, tableLabel = '표'): VNode {
  if (b.t === 'h2') return h('h2', { class: 'legal-md__h2' }, renderInlines(b.text))
  if (b.t === 'h3') return h('h3', { class: 'legal-md__h3' }, renderInlines(b.text))
  if (b.t === 'p') return h('p', { class: 'legal-md__p' }, renderInlines(b.text))
  if (b.t === 'list')
    return h(
      b.ordered ? 'ol' : 'ul',
      {
        class: b.ordered ? 'legal-md__ol' : 'legal-md__ul',
        start: b.ordered && b.start !== 1 ? b.start : undefined,
      },
      b.items.map((it) =>
        h('li', [...renderInlines(it.text), ...it.children.map((c) => renderBlock(c, tableLabel))]),
      ),
    )
  // 표 — 열이 많은 표(방침 1장 6열)는 열마다 최소 120px, 좁은 화면에서는 표만 가로로 넘긴다(키보드로도 — tabindex)
  return h(
    'div',
    { class: 'legal-md__table-wrap', role: 'region', 'aria-label': tableLabel, tabindex: 0 },
    [
      h(
        'table',
        {
          class: 'legal-md__table',
          style: { minWidth: `${Math.max(b.head.length * 120, 320)}px` },
        },
        [
          h('thead', [
            h(
              'tr',
              b.head.map((c) => h('th', { scope: 'col' }, renderInlines(c))),
            ),
          ]),
          h(
            'tbody',
            b.rows.map((r) =>
              h(
                'tr',
                r.map((c) => h('td', renderInlines(c))),
              ),
            ),
          ),
        ],
      ),
    ],
  )
}

/** 블록 목록 — 표 영역 이름은 바로 앞 장 · 조 제목(같은 제목 아래 둘째 표부터 번호)이라 낭독기에서 서로 구분된다 */
export function renderBlocks(blocks: LegalBlock[]): VNode[] {
  let heading = ''
  let nth = 0
  let all = 0
  return blocks.map((b) => {
    if (b.t === 'h2' || b.t === 'h3') {
      heading = inlineText(b.text)
      nth = 0
    }
    if (b.t !== 'table') return renderBlock(b)
    nth++
    all++
    return renderBlock(b, heading ? `${heading} 표${nth > 1 ? ` ${nth}` : ''}` : `표 ${all}`)
  })
}

/** 문서 한 편 — 제목 + 본문 블록 전부 */
export function renderDoc(doc: LegalMarkdownDoc): VNode {
  return h('article', { class: 'legal-md' }, [
    h('h1', { class: 'legal-md__title' }, doc.title),
    ...renderBlocks(parseLegalMarkdown(doc.markdown)),
  ])
}

/** 발급기 사업자정보 블록(D-36 — 04 1절 줄 그대로 + 방침 · 약관 링크). 방침은 굵게 · 색으로 구분(처리방침 작성지침) */
export function renderBusinessInfo(lines: readonly string[]): VNode {
  return h('section', { class: 'issuer-biz', 'aria-label': '사업자정보' }, [
    ...lines.map((l) => h('p', { class: 'issuer-biz__line' }, renderInlines(parseInline(l)))),
    h('p', { class: 'issuer-biz__links' }, [
      h(
        'a',
        { href: '/privacy', class: 'issuer-biz__link issuer-biz__link--privacy' },
        '개인정보처리방침',
      ),
      h('span', { 'aria-hidden': 'true' }, ' · '),
      h('a', { href: '/terms', class: 'issuer-biz__link' }, '이용약관'),
    ]),
  ])
}
