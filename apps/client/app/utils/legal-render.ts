/**
 * 법정 문서 블록 → VNode(client-shell spec F-12 · F-20 · F-21 · F-22). LegalMarkdown.vue · SiteFooter · 발급 팝업 · 체크아웃이 부르고,
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
 * («이름·휴대전화번호», «(esimmany.com)는», «704-24-01747», «09:00–18:00,», «@이심마니») */
const KEEP = /[·「」()\-–@]/
function renderText(text: string): Child[] {
  return text
    .split(/(\s+)/)
    .filter(Boolean)
    .map((p) =>
      !/\s/.test(p) && p.length <= 18 && KEEP.test(p) ? h('span', { class: 'legal-md__nb' }, p) : p,
    )
}

// legal-md__sr = 법정 문서 스타일 · sr-only = Tailwind(푸터처럼 LegalMarkdown 스타일이 실리지 않는 화면에서도 숨김)
const newTabNote = () => h('span', { class: 'legal-md__sr sr-only' }, ' (새 창)')

/** newTab = 사이트 안 경로도 새 창(발급 팝업처럼 입력 · 상태를 잃으면 안 되는 자리)
 *  blankPending = 값 자리를 글자 없이(법정 문서 본문 — spec D-47). 표식(legal-md__pending · data-pending)은 남는다 — 승격 전 렌더 확인이 센다 */
export function renderInlines(
  xs: Inline[],
  opts: { newTab?: boolean; blankPending?: boolean; sheet?: (href: string) => (() => void) | undefined } = {},
): Child[] {
  return merge(
    xs.flatMap((x): Child[] => {
      if (x.t === 'text') return renderText(x.text)
      if (x.t === 'b') return [h('strong', renderInlines(x.children, opts))]
      if (x.t === 'pending')
        return [
          h('span', { class: 'legal-md__pending', 'data-pending': '' }, opts.blankPending ? '' : displayValue(x.token)),
        ]
      // sheet = 이 주소를 하단 시트로 여는 함수(spec D-48) — 있으면 새 탭 대신 시트(href 는 남김 · 새 창 표기 없음)
      const openSheet = opts.sheet?.(x.href)
      if (openSheet)
        return [
          h(
            'a',
            {
              href: x.href,
              class: 'legal-md__link',
              'aria-haspopup': 'dialog',
              onClick: (e: MouseEvent) => {
                // cmd · ctrl · shift · alt 클릭(데스크톱 «새 탭에서 열기»)은 브라우저 기본 동작 그대로(href)
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
                e.preventDefault()
                openSheet()
              },
            },
            renderInlines(x.children, opts),
          ),
        ]
      // 사이트 안 경로는 같은 탭, 바깥(https)은 새 탭 — 화면 낭독기에는 «(새 창)»
      return x.href.startsWith('/') && !opts.newTab
        ? [h('a', { href: x.href, class: 'legal-md__link' }, renderInlines(x.children, opts))]
        : [
            h('a', { href: x.href, class: 'legal-md__link', target: '_blank', rel: 'noopener' }, [
              ...renderInlines(x.children, opts),
              newTabNote(),
            ]),
          ]
    }),
  )
}

/** 법정 문서 본문의 인라인 — 값 자리는 글자 없이(spec D-47 · John 2026-10-03 «확정전이라는 단어는 삭제») */
const DOC_INLINE = { blankPending: true } as const

/** 한 블록. tableLabel = 표 영역 이름(renderBlocks 가 바로 앞 제목에서 만든다) */
export function renderBlock(b: LegalBlock, tableLabel = '표'): VNode {
  if (b.t === 'h2') return h('h2', { class: 'legal-md__h2' }, renderInlines(b.text, DOC_INLINE))
  if (b.t === 'h3') return h('h3', { class: 'legal-md__h3' }, renderInlines(b.text, DOC_INLINE))
  if (b.t === 'p') return h('p', { class: 'legal-md__p' }, renderInlines(b.text, DOC_INLINE))
  if (b.t === 'list')
    return h(
      b.ordered ? 'ol' : 'ul',
      {
        class: b.ordered ? 'legal-md__ol' : 'legal-md__ul',
        start: b.ordered && b.start !== 1 ? b.start : undefined,
      },
      b.items.map((it) =>
        h('li', [...renderInlines(it.text, DOC_INLINE), ...it.children.map((c) => renderBlock(c, tableLabel))]),
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
              b.head.map((c) => h('th', { scope: 'col' }, renderInlines(c, DOC_INLINE))),
            ),
          ]),
          h(
            'tbody',
            b.rows.map((r) =>
              h(
                'tr',
                r.map((c) => h('td', renderInlines(c, DOC_INLINE))),
              ),
            ),
          ),
        ],
      ),
    ],
  )
}

/** 블록 목록 — 표 영역 이름은 바로 앞 장 · 조 제목(같은 제목 아래 둘째 표부터 번호)이라 낭독기에서 서로 구분된다.
 *  앞에 제목이 없는 표는 fallback(문서 제목 — 장 · 조 제목 앞에 놓인 표가 «표 1» 로 읽히지 않게) */
export function renderBlocks(blocks: LegalBlock[], fallback = ''): VNode[] {
  let heading = fallback
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
    ...renderBlocks(parseLegalMarkdown(doc.markdown), doc.title),
  ])
}

/** 푸터 조각(F-7) — 04 1절 줄을 사업자정보 줄(차례 그대로) · 링크 줄(화면은 shell-nav LEGAL_LINKS 로 그린다) · © 줄로 나눈다 */
export function footerParts<T extends { copyright: string; legalLinks: string }>(info: T) {
  const { copyright, legalLinks, ...rest } = info
  return { lines: Object.values(rest) as string[], legalLinks, copyright }
}

/** 사업자정보 줄(F-7 푸터 — 04 1절 줄 그대로 · «사업자정보확인» 은 공정위 조회 새 창) */
export function renderBusinessLines(lines: readonly string[]): VNode {
  return h(
    'div',
    { class: 'site-footer__info' },
    lines.map((l) => h('p', { class: 'site-footer__line' }, renderInlines(parseInline(l)))),
  )
}

/** 발급 화면 고지 목록(05-A — F-21) — 줄마다 한 항목 · 링크는 모두 새 창 · strongAt = 굵게 둘 줄(설치 전 3,500원 환불 — 약관 12조③ «미리 표시») */
export function renderNoticeList(
  lines: readonly string[],
  strongAt: readonly number[] = [],
  opts: { sheet?: (href: string) => (() => void) | undefined } = {},
): VNode {
  return h(
    'ul',
    { class: 'issue-notice__list' },
    lines.map((l, i) => {
      const inner = renderInlines(parseInline(l), { newTab: true, sheet: opts.sheet })
      return h('li', strongAt.includes(i) ? [h('strong', inner)] : inner)
    }),
  )
}
