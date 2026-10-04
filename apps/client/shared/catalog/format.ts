/** 원화 표시 «9,100원» — ICU 를 쓰지 않는다(SSR 과 브라우저가 같은 글자를 내야 hydration 이 맞는다) */
export function formatWon(n: number): string {
  return `${String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}원`
}
