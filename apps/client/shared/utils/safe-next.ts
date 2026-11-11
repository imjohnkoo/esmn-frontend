import { SITE_ORIGIN } from './site'

// 로그인 뒤 돌아갈 곳(spec F-17 · I-10 · D-20) — 같은 사이트 경로만. 서버 · 화면이 이 함수 하나를 쓴다.
// 제어 문자(탭 · 줄바꿈 포함) · 역슬래시는 디코드 전후 어디에 있든 통째로 거부한다 — 브라우저 URL 파서가 지우거나 `/` 로 바꿔
// `/\t/evil.example` · `/\evil.example` 가 다른 출처로 풀리는 파서 차이를 막는다. 그다음 고정 출처 기준으로 풀어 출처가 같을 때만.
// eslint-disable-next-line no-control-regex -- 제어 문자를 찾는 것이 목적이다
const BAD = /[\x00-\x1f\x7f\\]/

export function safeNext(raw: unknown, fallback = '/my', origin = SITE_ORIGIN): string {
  if (typeof raw !== 'string' || !raw.startsWith('/') || BAD.test(raw)) return fallback
  try {
    if (BAD.test(decodeURIComponent(raw))) return fallback
    const base = new URL(origin)
    const url = new URL(raw, base)
    const out = `${url.pathname}${url.search}${url.hash}`
    // 점 구간 정규화(`/..//evil.example` → `//evil.example`)가 프로토콜 상대 주소를 만들 수 있다 — 결과도 `//` 로 시작하면 거부
    return url.origin === base.origin && !out.startsWith('//') ? out : fallback
  } catch {
    return fallback
  }
}
