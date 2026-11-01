// activate 핸들러 — 동의 검증 · provider 가드 · consent_log INSERT 순서(client-consent-log spec AC-1 · AC-3~AC-6 · I-1 · I-2).
// DB · 벤더 · h3 는 대역이다(로컬 PG 없이). 실제 표에 들어가는지는 ⑦ walk(E2E-2 — 위키 SQL 로 만든 로컬 표)가 본다.
import { createError } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ISSUE_CONSENT } from '../../../shared/consent/issue-consent'

const calls: string[] = []
const insertValues = vi.fn()
const db = {
  query: {
    orders: { findFirst: vi.fn() },
    planTypes: { findFirst: vi.fn() },
  },
  insert: vi.fn(() => ({ values: insertValues })),
  transaction: vi.fn(),
}
const issueSparkUnit = vi.fn()
const createEsim = vi.fn()

vi.mock('../../db', () => ({
  useDB: () => db,
  schema: { orders: {}, planTypes: {}, consentLog: { _: 'consent_log' } },
}))
vi.mock('../../utils/spark-issuance', () => ({
  issueSparkUnit: (...a: unknown[]) => issueSparkUnit(...a),
}))
vi.mock('../../utils/maya-api', () => ({ useMayaApi: () => ({ createEsim }) }))
const logEvent = vi.fn()
vi.mock('../../utils/issuance-log', () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }))

// Nitro 자동 import 대역
vi.stubGlobal('defineEventHandler', (fn: unknown) => fn)
vi.stubGlobal('readBody', async (e: { body: unknown }) => e.body)
vi.stubGlobal('createError', createError)
vi.stubGlobal(
  'getRequestHeader',
  (e: { headers: Record<string, string> }, name: string) => e.headers[name],
)

type Handler = (event: unknown) => Promise<{ verified: boolean; details?: unknown[] }>
const handler = (await import('./activate.post')).default as unknown as Handler

const KEY = 'AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8='
const ORDER = {
  productOrderId: 2026092300000202,
  orderId: 2026092300000201,
  quantity: 2,
  lastChangedType: null,
  receiverName: '테스트고객',
  receiverPhoneNumber: '010-0000-0002',
  customerName: '테스트고객',
  customerPhoneNumber: '010-0000-0002',
  esims: [] as unknown[],
}
const body = (over: Record<string, unknown> = {}) => ({
  productOrderId: ORDER.productOrderId,
  orderId: 999, // 바디 orderId 는 쓰지 않는다(D-18) — DB 값과 일부러 다르게
  startDate: '2026-11-10',
  startTimeZone: 'Europe/Paris',
  receiverName: '테스트고객',
  receiverPhoneNumber: '010-0000-0002',
  optionManageCode: 'WALK-FRA-7D',
  consent: { ...ISSUE_CONSENT },
  ...over,
})
const event = (b: unknown, headers: Record<string, string> = {}) => ({
  body: b,
  headers: {
    'x-forwarded-for': '198.51.100.9, 203.0.113.7',
    'user-agent': 'Mozilla/5.0 (테스트 UA)',
    ...headers,
  },
  node: { req: { socket: { remoteAddress: '10.0.0.5' } } },
})
const status = async (p: Promise<unknown>) => {
  try {
    await p
    return 200
  } catch (e) {
    return (e as { statusCode: number }).statusCode
  }
}

beforeEach(() => {
  calls.length = 0
  vi.stubEnv('PII_HMAC_KEY', KEY)
  db.query.orders.findFirst.mockResolvedValue({ ...ORDER, esims: [] })
  db.query.planTypes.findFirst.mockResolvedValue({ planTypeId: 'WALK-FRA-7D', provider: 'spark' })
  insertValues.mockImplementation(async () => {
    calls.push('insert')
  })
  issueSparkUnit.mockImplementation(async () => {
    calls.push('spark')
  })
})
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('activate — 동의 검증(AC-3)', () => {
  it.each([
    ['동의 없음', { consent: undefined }],
    ['kind 다름', { consent: { ...ISSUE_CONSENT, kind: 'signup-terms' } }],
    ['판 다름', { consent: { ...ISSUE_CONSENT, textVersion: 'issue-D44-v1' } }],
    ['해시 다름', { consent: { ...ISSUE_CONSENT, textHash: '0'.repeat(64) } }],
  ])('%s → 400 CONSENT_REQUIRED · DB 조회 0 · 행 0 · 벤더 0', async (_, over) => {
    const err = await handler(event(body(over))).catch((e) => e)
    expect(err.statusCode).toBe(400)
    expect(err.data).toEqual({ code: 'CONSENT_REQUIRED' })
    expect(db.query.orders.findFirst).not.toHaveBeenCalled()
    expect(insertValues).not.toHaveBeenCalled()
    expect(issueSparkUnit).not.toHaveBeenCalled()
  })
})

describe('activate — provider 가드(AC-5)', () => {
  it.each([null, 'maya', 'foo'])('provider %s → 400 · 행 0 · 벤더 0', async (provider) => {
    db.query.planTypes.findFirst.mockResolvedValue({ planTypeId: 'WALK-FRA-7D', provider })
    const err = await handler(event(body())).catch((e) => e)
    expect(err.statusCode).toBe(400)
    expect(err.data).toBeUndefined() // 화면 «다시 시도» 대상이 아니다(D-22)
    expect(insertValues).not.toHaveBeenCalled()
    expect(issueSparkUnit).not.toHaveBeenCalled()
    expect(createEsim).not.toHaveBeenCalled()
  })
})

describe('activate — 거절에는 행 0(I-2)', () => {
  it('주문 없음 404 · 수신자 불일치 403 · 취소 409', async () => {
    db.query.orders.findFirst.mockResolvedValueOnce(undefined)
    expect(await status(handler(event(body())))).toBe(404)
    expect(
      await status(
        handler(event(body({ receiverName: '다른사람', receiverPhoneNumber: '010-9999-9999' }))),
      ),
    ).toBe(403)
    db.query.orders.findFirst.mockResolvedValueOnce({
      ...ORDER,
      lastChangedType: 'CLAIM_REQUESTED',
    })
    expect(await status(handler(event(body())))).toBe(409)
    expect(insertValues).not.toHaveBeenCalled()
  })
})

describe('activate — 동의 기록(AC-1 · AC-4 · AC-6 · I-1)', () => {
  it('정상 — consent_log 1행(§④.2 값) 뒤에 부족분만 Spark 발급', async () => {
    await handler(event(body()))
    expect(db.insert).toHaveBeenCalledTimes(1)
    expect(db.insert).toHaveBeenCalledWith(expect.objectContaining({ _: 'consent_log' }))
    expect(insertValues).toHaveBeenCalledTimes(1)
    const row = insertValues.mock.calls[0]![0]
    expect(row).toEqual({
      channel: 'naver-smartstore',
      orderRef: '2026092300000201',
      productOrderId: 2026092300000202,
      consentKind: 'issue-terms',
      textVersion: 'issue-D51-v1',
      textHash: ISSUE_CONSENT.textHash,
      lineCount: 2,
      acceptedAt: expect.any(Date),
      actor: 'customer',
      ipHash: '9df8158b5794e6e827f0d42e6fcc4669d49d681d2e048553a0925e6e0a7507a0', // 203.0.113.7 — XFF 맨 오른쪽
      userAgent: 'Mozilla/5.0 (테스트 UA)',
    })
    expect(JSON.stringify(row)).not.toMatch(/203\.0\.113\.7|198\.51|010-|테스트고객/) // 평문 PII 0(I-3)
    expect(calls).toEqual(['insert', 'spark', 'spark'])
  })

  it('부분 발급(1/2) 이어서 — 행 1 · 남은 1개만', async () => {
    db.query.orders.findFirst.mockResolvedValue({ ...ORDER, esims: [{}] })
    await handler(event(body()))
    expect(calls).toEqual(['insert', 'spark'])
    // line_count = 주문 수량(이번에 발급할 수가 아니다 — spec §④.2)
    expect(insertValues.mock.calls[0]![0]).toMatchObject({ lineCount: 2 })
  })

  it('DB 주문 행에 orderId 가 없으면 order_ref NULL(«null» 글자 아님)', async () => {
    db.query.orders.findFirst.mockResolvedValue({ ...ORDER, orderId: null, esims: [] })
    await handler(event(body()))
    expect(insertValues.mock.calls[0]![0]).toMatchObject({ orderRef: null })
  })

  it('키 없음 → ip_hash NULL · UA 없음 → NULL · 발급은 진행', async () => {
    vi.stubEnv('PII_HMAC_KEY', '')
    await handler(event(body(), { 'user-agent': undefined as unknown as string }))
    expect(insertValues.mock.calls[0]![0]).toMatchObject({ ipHash: null, userAgent: null })
    expect(issueSparkUnit).toHaveBeenCalledTimes(2)
  })

  it('INSERT 실패 → 500 CONSENT_LOG_FAILED · 벤더 0(AC-4)', async () => {
    // drizzle 오류 모양 — message 에 쿼리 · 파라미터, 원인은 cause
    insertValues.mockRejectedValue(
      Object.assign(new Error('Failed query: insert into "consent_log" …\nparams: naver-smartstore,9df8158b,Mozilla'), {
        cause: new Error('relation "consent_log" does not exist'),
      }),
    )
    const err = await handler(event(body())).catch((e) => e)
    expect(err.statusCode).toBe(500)
    expect(err.data).toEqual({ code: 'CONSENT_LOG_FAILED' })
    const failed = logEvent.mock.calls.find((c) => c[0] === 'CONSENT_LOG_FAILED')!
    expect(failed[2]).toBe('relation "consent_log" does not exist') // 원인만 — 파라미터(ip_hash · UA) 0
    expect(issueSparkUnit).not.toHaveBeenCalled()
    expect(createEsim).not.toHaveBeenCalled()
  })

  it('전량 발급 재호출 → 200 · 행 0 · 벤더 0(AC-6)', async () => {
    db.query.orders.findFirst.mockResolvedValue({ ...ORDER, esims: [{}, {}] })
    const res = await handler(event(body()))
    expect(res.verified).toBe(true)
    expect(insertValues).not.toHaveBeenCalled()
    expect(issueSparkUnit).not.toHaveBeenCalled()
  })
})
