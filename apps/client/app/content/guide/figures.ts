/**
 * 설치 가이드 화면 창 매니페스트(client-guide spec F-3 · D-3) — 단일 출처.
 * `scripts/guide-screens/render.mjs` 가 이 표대로 PNG 를 굽고(`public/guide-screens/<key>.v1.png`),
 * 가이드 페이지가 같은 표로 `<img>` 의 src · alt · 크기를 정한다.
 *
 * 값(screen · state · hl · ar · focus)은 «설치가이드 2609 v1»(design/install-guide @ eb96d75)의
 * `<figure class="shot">` 속성 그대로다. 창 폭이 2609 판(약 352px)과 비슷해 같은 범위가 보인다.
 * 예외(spec D-3): ① 2609 판의 축소 배율(0.86 · 0.92 — 5창)은 1 로 — 휴대폰 폭에서 화면 글자를 키운다.
 *   그 때문에 아래 버튼이 잘린 ios-plan-data-only 만 초점 42 → 50.
 *   또 아래 안내 · QR 이 잘리던 ios-qr-scan · web-qr-ios 는 초점 30 → 41 · 46(강조 없는 창 — 안내 · QR 은 다 보이고 반쯤 잘린 글자 · 버튼은 창 밖으로).
 * ② 문제 해결 창의 비율 0.9 → 0.82(본문 창과 같은 비율 — 같은 화면이면 파일을 함께 쓴다).
 *
 * ⚠️ 이 파일은 Node 가 타입만 지우고 바로 읽는다(render.mjs) — import · enum 을 쓰지 않는다.
 */

export interface GuideFigure {
  /** scripts/guide-screens/screens.js 의 화면 키 */
  screen: string
  /** 화면 변형 (예: 셀룰러 화면 설치 전 pre · 후 after) */
  state?: string
  /** 강조(빨간 테두리)할 요소 키 — 템플릿의 data-k */
  hl?: readonly string[]
  /** 창 비율 = 가로 ÷ 세로 */
  ar: number
  /** 화면 세로 몇 % 지점을 창 가운데에 둘지 */
  focus: number
  /** 확대 배율 (1 = 창 폭에 화면 폭을 맞춤) */
  zoom?: number
  /** 이미지 대체 글 — 화면 이름 + 누를 곳 */
  alt: string
}

/** 창 폭(CSS px) — 프레임 440px − 여백. 이미지는 이 폭 이하로만 줄어든다 */
export const FIGURE_WIDTH = 368
/** 굽는 배율 — 3배 화면에서도 또렷하게 */
export const FIGURE_SCALE = 3
/** 파일명 버전 접미 — 다시 구우면 올린다(CloudFront 캐시 무효화 불필요 — Proposal K4) */
export const FIGURE_VERSION = 'v1'

export const GUIDE_FIGURES = {
  // ---------------------------------------------------------------- 아이폰
  'ios-cellular-esim-add': {
    screen: 'ios-cellular',
    state: 'pre',
    hl: ['esim-add'],
    ar: 0.82,
    focus: 30,
    alt: '설정 › 셀룰러 화면 — eSIM 추가 표시',
  },
  'ios-transfer-more': {
    screen: 'ios-transfer',
    hl: ['more'],
    ar: 0.82,
    focus: 40,
    alt: '전화번호 전송 화면 — 기타 옵션 버튼 표시',
  },
  'ios-esim-setup-use-qr': {
    screen: 'ios-esim-setup',
    hl: ['use-qr'],
    ar: 0.82,
    focus: 40,
    alt: 'eSIM 설정 화면 — QR 코드 사용 표시',
  },
  'ios-qr-scan': {
    screen: 'ios-qr-scan',
    ar: 0.82,
    focus: 41,
    alt: 'QR 코드 스캔 화면 — 화면 안에 QR 코드를 맞춘 모습',
  },
  'web-qr-ios': {
    screen: 'web-qr',
    state: 'ios',
    ar: 0.82,
    focus: 46,
    alt: '아이폰 Safari 로 연 발급 완료 화면 — QR 코드',
  },
  'ios-longpress-add-esim': {
    screen: 'ios-longpress',
    hl: ['add-esim'],
    ar: 0.82,
    focus: 46,
    alt: 'QR 코드를 길게 누른 메뉴 — eSIM 추가 표시',
  },
  'web-codes-ios': {
    screen: 'web-codes-ios',
    hl: ['codes'],
    ar: 0.82,
    focus: 18,
    alt: '발급 화면 아이폰 수동 설치 — SM-DP+ 주소와 활성화 코드 표시',
  },
  'ios-qr-scan-manual': {
    screen: 'ios-qr-scan',
    hl: ['manual'],
    ar: 0.82,
    focus: 92,
    alt: 'QR 코드 스캔 화면 아래 — 세부사항 직접 입력 표시',
  },
  'ios-manual-fields': {
    screen: 'ios-manual',
    hl: ['fields', 'next'],
    ar: 0.82,
    focus: 30,
    alt: '활성화 코드 입력 화면 — 두 입력 칸과 다음 버튼 표시',
  },
  'ios-activate-alert': {
    screen: 'ios-activate-alert',
    hl: ['activate'],
    ar: 0.82,
    focus: 60,
    alt: 'eSIM 활성화 알림 — 활성화 버튼 표시',
  },
  'ios-activate-ready': {
    screen: 'ios-activate-ready',
    hl: ['continue'],
    ar: 0.82,
    focus: 30,
    alt: 'eSIM 활성화 화면 — 계속 버튼 표시',
  },
  'ios-where-abroad': {
    screen: 'ios-where',
    hl: ['abroad'],
    ar: 0.82,
    focus: 40,
    alt: '이 eSIM 을 사용할 위치 선택 화면 — 해외 표시',
  },
  'ios-plan-data-only': {
    screen: 'ios-plan',
    hl: ['data-only'],
    ar: 0.82,
    focus: 50,
    alt: '어떤 요금제를 사용하고 있습니까 화면 — 데이터 전용 표시',
  },
  'ios-done': {
    screen: 'ios-done',
    hl: ['done'],
    ar: 0.82,
    focus: 30,
    alt: '여행용 eSIM 설정 완료 화면 — 완료 버튼 표시',
  },
  'ios-cellular-new-line': {
    screen: 'ios-cellular',
    state: 'after',
    hl: ['new-line'],
    ar: 0.82,
    focus: 46,
    alt: '설정 › 셀룰러 화면 — 새 회선(활성화 중) 표시',
  },
  'ios-line-on-roaming': {
    screen: 'ios-line',
    hl: ['line-on', 'roaming'],
    ar: 0.82,
    focus: 36,
    alt: '새 회선 화면 — 이 회선 켜기와 데이터 로밍 스위치 표시',
  },
  'ios-lock-noti': {
    screen: 'ios-lock-noti',
    hl: ['noti'],
    ar: 0.82,
    focus: 36,
    alt: '잠금 화면 — 여행용 eSIM 켜기 알림 표시',
  },
  'ios-travel-choice-both': {
    screen: 'ios-travel-choice',
    hl: ['both'],
    ar: 0.82,
    focus: 34,
    alt: '여행용 eSIM 켜기 화면 — 여행용 SIM 및 현재 eSIM 표시',
  },
  'ios-lowdata': {
    screen: 'ios-lowdata',
    ar: 0.82,
    focus: 30,
    alt: '저데이터 모드 화면 — 저데이터 모드 켜기 · 지금 안 함',
  },
  'ios-celldata-travel': {
    screen: 'ios-celldata',
    hl: ['travel', 'switch'],
    ar: 0.82,
    focus: 34,
    alt: '셀룰러 데이터 화면 — 새 회선 선택과 셀룰러 데이터 전환 허용 스위치 표시',
  },
  'ios-error': {
    screen: 'ios-error',
    ar: 0.82,
    focus: 48,
    alt: 'eSIM 을 활성화할 수 없음 알림',
  },
  'ios-network-auto': {
    screen: 'ios-network',
    hl: ['auto'],
    ar: 0.82,
    focus: 30,
    alt: '네트워크 선택 화면 — 자동 스위치 표시',
  },

  // ---------------------------------------------------------------- 안드로이드 (갤럭시 One UI)
  'aos-connections-sim': {
    screen: 'aos-connections',
    hl: ['sim'],
    ar: 0.82,
    focus: 34,
    alt: '설정 › 연결 화면 — SIM 관리자 표시',
  },
  'aos-sim-esim-add': {
    screen: 'aos-sim',
    state: 'pre',
    hl: ['esim-add'],
    ar: 0.82,
    focus: 30,
    alt: 'SIM 관리자 화면 — eSIM 추가 표시',
  },
  'aos-method-scan': {
    screen: 'aos-method',
    hl: ['scan'],
    ar: 0.82,
    focus: 36,
    alt: 'eSIM 추가 방법 선택 화면 — QR 코드 스캔 표시',
  },
  'aos-scan': {
    screen: 'aos-scan',
    ar: 0.82,
    focus: 36,
    alt: 'QR 코드 스캔 화면 — 네모 칸 안에 QR 코드를 맞춘 모습',
  },
  'web-qr-aos-download': {
    screen: 'web-qr',
    state: 'aos',
    hl: ['download'],
    ar: 0.82,
    focus: 52,
    alt: '발급 완료 화면 — QR 코드 다운로드 버튼 표시',
  },
  'aos-scan-gallery': {
    screen: 'aos-scan',
    hl: ['gallery'],
    ar: 0.82,
    focus: 70,
    alt: 'QR 코드 스캔 화면 아래 — 갤러리 아이콘 표시',
  },
  'web-codes-aos': {
    screen: 'web-codes-aos',
    hl: ['codes'],
    ar: 0.82,
    focus: 22,
    alt: '발급 화면 안드로이드 수동 설치 — LPA 전체 코드 표시',
  },
  'aos-scan-code': {
    screen: 'aos-scan',
    hl: ['code'],
    ar: 0.82,
    focus: 60,
    alt: 'QR 코드 스캔 화면 — 활성화 코드 입력 표시',
  },
  'aos-code-input': {
    screen: 'aos-code',
    hl: ['input', 'done'],
    ar: 0.82,
    focus: 26,
    alt: '활성화 코드 입력 화면 — 입력 칸과 완료 버튼 표시',
  },
  'aos-confirm-add': {
    screen: 'aos-confirm',
    hl: ['add'],
    ar: 0.82,
    focus: 18,
    alt: 'eSIM 추가 확인 화면 — 추가 버튼 표시',
  },
  'aos-sim-esim1': {
    screen: 'aos-sim',
    state: 'after',
    hl: ['esim1'],
    ar: 0.82,
    focus: 30,
    alt: 'SIM 관리자 화면 — 켜진 eSIM 1 표시',
  },
  'aos-sim-primary': {
    screen: 'aos-sim',
    state: 'after',
    hl: ['primary'],
    ar: 0.82,
    focus: 66,
    alt: 'SIM 관리자 화면 — 주 사용 SIM 카드(통화 · 메시지 · 모바일 데이터 SIM 1) 표시',
  },
  'aos-sim-switch': {
    screen: 'aos-sim',
    state: 'after',
    hl: ['switch'],
    ar: 0.82,
    focus: 92,
    alt: 'SIM 관리자 화면 아래 — 데이터 전환 스위치 표시',
  },
  'aos-roaming-esim': {
    screen: 'aos-roaming',
    hl: ['roam-esim'],
    ar: 0.82,
    focus: 20,
    alt: '해외 로밍 화면 — 데이터 로밍 eSIM 1 스위치 표시',
  },
  'aos-data-sheet-esim': {
    screen: 'aos-data-sheet',
    hl: ['esim-opt'],
    ar: 0.82,
    focus: 84,
    alt: '모바일 데이터 선택 창 — eSIM 1 표시',
  },
  'aos-carrier-auto': {
    screen: 'aos-carrier',
    hl: ['auto'],
    ar: 0.82,
    focus: 28,
    alt: '로밍 이동통신사 선택 화면 — 자동 선택 스위치 표시',
  },
} as const satisfies Record<string, GuideFigure>

export type FigureKey = keyof typeof GUIDE_FIGURES

export function figureSrc(key: FigureKey): string {
  return `/guide-screens/${key}.${FIGURE_VERSION}.png`
}

/** 창 크기(CSS px) — `<img width height>` 와 PNG 크기(× FIGURE_SCALE)의 기준 */
export function figureSize(key: FigureKey): { width: number; height: number } {
  return { width: FIGURE_WIDTH, height: Math.round(FIGURE_WIDTH / GUIDE_FIGURES[key].ar) }
}
