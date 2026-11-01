import { eq } from 'drizzle-orm'
import { useDB, schema } from '../../db'
import { useMayaApi } from '../../utils/maya-api'
import { generateEsimTag } from '../../utils/string'
import { createUTCDateTime, createLocalDateTime } from '../../utils/date'
import { matchesOrderContact } from '../../utils/verification'
import { issueSparkUnit } from '../../utils/spark-issuance'
import { logEvent } from '../../utils/issuance-log'
import { isOrderCancelled } from '../../utils/order-status'
import { checkIssueConsent, hashIp, viewerIp } from '../../utils/issue-consent'
import { ISSUE_CONSENT, type IssueConsent } from '../../../shared/consent/issue-consent'

// 같은 productOrderId 에 대한 동시 발급 요청 직렬화 (더블클릭/재시도 race 방어).
// 단일 Nitro 인스턴스 (CodeDeploy EC2 1대) 전제 — 다중 인스턴스 확장 시 DB 레벨
// 락 (advisory lock 등) 으로 교체 필요. prod DB 스키마는 backend 와 공유라 제약
// 추가 대신 app 레벨 방어 우선.
const inFlightActivations = new Map<number, Promise<void>>()

interface ActivateOrderRequest {
  receiverName: string
  receiverPhoneNumber: string
  optionManageCode: string
  orderId: number
  placeOrderDate: string
  planCountriesKr: string[]
  planDataDuration: number
  planDataTypeKr: string
  planNameKr: string
  planTypeId: string
  productName: string
  productOrderId: number
  quantity: number
  startCountry: string
  startDate: string
  startTime: number
  endDate: string
  startTimeZone: string
  totalPaymentAmount: number
  consent: IssueConsent
}

interface EsimResponse {
  apn: string
  manualCode: string
  smdpAddress: string
  networkStatus: string
  serviceStatus: string
  activationCode: string
}

interface OrderDetails {
  orderId: number
  productOrderId: number
  productName: string
  placeOrderDate: Date
  quantity: number
  totalPaymentAmount: number
  optionManageCode: string
  receiverName: string
  receiverPhoneNumber: string
  planNameKr: string
  planDataTypeKr: string
  planDataLimitKr: string
  planDataDuration: number
  planCountriesKr: string[]
  planCountriesEng: string[]
  planCountriesIso: string[]
  timeZones: string[]
  planTypeId: string
  esims: EsimResponse[]
}

interface ActivateOrderResponse {
  verified: boolean
  cancelled?: boolean
  details?: OrderDetails[]
}

export default defineEventHandler(async (event): Promise<ActivateOrderResponse> => {
  // consent_log.accepted_at — 서버가 요청을 받은 시각(클라이언트 시계 불신 · 락 대기 전)
  const acceptedAt = new Date()
  const body = await readBody<ActivateOrderRequest>(event)

  // Validate required fields
  if (
    !body.productOrderId ||
    !body.orderId ||
    !body.startDate ||
    !body.startTimeZone ||
    !body.receiverName ||
    !body.receiverPhoneNumber
  ) {
    throw createError({
      statusCode: 400,
      message: 'Missing required fields',
    })
  }

  // 발급 필수 동의(client-consent-log spec F-4) — 판 · 해시가 서버 상수와 같을 때만. 화면은 data.code 로 «다시 시도» 를 가린다(D-21)
  const consentCheck = checkIssueConsent(body.consent)
  if (consentCheck !== 'ok') {
    logEvent('ORDER_ACTIVATE_REJECTED', 'warn', 'issue consent missing or mismatched', {
      productOrderId: body.productOrderId,
      reason: consentCheck === 'missing' ? 'CONSENT_MISSING' : 'CONSENT_MISMATCH',
    })
    throw createError({ statusCode: 400, message: 'Consent required', data: { code: 'CONSENT_REQUIRED' } })
  }

  const db = useDB()

  // 같은 주문의 진행 중 발급이 끝날 때까지 대기 — 이후 DB 재조회로 이미 발급된
  // 수량을 반영하므로 중복 요청은 자연스럽게 idempotent 응답으로 수렴
  while (inFlightActivations.has(body.productOrderId)) {
    await inFlightActivations.get(body.productOrderId)
  }
  let releaseLock!: () => void
  inFlightActivations.set(
    body.productOrderId,
    new Promise<void>((resolve) => {
      releaseLock = resolve
    }),
  )

  try {
    logEvent('ORDER_ACTIVATE_REQUESTED', 'info', `activate requested for ${body.productOrderId}`, {
      orderId: body.orderId,
      productOrderId: body.productOrderId,
      optionManageCode: body.optionManageCode,
    })

    // Verify order exists (lock 획득 후 조회 — esims 수가 최신이어야 resume 이 정확)
    const order = await db.query.orders.findFirst({
      where: eq(schema.orders.productOrderId, body.productOrderId),
      with: {
        esims: true,
      },
    })

    if (!order) {
      logEvent('ORDER_ACTIVATE_REJECTED', 'warn', 'order not found', {
        productOrderId: body.productOrderId,
        reason: 'ORDER_NOT_FOUND',
      })
      throw createError({
        statusCode: 404,
        message: 'Order not found',
      })
    }

    // 취소/클레임 주문 발급 가드 — API 직접 호출로 취소 주문이 발급되는 것 차단
    // (backend 와 공통 반영, 원가 손실 방지. verify 표시와 동일 기준 공유)
    if (isOrderCancelled(order.lastChangedType)) {
      logEvent('ORDER_ACTIVATE_REJECTED', 'warn', 'order cancelled or under claim', {
        productOrderId: body.productOrderId,
        reason: 'ORDER_CLAIMED',
      })
      throw createError({
        statusCode: 409,
        message: 'Order is cancelled or under claim — issuance blocked',
      })
    }

    // 주문 연락처 대조 (군간 AND + 군내 OR) — productOrderId 만으로 타인 주문의
    // 발급 트리거 + activationCode 조회 차단
    if (
      !matchesOrderContact(
        { fullName: body.receiverName, phoneNumber: body.receiverPhoneNumber },
        order,
      )
    ) {
      throw createError({
        statusCode: 403,
        message: 'Receiver information does not match',
      })
    }

    // Get plan type
    const planType = await db.query.planTypes.findFirst({
      where: eq(schema.planTypes.planTypeId, body.optionManageCode),
    })

    if (!planType) {
      throw createError({
        statusCode: 404,
        message: 'Plan type not found',
      })
    }

    // 벤더 라우팅 — 'spark' 만 발급한다(client-consent-log spec F-5 · D-8). Maya 는 2026-10 종료라 NULL(옛 «NULL ≡ maya») ·
    // 'maya' · 미지 벤더 모두 동의 기록 전에 400 — 종료된 Maya 로 보내 발급이 실패하고 Maya tag(구매자 정보)가 나가는 길을 닫는다.
    // Maya 분기 코드는 아래에 남아 있지만 닿지 않는다(삭제는 별 정리 트랙)
    const provider: string | null = planType.provider
    if (provider !== 'spark') {
      logEvent('ORDER_ACTIVATE_REJECTED', 'warn', 'plan type is not issuable', {
        productOrderId: body.productOrderId,
        planTypeId: planType.planTypeId,
        dbProvider: planType.provider,
        reason: 'PROVIDER_NOT_ISSUABLE',
      })
      throw createError({ statusCode: 400, message: 'Plan type is not issuable' })
    }

    const quantity = order.quantity || 1
    const existingCount = order.esims?.length || 0

    logEvent('PROVIDER_RESOLVED', 'info', `provider ${provider} for ${planType.planTypeId}`, {
      productOrderId: body.productOrderId,
      planTypeId: planType.planTypeId,
      dbProvider: planType.provider,
      provider,
      quantity,
      existingEsimCount: existingCount,
    })

    // 동의 기록(spec F-6 · I-1 · I-2) — 거절 판정을 모두 지난 뒤 · 벤더 호출 전 한 자리. 새 eSIM 이 생길 요청만(전량 발급 재조회는 행 0 — D-1).
    // 실패하면 발급하지 않는다(동의 기록 없는 발급 0). 발급 루프와 트랜잭션으로 묶지 않는다 — 동의는 했으므로 발급이 뒤에서 실패해도 행은 남는다(I-8)
    if (existingCount < quantity) {
      const ip = viewerIp(getRequestHeader(event, 'x-forwarded-for'), event.node.req.socket?.remoteAddress)
      const ipHash = ip ? hashIp(ip, process.env.PII_HMAC_KEY) : null
      if (ip && !ipHash) {
        // 평문 IP 는 로그에도 남기지 않는다(I-3)
        logEvent('CONSENT_IP_HASH_SKIPPED', 'warn', 'PII_HMAC_KEY missing or not 32 bytes — ip_hash NULL', {
          productOrderId: body.productOrderId,
        })
      }
      try {
        await db.insert(schema.consentLog).values({
          channel: 'naver-smartstore',
          // DB 주문 행의 값 — 바디 orderId 는 대조되지 않은 값이다(D-18)
          orderRef: order.orderId == null ? null : String(order.orderId),
          productOrderId: order.productOrderId,
          consentKind: ISSUE_CONSENT.kind,
          textVersion: ISSUE_CONSENT.textVersion,
          textHash: ISSUE_CONSENT.textHash,
          lineCount: quantity,
          acceptedAt,
          actor: 'customer',
          ipHash,
          userAgent: getRequestHeader(event, 'user-agent') ?? null,
        })
      } catch (e) {
        // drizzle 은 쿼리 원문 · 파라미터(ip_hash · UA)를 message 에 싣는다 — DB 원인(cause)만 남긴다
        const cause = (e as { cause?: { message?: string } }).cause?.message ?? (e as Error).message
        logEvent('CONSENT_LOG_FAILED', 'error', String(cause).split('\n')[0]!, {
          productOrderId: body.productOrderId,
        })
        throw createError({ statusCode: 500, message: 'Failed to record consent', data: { code: 'CONSENT_LOG_FAILED' } })
      }
    }

    // 발급 완료 후 최신 상태 재조회 → 응답 (Maya/Spark 공용)
    const buildResponse = async (): Promise<ActivateOrderResponse> => {
      const updatedOrder = await db.query.orders.findFirst({
        where: eq(schema.orders.productOrderId, body.productOrderId),
        with: {
          esims: true,
        },
      })

      if (!updatedOrder) {
        throw createError({
          statusCode: 500,
          message: 'Failed to retrieve updated order',
        })
      }

      const esimResponses: EsimResponse[] = (updatedOrder.esims || []).map((esim) => ({
        apn: esim.apn || '',
        manualCode: esim.manualCode || '',
        smdpAddress: esim.smdpAddress || '',
        networkStatus: esim.networkStatus || '',
        serviceStatus: esim.serviceStatus || '',
        activationCode: esim.activationCode || '',
      }))

      const orderDetail: OrderDetails = {
        orderId: updatedOrder.orderId || 0,
        productOrderId: updatedOrder.productOrderId,
        productName: updatedOrder.productName || '',
        placeOrderDate: updatedOrder.placeOrderDate || new Date(),
        quantity: updatedOrder.quantity || 0,
        totalPaymentAmount: updatedOrder.totalPaymentAmount || 0,
        optionManageCode: updatedOrder.optionManageCode || '',
        receiverName: updatedOrder.receiverName || '',
        receiverPhoneNumber: updatedOrder.receiverPhoneNumber || '',
        planNameKr: planType.planNameKr || '',
        planDataTypeKr: planType.planDataTypeKr || '',
        planDataLimitKr: planType.planDataLimitKr || '',
        planDataDuration: planType.planDataDuration || 0,
        planCountriesKr: planType.planCountriesKr || [],
        planCountriesEng: planType.planCountriesEng || [],
        planCountriesIso: planType.planCountriesIso || [],
        timeZones: planType.timeZones || [],
        planTypeId: planType.planTypeId,
        esims: esimResponses,
      }

      return {
        verified: true,
        cancelled: false,
        details: [orderDetail],
      }
    }

    if (provider === 'spark') {
      // Spark 경로 — 원장·동시성 규약 포함 유닛 발급 (utils/spark-issuance.ts).
      // UI 는 날짜만 받는 사양 (자정 고정) — body.startTime (-24, Maya 사전 활성화
      // 버퍼) 은 Maya 전용 규약이므로 Spark 에는 자정 (0) 을 명시 전달
      for (let i = existingCount; i < quantity; i++) {
        try {
          await issueSparkUnit({
            order,
            unitIndex: i,
            planTypeId: planType.planTypeId,
            startDate: body.startDate,
            startTimeZone: body.startTimeZone,
            startCountry: body.startCountry,
            startTime: 0,
          })
        } catch (e) {
          logEvent('ORDER_ACTIVATE_FAILED', 'error', String((e as Error).message), {
            productOrderId: body.productOrderId,
            provider,
            unitIndex: i,
          })
          throw e
        }
        logEvent('ESIM_ISSUED', 'info', `unit ${i} issued (spark)`, {
          productOrderId: body.productOrderId,
          unitIndex: i,
          provider,
        })
      }
      logEvent('ORDER_ACTIVATE_COMPLETED', 'info', `all units issued for ${body.productOrderId}`, {
        productOrderId: body.productOrderId,
        provider,
        quantity,
        unitsIssued: quantity - existingCount,
      })
      return buildResponse()
    }

    const mayaApi = useMayaApi()

    // 부족분만 이어서 발급 (resume) — 이전 시도가 중간 실패로 부분 발급 상태여도
    // 재시도로 정상 완료 가능. 이미 전량 발급된 경우 루프를 건너뛰고 현재 상태 반환
    for (let i = existingCount; i < quantity; i++) {
      // Generate unique tag
      const tag = generateEsimTag(order, i)

      // Maya 발급은 외부 side-effect — 성공분은 반드시 즉시 DB 에 기록 (순서 유지).
      // esim + plan 쌍만 트랜잭션으로 묶어 plan 누락 상태를 방지
      const mayaEsim = await mayaApi.createEsim({
        tag,
        region: 'global',
      })

      const newEsim: typeof schema.esims.$inferInsert = {
        esimId: mayaEsim.iccid,
        apn: mayaEsim.apn,
        tag: mayaEsim.tag || tag,
        uid: mayaEsim.uid,
        iccid: mayaEsim.iccid,
        state: mayaEsim.state,
        autoApn: mayaEsim.auto_apn,
        manualCode: mayaEsim.manual_code,
        smdpAddress: mayaEsim.smdp_address,
        dateAssigned: mayaEsim.date_assigned ? new Date(mayaEsim.date_assigned) : new Date(),
        networkStatus: mayaEsim.network_status,
        serviceStatus: mayaEsim.service_status,
        activationCode: mayaEsim.activation_code,
        orderId: order.productOrderId,
      }

      const newPlan: typeof schema.plans.$inferInsert = {
        esimId: mayaEsim.iccid,
        planTypeId: planType.planTypeId,
        isActivated: false,
        startDateEntered: body.startDate,
        startTimeEntered: body.startTime,
        startTimeZoneEntered: body.startTimeZone,
        startCountryEntered: body.startCountry,
        timeToBeActivatedInUTC: createUTCDateTime(
          body.startDate,
          body.startTime,
          body.startTimeZone,
        ),
        timeToBeActivatedInLocal: createLocalDateTime(
          body.startDate,
          body.startTime,
          body.startTimeZone,
        ),
      }

      await db.transaction(async (tx) => {
        await tx.insert(schema.esims).values(newEsim)
        await tx.insert(schema.plans).values(newPlan)
      })

      logEvent('ESIM_ISSUED', 'info', `unit ${i} issued (maya)`, {
        productOrderId: body.productOrderId,
        unitIndex: i,
        provider,
      })
    }

    logEvent('ORDER_ACTIVATE_COMPLETED', 'info', `all units issued for ${body.productOrderId}`, {
      productOrderId: body.productOrderId,
      provider,
      quantity,
      unitsIssued: quantity - existingCount,
    })
    return buildResponse()
  } catch (e) {
    // 요청 수준 실패 로그 (거절 이벤트가 이미 찍힌 4xx 는 제외하고 관측 공백 방지)
    const statusCode = (e as { statusCode?: number })?.statusCode
    if (!statusCode || statusCode >= 500) {
      logEvent('ORDER_ACTIVATE_FAILED', 'error', String((e as Error).message), {
        productOrderId: body.productOrderId,
      })
    }
    throw e
  } finally {
    inFlightActivations.delete(body.productOrderId)
    releaseLock()
  }
})
