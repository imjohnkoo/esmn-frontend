import { describe, expect, it } from 'vitest'
import { josa } from './josa'

describe('josa (catalog spec S-2 — 조사는 앞말 받침에 맞춘다)', () => {
  it.each([
    ['방콕', '이/가', '이'],
    ['파리', '이/가', '가'],
    ['다낭', '이/가', '이'],
    ['한국', '은/는', '은'],
    ['몰디브', '은/는', '는'],
    ['7', '은/는', '은'],
    ['2', '은/는', '는'],
    ['0', '은/는', '은'],
    ['9', '이/가', '가'],
    ['LA', '이/가', '이(가)'],
    ['Paris', '은/는', '은(는)'],
    ['London', '은/는', '은(는)'],
    ['서울 NYC', '은/는', '은(는)'],
    ['런던 ', '이/가', '이'],
  ] as const)('%s + %s → %s', (word, pair, want) => {
    expect(josa(word, pair)).toBe(want)
  })

  it('판단할 글자가 없으면 둘 다', () => {
    expect(josa('!!', '은/는')).toBe('은(는)')
  })
})
