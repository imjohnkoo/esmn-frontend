import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * client-shell spec F-20 · D-32 · D-35 · D-36 — 발급기 화면의 법정 링크 · 고지 문구(개인정보 보호법 30조 · 약관 3조① · 6조④ · 12조③).
 * 화면 배선은 소스로 본다(main 에는 컴포넌트 렌더 테스트 의존성이 없다 — 그리는 규칙 자체는 utils/legal-render.test.ts 가 실문서로 본다).
 */
const read = (p: string) => readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8')
const template = (src: string) =>
  src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>'))
const APP = fileURLToPath(new URL('..', import.meta.url))
const SERVER = fileURLToPath(new URL('../../server', import.meta.url))
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
const code = (dir: string) =>
  walk(dir).filter((f) => /\.(vue|ts)$/.test(f) && !/\.test\.ts$/.test(f))

describe('발급기 법정 링크(F-20)', () => {
  it('verify — 개인정보처리방침(굵게 · 색 구분 클래스) · 이용약관, 새 탭', () => {
    const t = template(read('./verify/[orderId].vue'))
    expect(t).toMatch(
      /<a\s+class="verify-page__policy-link verify-page__policy-link--privacy"\s+href="\/privacy"\s+target="_blank"\s+rel="noopener"\s*>개인정보처리방침<span class="sr-only"> \(새 창\)<\/span><\/a/,
    )
    expect(t).toMatch(
      /href="\/terms"\s+target="_blank"\s+rel="noopener"\s*>이용약관<span class="sr-only"> \(새 창\)<\/span><\/a/,
    )
    // 방침은 굵게 · 색으로 다른 링크와 구분(처리방침 작성지침) · 터치 영역 24px 이상
    const css = read('./verify/[orderId].vue')
    expect(css).toMatch(
      /\.verify-page__policy-link--privacy \{[^}]*color: var\(--n-color-primary-600[^}]*font-weight: 700/,
    )
    expect(css).toMatch(/\.verify-page__policy-link \{[^}]*min-height: 24px/)
  })

  it('select-date 확인 팝업 안에 — 05-A 환불 안내(D-32) · 이용약관 보기(새 탭) · 05-A 동의 문구 체크(D-35)', () => {
    const t = template(read('./select-date/[orderId].vue'))
    const open = t.indexOf('v-model="isConfirmOrderVisible"')
    const popup = t.slice(open)
    const refund = popup.indexOf('<b>{{ ISSUE_NOTICE.refund }}</b>')
    const link = popup.search(
      /href="\/terms"\s+target="_blank"\s+rel="noopener"\s*>이용약관 보기<span class="sr-only"> \(새 창\)<\/span><\/a\s*>/,
    )
    const consent = popup.indexOf(
      '<NCheckbox v-model="isPolicyAgreed" :label="ISSUE_NOTICE.consent" />',
    )
    expect([refund, link, consent].every((i) => i > 0)).toBe(true)
    // 요약 · 안내는 스크롤 영역 안, 필수 동의 체크는 그 밖(늘 보임) · 버튼 앞 — 작은 화면에서 체크가 접힌 채 «발급하기» 만 비활성이지 않게
    const scrollOpen = popup.indexOf('class="select-date-page__confirm-scroll"')
    const scrollEnd = popup.indexOf('<!-- /confirm-scroll -->')
    const actions = popup.indexOf('<template #actions>')
    expect(scrollOpen >= 0 && scrollOpen < refund && link < scrollEnd).toBe(true)
    expect(scrollEnd < consent && consent < actions).toBe(true)
    const src = read('./select-date/[orderId].vue')
    // 스크롤 높이 = 화면 − (다이얼로그 − 스크롤 영역) — 열릴 때 · 화면 크기가 바뀔 때 실제 크기로
    expect(src).toMatch(/const fixed = dialog\.offsetHeight - el\.offsetHeight/)
    expect(src).toMatch(/watch\(isConfirmOrderVisible,[\s\S]*?requestAnimationFrame\(fitConfirm\)/)
    expect(src).toMatch(/visualViewport\?\.addEventListener\('resize', fitConfirm\)/)
    expect(src).toMatch(/\.select-date-page__confirm-scroll \{[^}]*overflow-y: auto;/)
    // 체크 전에는 발급하기 비활성 · 눌러도 막힘 · 팝업을 다시 열면 체크를 지운다(D-35 — 약관 동의 자리)
    expect(popup).toMatch(/:disabled="isSubmitting \|\| !isPolicyAgreed"/)
    expect(src).toMatch(/if \(isSubmitting\.value \|\| !isPolicyAgreed\.value\) return/)
    expect(src).toMatch(/isPolicyAgreed\.value = false\n\s*isConfirmOrderVisible\.value = true/)
    // 같은 팝업 — 환불 안내 → 링크 → 동의 체크 순서, 그 뒤에 발급하기
    expect(refund < link && link < consent && consent < popup.lastIndexOf('발급하기')).toBe(true)
  })

  it('«발급 후 취소 · 환불 불가» 문장이 앱 어디에도 없다 — 같은 자리는 05-A 14행(D-32)', () => {
    for (const f of code(APP))
      expect(readFileSync(f, 'utf8'), f).not.toMatch(
        /(?:취소|환불)[와과·/\s]*(?:환불)?\s*(?:이|가|은|을)?\s*(?:불가|X\b)|환불(?:이|은)?\s*안\s*(?:돼|됩)|(?:환불|취소)(?:을|를)?\s*(?:받을|할|해\s*드릴)\s*수\s*없|환불받을\s*수\s*없|환불되지\s*않아요|환불이\s*어려|취소할\s*수\s*없/,
      )
    expect(read('./supported-devices.vue')).toContain('${ISSUE_NOTICE.refund}')
    expect(read('../components/popup/ConfirmOrderModal.vue')).toContain(
      '*{{ ISSUE_NOTICE.refund }}',
    )
  })

  it('발급기 첫 화면 `/` — 사업자정보 · 방침 · 약관 블록(D-36 임시)', () => {
    expect(template(read('./index.vue'))).toContain('<IssuerBusinessInfo')
    expect(template(read('../components/legal/IssuerBusinessInfo.vue'))).toContain(
      'renderBusinessInfo(Object.values(BUSINESS_INFO))',
    )
  })

  it('두 페이지가 있다 — /terms · /privacy 는 각자의 생성물을 그린다 · <html lang="ko">', () => {
    for (const [page, name, mod] of [
      ['./terms.vue', 'TERMS_DOC', 'terms'],
      ['./privacy.vue', 'PRIVACY_DOC', 'privacy'],
    ] as const) {
      const src = read(page)
      expect(src).toContain(`import { ${name} } from '~/content/legal/${mod}'`)
      expect(template(src)).toContain(`<LegalMarkdown :doc="${name}" />`)
      expect(src).toContain("htmlAttrs: { lang: 'ko' }")
    }
    expect(template(read('../components/legal/LegalMarkdown.vue'))).toContain(
      '<component :is="renderDoc(doc)" />',
    )
  })

  it('번호 항 · 글머리표가 보인다 — 전역 리셋(list-style: none)을 법정 문서가 되돌린다', () => {
    const vue = read('../components/legal/LegalMarkdown.vue')
    expect(vue).toMatch(/\.legal-md \.legal-md__ol \{\s*list-style: decimal outside;/)
    expect(vue).toMatch(/\.legal-md \.legal-md__ul \{\s*list-style: disc outside;/)
  })
})

describe('방침 9장① «발급 화면은 쿠키를 사용하지 않습니다» 가 참이다(D-31)', () => {
  // W1-2 의 흐름 쿠키가 들어오면 이 테스트가 실패한다 — 방침 rev(legal-pages)를 같이 들여오고 이 테스트를 고친다.
  // 읽기(server 의 getCookie — 아무도 만들지 않는 세션 쿠키 자리)는 «사용» 이 아니다 — 쿠키를 만드는 길만 본다
  it('앱 · 서버 코드에 쿠키를 만드는 길이 없다(useCookie · document.cookie · setCookie · Set-Cookie)', () => {
    for (const f of [...code(APP), ...code(SERVER)])
      expect(readFileSync(f, 'utf8'), f).not.toMatch(
        /useCookie|document\.cookie|setCookie\(|set-cookie/i,
      )
  })
})
