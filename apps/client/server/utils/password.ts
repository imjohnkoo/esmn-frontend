import { hash, verify, type Options } from '@node-rs/argon2'

// 비밀번호 — Argon2id(OWASP 최소 m=19MiB · t=2 · p=1) PHC 문자열 · 8 ~ 128자 · 조합 규칙 없음(spec D-7 · K-A3)

// algorithm 2 = Argon2id — const enum 은 isolatedModules 에서 값으로 import 할 수 없다(PHC 접두 테스트가 고정)
const PARAMS: Options = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
}

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128

/** 경계 검증 — 문자열 · 코드 포인트 8 ~ 128. 통과하면 그대로, 아니면 null */
export function parsePassword(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const len = [...input].length
  return len >= PASSWORD_MIN && len <= PASSWORD_MAX ? input : null
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, PARAMS)
}

// 없는 계정 · 비밀번호 없는 수단에도 한 번 검증해 응답 시간을 맞춘다(spec I-2). 값은 아무 비밀번호의 해시 — 맞을 일이 없다
let dummy: Promise<string> | null = null

/** 저장된 PHC 와 대조. stored 가 null 이면 더미 해시로 같은 비용을 치르고 false */
export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  if (!stored) {
    dummy ??= hash('dummy-password-for-timing', PARAMS)
    await verify(await dummy, password).catch(() => false)
    return false
  }
  return verify(stored, password).catch(() => false)
}
