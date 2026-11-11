// 비밀번호 정책 · Argon2id 파라미터(spec D-7 · AC-1.5 의 PHC 접두)
import { describe, expect, it } from 'vitest'
import { hashPassword, parsePassword, verifyPassword } from './password'

describe('parsePassword', () => {
  it.each([
    ['1234567', null],
    ['12345678', '12345678'],
    ['가나다라마바사아', '가나다라마바사아'], // 코드 포인트 8 — 바이트 길이가 아니다
    ['a'.repeat(128), 'a'.repeat(128)],
    ['a'.repeat(129), null],
    [12345678, null],
  ])('%j → %j', (input, out) => {
    expect(parsePassword(input)).toBe(out)
  })
})

describe('hash · verify', () => {
  it('Argon2id m=19456 t=2 p=1 PHC · 맞는 비밀번호만 통과', async () => {
    const phc = await hashPassword('correct-horse-1')
    expect(phc.startsWith('$argon2id$v=19$m=19456,t=2,p=1$')).toBe(true)
    expect(await verifyPassword(phc, 'correct-horse-1')).toBe(true)
    expect(await verifyPassword(phc, 'correct-horse-2')).toBe(false)
  })

  it('저장값 없음 · 깨진 PHC → false(던지지 않는다)', async () => {
    expect(await verifyPassword(null, 'anything-1')).toBe(false)
    expect(await verifyPassword('not-a-phc', 'anything-1')).toBe(false)
  })
})
