/**
 * 시트를 닫을 때 페이지가 움직이지 않게(client-guide S-4 «닫으면 화면 그대로» · D-25 · QA ⑥ R13).
 *
 * 시트가 닫히면 reka 가 연 요소(카드 · 약관 링크)로 포커스를 돌려준다 — 스크롤 옵션 없이. 그 요소가 화면 가장자리나
 * 아래 붙은 버튼(D-25)의 여백 밑에 걸쳐 있으면 브라우저가 페이지를 스크롤한다. 닫기가 시작된 뒤 잠깐
 * (사용자가 직접 스크롤 · 터치 · 키 입력을 하기 전까지, 최대 ms) 생기는 스크롤은 닫을 때 자리로 되돌린다.
 *
 * 포커스 이벤트에 기대지 않는다 — 창이 OS 포커스를 갖지 않으면 오지 않는다. scroll 이벤트는 화면 그리기 전에 오므로
 * 그 자리에서 되돌리면 깜빡이지 않는다.
 */
const USER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

export function keepScrollAfterClose(win: Window = window, ms = 1500): () => void {
  const y = win.scrollY
  const onScroll = () => {
    if (Math.abs(win.scrollY - y) > 1) win.scrollTo(0, y)
  }
  const stop = () => {
    win.removeEventListener('scroll', onScroll)
    for (const t of USER_INPUT) win.removeEventListener(t, stop, true)
    clearTimeout(timer)
  }
  win.addEventListener('scroll', onScroll, { passive: true })
  for (const t of USER_INPUT) win.addEventListener(t, stop, { capture: true, passive: true })
  const timer = setTimeout(stop, ms)
  return stop
}
