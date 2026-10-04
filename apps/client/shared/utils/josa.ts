/**
 * 조사 고르기 — 앞말 받침에 맞춘다(«방콕» 이 · «파리» 가 · «한국» 은 · «몰디브» 는).
 * 한글은 받침으로, 숫자는 읽는 소리로 판단한다. 로마자는 읽는 소리를 알 수 없어(Paris · Madrid · UK) «이(가)» 처럼
 * 둘 다 쓴다 — 판단할 글자가 없을 때도 같다.
 */
export type JosaPair = '이/가' | '은/는' | '을/를' | '과/와'

const DIGIT_HAS_FINAL = [true, true, false, true, false, false, true, true, true, false] // 영 일 이 삼 사 오 육 칠 팔 구

function hasFinal(word: string): boolean | null {
  const ch = [...word.trim()].reverse().find((c) => /[가-힣0-9A-Za-z]/.test(c))
  if (!ch) return null
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0
  if (/[0-9]/.test(ch)) return DIGIT_HAS_FINAL[Number(ch)]!
  return null
}

export function josa(word: string, pair: JosaPair): string {
  const [withFinal, withoutFinal] = pair.split('/') as [string, string]
  const f = hasFinal(word)
  if (f === null) return `${withFinal}(${withoutFinal})`
  return f ? withFinal : withoutFinal
}
