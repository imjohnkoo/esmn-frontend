import {
  pgTable,
  bigint,
  bigserial,
  varchar,
  timestamp,
  boolean,
  integer,
  text,
  serial,
  jsonb,
  numeric,
  char,
  smallint,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// prod DB 는 TypeORM 기본 naming (camelCase 컬럼). backend (NestJS) 와 schema 공유.
// 표 이름: `order`, `esim`, `plan`, `plan-type` (plan-type 는 hyphen)

export const orders = pgTable('order', {
  productOrderId: bigint('productOrderId', { mode: 'number' }).primaryKey(),
  orderId: bigint('orderId', { mode: 'number' }),
  productOrderStatus: varchar('productOrderStatus', { length: 255 }),
  lastChangedType: varchar('lastChangedType', { length: 255 }),
  paymentDate: timestamp('paymentDate'),
  lastChangedDate: timestamp('lastChangedDate'),
  claimType: varchar('claimType', { length: 255 }),
  claimStatus: varchar('claimStatus', { length: 255 }),
  receiverAddressChanged: boolean('receiverAddressChanged'),

  productName: varchar('productName', { length: 255 }),
  productOption: varchar('productOption', { length: 255 }),
  placeOrderDate: timestamp('placeOrderDate'),
  quantity: integer('quantity'),
  totalPaymentAmount: integer('totalPaymentAmount'),
  sellerProductCode: varchar('sellerProductCode', { length: 255 }),
  optionManageCode: varchar('optionManageCode', { length: 255 }),

  customerName: varchar('customerName', { length: 255 }),
  customerPhoneNumber: varchar('customerPhoneNumber', { length: 50 }),
  customerId: varchar('customerId', { length: 255 }),
  customerEmail: varchar('customerEmail', { length: 255 }),

  receiverName: varchar('receiverName', { length: 255 }),
  receiverPhoneNumber: varchar('receiverPhoneNumber', { length: 50 }),

  cancelApprovalDate: timestamp('cancelApprovalDate'),
  cancelCompletedDate: timestamp('cancelCompletedDate'),
  cancelClaimRequestDate: timestamp('cancelClaimRequestDate'),
  refundStandbyStatus: varchar('refundStandbyStatus', { length: 255 }),
  cancelReason: varchar('cancelReason', { length: 255 }),

  returnClaimRequestDate: timestamp('returnClaimRequestDate'),
  returnClaimStatus: varchar('returnClaimStatus', { length: 255 }),
  returnDetailedReason: text('returnDetailedReason'),
  returnReason: varchar('returnReason', { length: 255 }),
  returnCompletedDate: timestamp('returnCompletedDate'),

  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const esims = pgTable('esim', {
  // prod 실타입 BIGINT (backend 확인 2026-08-19) — Maya행 ICCID(8.9e18)가 JS Number
  // 안전범위 밖이라 문자열로 다루기 위해 varchar 선언 유지 (postgres 암시적 캐스트)
  esimId: varchar('esimId', { length: 255 }).primaryKey(),
  apn: varchar('apn', { length: 255 }),
  tag: varchar('tag', { length: 255 }),
  uid: varchar('uid', { length: 255 }),
  iccid: varchar('iccid', { length: 255 }),
  state: varchar('state', { length: 100 }),
  autoApn: varchar('autoApn', { length: 255 }),
  manualCode: varchar('manualCode', { length: 255 }),
  smdpAddress: varchar('smdpAddress', { length: 255 }),
  dateAssigned: timestamp('dateAssigned'),
  networkStatus: varchar('networkStatus', { length: 100 }),
  serviceStatus: varchar('serviceStatus', { length: 100 }),
  activationCode: text('activationCode'),
  // 발급 벤더 스탬프 (backend Spark Wave 1 additive) — NULL ≡ maya
  provider: varchar('provider'),

  // TypeORM 기본 ManyToOne FK naming: `{relation}{ReferencedPK}` → `orderProductOrderId`
  orderId: bigint('orderProductOrderId', { mode: 'number' }).references(
    () => orders.productOrderId,
  ),
})

export const planTypes = pgTable('plan-type', {
  planTypeId: varchar('planTypeId', { length: 255 }).primaryKey(),
  // 발급 벤더 라우팅 스위치 (backend Spark Wave 1) — NULL ≡ maya, 'spark' 면 Spark 발급
  provider: varchar('provider', { length: 255 }),
  planCode: varchar('planCode', { length: 100 }),
  dataCode: varchar('dataCode', { length: 100 }),
  durationCode: varchar('durationCode', { length: 100 }),
  version: varchar('version', { length: 50 }),

  planNameKr: varchar('planNameKr', { length: 255 }),
  planDataTypeKr: varchar('planDataTypeKr', { length: 255 }),
  planDataLimitKr: varchar('planDataLimitKr', { length: 255 }),
  planNameEng: varchar('planNameEng', { length: 255 }),
  planDataTypeEng: varchar('planDataTypeEng', { length: 255 }),
  planDataLimitEng: varchar('planDataLimitEng', { length: 255 }),

  planDataDuration: integer('planDataDuration'),
  planCountriesKr: text('planCountriesKr').array(),
  planCountriesEng: text('planCountriesEng').array(),
  planCountriesIso: text('planCountriesIso').array(),
  timeZones: text('timeZones').array(),

  uid: varchar('uid', { length: 255 }),
  name: varchar('name', { length: 255 }),
  policyId: integer('policyId'),
  policyName: varchar('policyName', { length: 255 }),
  dataQuotaMb: integer('dataQuotaMb'),
  validityDays: integer('validityDays'),
  countriesEnabled: text('countriesEnabled').array(),
})

export const plans = pgTable('plan', {
  planId: serial('planId').primaryKey(),
  id: varchar('id', { length: 255 }),
  // 발급 벤더 스탬프 (backend Spark Wave 1 additive) — NULL ≡ maya
  provider: varchar('provider'),
  isActivated: boolean('isActivated'),
  activatedAt: timestamp('activatedAt'),
  timeToBeActivatedInUTC: timestamp('timeToBeActivatedInUTC'),
  timeToBeActivatedInLocal: timestamp('timeToBeActivatedInLocal'),

  startDateEntered: varchar('startDateEntered', { length: 50 }),
  startTimeEntered: integer('startTimeEntered'),
  startTimeZoneEntered: varchar('startTimeZoneEntered', { length: 100 }),
  startCountryEntered: varchar('startCountryEntered', { length: 100 }),

  startTime: timestamp('startTime'),
  endTime: timestamp('endTime'),

  networkStatus: varchar('networkStatus', { length: 100 }),
  dataQuotaBytes: bigint('dataQuotaBytes', { mode: 'number' }),
  dataBytesRemaining: bigint('dataBytesRemaining', { mode: 'number' }),
  countriesEnabled: text('countriesEnabled').array(),

  // TypeORM 기본 FK naming
  esimId: varchar('esimEsimId', { length: 255 }).references(() => esims.esimId),
  planTypeId: varchar('planTypePlanTypeId', { length: 255 }).references(() => planTypes.planTypeId),

  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// ── Spark 벤더 원장 테이블 (backend vendor-core migration, prod 기적용) ──
// 소유권 규약: spark_package_template / spark_plan_type 은 backend 소유 — client READ-ONLY.
// client 가 쓰는 테이블: esim_issuance / esim / spark_esim / plan / spark_plan.

// 공통 발급 원장 — 벤더 콜 1건 = 1행, FK 없음.
// live 상태 (FAILED/ABANDONED/SUPERSEDED 외) 에 idempotency_key partial unique index
// → 23505 = 동시 발급 진행 중 신호
export const esimIssuance = pgTable('esim_issuance', {
  esimIssuanceId: bigserial('esim_issuance_id', { mode: 'number' }).primaryKey(),
  idempotencyKey: varchar('idempotency_key').notNull(), // '{productOrderId}-{unitIndex}' (0-base)
  productOrderId: bigint('product_order_id', { mode: 'number' }),
  planTypeId: varchar('plan_type_id'),
  unitIndex: integer('unit_index'),
  attempt: integer('attempt').notNull().default(1),
  provider: varchar('provider').notNull(),
  state: varchar('state').notNull(),
  apiMethod: varchar('api_method'),
  vendorRef: varchar('vendor_ref'), // spark:subscriberId
  requestPayload: jsonb('request_payload'),
  responsePayload: jsonb('response_payload'),
  profilePayload: jsonb('profile_payload'),
  statusCode: integer('status_code'),
  errorMessage: varchar('error_message'),
  esimId: bigint('esim_id', { mode: 'number' }),
  planId: integer('plan_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
})

// 카탈로그 캐시 — backend cron 소유, client READ-ONLY
export const sparkPackageTemplates = pgTable('spark_package_template', {
  sparkPackageTemplateId: bigint('spark_package_template_id', { mode: 'number' }).primaryKey(),
  templateName: varchar('template_name'),
  dataByte: bigint('data_byte', { mode: 'number' }),
  periodDays: integer('period_days'),
  isRecurring: boolean('is_recurring'),
  nbOccurrence: integer('nb_occurrence'),
  costEur: numeric('cost_eur'),
  deleted: boolean('deleted'),
})

// 상품 매핑 — backend/수동 관리, client READ-ONLY
export const sparkPlanTypes = pgTable('spark_plan_type', {
  sparkPlanTypeId: bigserial('spark_plan_type_id', { mode: 'number' }).primaryKey(),
  planTypeId: varchar('plan_type_id').notNull(),
  sparkPackageTemplateId: bigint('spark_package_template_id', { mode: 'number' }).notNull(),
  enabled: boolean('enabled'),
})

// 발급 vendor-literal 레코드 (esim 1:1). CHECK: url_qr_code LIKE 'LPA:1$%',
// activation_code NOT LIKE 'LPA:%' — 이름충돌 매핑 주의 (spark-mapping.ts)
export const sparkEsims = pgTable('spark_esim', {
  sparkEsimId: bigserial('spark_esim_id', { mode: 'number' }).primaryKey(),
  esimId: bigint('esim_id', { mode: 'number' }).notNull(),
  ocsEsimId: bigint('ocs_esim_id', { mode: 'number' }).notNull(),
  subscriberId: bigint('subscriber_id', { mode: 'number' }).notNull(),
  iccid: varchar('iccid').notNull(),
  sparkSmdpServer: varchar('spark_smdp_server').notNull(),
  sparkActivationCode: varchar('spark_activation_code').notNull(),
  sparkUrlQrCode: varchar('spark_url_qr_code').notNull(),
  userSimName: varchar('user_sim_name'),
  confirmationCode: varchar('confirmation_code'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// 구매 (=recurring) 레코드 + 잔량 스냅샷 (plan 1:1)
export const sparkPlans = pgTable('spark_plan', {
  sparkPlanId: bigserial('spark_plan_id', { mode: 'number' }).primaryKey(),
  planId: integer('plan_id').notNull(),
  subscriberId: bigint('subscriber_id', { mode: 'number' }).notNull(),
  sparkPackageTemplateId: bigint('spark_package_template_id', { mode: 'number' }).notNull(),
  isRecurring: boolean('is_recurring').notNull().default(false),
  firstSubsPackageId: bigint('first_subs_package_id', { mode: 'number' }),
  recurringId: bigint('recurring_id', { mode: 'number' }), // v2 후속조회 backfill (backend 소관)
  nbOccurrence: integer('nb_occurrence'),
  startTimeUtc: timestamp('start_time_utc', { withTimezone: true }), // 사용자 입력 -12h
  costEur: numeric('cost_eur'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// 발급 동의 기록(client-consent-log spec F-1) — write: client(발급 동의 INSERT · activate) · backend read 0 · 보존 5년(전자상거래법 6조 — DROP · DELETE 금지).
// 스키마 주인 = backend entity(consent-log.entity.ts) + 위키 마이그레이션 SQL — drizzle-kit push 금지. 이 표는 snake_case(TypeORM camelCase 아님).
// prod 실측(2026-11-01) 14컬럼 미러 · FK/UNIQUE/CHECK 없음(INSERT 실패 = 발급 차단이라 두지 않는다). service_user_id 는 MEMBER 소관 — 이 트랙은 쓰지 않는다
export const consentLog = pgTable('consent_log', {
  consentLogId: bigserial('consent_log_id', { mode: 'number' }).primaryKey(),
  channel: varchar('channel', { length: 32 }).notNull(),
  orderRef: varchar('order_ref', { length: 64 }),
  // 네이버 상품주문번호 16자리 < 2^53 — orders.productOrderId 와 같은 선언
  productOrderId: bigint('product_order_id', { mode: 'number' }),
  consentKind: varchar('consent_kind', { length: 32 }).notNull(),
  textVersion: varchar('text_version', { length: 32 }).notNull(),
  textHash: char('text_hash', { length: 64 }).notNull(),
  lineCount: smallint('line_count'),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }).notNull(),
  actor: varchar('actor', { length: 32 }).notNull(),
  ipHash: char('ip_hash', { length: 64 }),
  userAgent: varchar('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  serviceUserId: bigint('service_user_id', { mode: 'number' }),
})

// ── 회원(MEMBER) — member-client-auth spec F-1 ──
// 스키마 주인 = backend entity(packages/shared · service-user/*) + 위키 SQL(2026-10-15 rev 2 · 2026-11-11 A1) — drizzle-kit push 금지.
// prod 실측(2026-11-11 · pg_catalog) 열 · 형 · NULL · 기본값 그대로. CHECK(challenge kind · web_order 상태 · 채널 · 금액 · 수량)와
// 부분 UNIQUE(uq_service_user_phone_hash_active · uq_service_user_order_link_live · uq_web_order_service_user_created)는 DB 가 지킨다 — 여기 선언하지 않는다.
// bigint 는 mode 'number'(consent_log 선례 — 행 수 < 2^53). 평문 PII 열 없음 — *_enc = v1 암호문 · *_hash = HMAC hex(server/utils/member-pii.ts)

export const serviceUser = pgTable('service_user', {
  serviceUserId: bigserial('service_user_id', { mode: 'number' }).primaryKey(),
  // active · withdrawn · suspended(운영 정지 — spec D-10 · CHECK 없음)
  status: varchar('status', { length: 16 }).notNull(),
  emailEnc: varchar('email_enc'),
  emailHash: char('email_hash', { length: 64 }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  nameEnc: varchar('name_enc'),
  phoneEnc: varchar('phone_enc'),
  phoneHash: char('phone_hash', { length: 64 }),
  phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
  marketingSmsAgreedAt: timestamp('marketing_sms_agreed_at', { withTimezone: true }),
  marketingEmailAgreedAt: timestamp('marketing_email_agreed_at', { withTimezone: true }),
  marketingKakaoAgreedAt: timestamp('marketing_kakao_agreed_at', { withTimezone: true }),
  age14ConfirmedAt: timestamp('age14_confirmed_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
})

// 로그인 수단(회원 1 : N) — provider google · naver · kakao · email · 예약 apple. email 은 provider_subject = 정규화 이메일 HMAC hex
export const serviceUserIdentity = pgTable('service_user_identity', {
  serviceUserIdentityId: bigserial('service_user_identity_id', { mode: 'number' }).primaryKey(),
  serviceUserId: bigint('service_user_id', { mode: 'number' }).notNull(),
  provider: varchar('provider', { length: 16 }).notNull(),
  providerSubject: varchar('provider_subject').notNull(),
  passwordHash: varchar('password_hash'),
  providerEmailEnc: varchar('provider_email_enc'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
})

// 세션 — 불투명 토큰의 SHA-256 hex 만(token_hash UNIQUE) · platform web · mobile
export const serviceUserSession = pgTable('service_user_session', {
  serviceUserSessionId: bigserial('service_user_session_id', { mode: 'number' }).primaryKey(),
  serviceUserId: bigint('service_user_id', { mode: 'number' }).notNull(),
  tokenHash: char('token_hash', { length: 64 }).notNull(),
  platform: varchar('platform', { length: 16 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

// 회원 ↔ 외부 채널(네이버) 주문 링크 — A4 가 쓴다. 이 트랙은 탈퇴 때 DELETE 만
export const serviceUserOrderLink = pgTable('service_user_order_link', {
  serviceUserOrderLinkId: bigserial('service_user_order_link_id', { mode: 'number' }).primaryKey(),
  serviceUserId: bigint('service_user_id', { mode: 'number' }).notNull(),
  channel: varchar('channel', { length: 32 }).notNull(),
  productOrderId: bigint('product_order_id', { mode: 'number' }).notNull(),
  orderRef: varchar('order_ref', { length: 64 }).notNull(),
  matchMethod: varchar('match_method', { length: 16 }).notNull(),
  matchedRole: varchar('matched_role', { length: 16 }).notNull(),
  linkedAt: timestamp('linked_at', { withTimezone: true }).defaultNow().notNull(),
  unlinkedAt: timestamp('unlinked_at', { withTimezone: true }),
})

// 가입 코드 · 재설정 토큰 · 로그인 실패(A1 DDL · write client 만 · backend read 0) — 평문 이메일 · 코드 · 토큰 0
export const serviceUserChallenge = pgTable('service_user_challenge', {
  serviceUserChallengeId: bigserial('service_user_challenge_id', { mode: 'number' }).primaryKey(),
  // email_signup_code · password_reset · login_failure (DB CHECK)
  kind: varchar('kind', { length: 24 }).notNull(),
  targetHash: char('target_hash', { length: 64 }).notNull(),
  secretHash: char('secret_hash', { length: 64 }),
  attemptCount: integer('attempt_count').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// 자체 구매 주문(A1 DDL) — ⛔ 이 트랙은 write 0(A3 소관) · 탈퇴 경고 건수만 읽는다. payment_key 는 로그 0
export const webOrder = pgTable('web_order', {
  webOrderId: bigserial('web_order_id', { mode: 'number' }).primaryKey(),
  masterOrderId: bigint('master_order_id', { mode: 'number' }).notNull(),
  serviceUserId: bigint('service_user_id', { mode: 'number' }).notNull(),
  channel: varchar('channel', { length: 8 }).notNull(),
  tossOrderId: varchar('toss_order_id', { length: 64 }).notNull(),
  paymentKey: varchar('payment_key', { length: 200 }),
  amountKrw: integer('amount_krw').notNull(),
  unitPriceKrw: integer('unit_price_krw').notNull(),
  planTypeId: varchar('plan_type_id').notNull(),
  quantity: integer('quantity').notNull(),
  status: varchar('status', { length: 16 }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  issuedAt: timestamp('issued_at', { withTimezone: true }),
  canceledAt: timestamp('canceled_at', { withTimezone: true }),
  refundedAt: timestamp('refunded_at', { withTimezone: true }),
  receiptUrl: varchar('receipt_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const ordersRelations = relations(orders, ({ many }) => ({
  esims: many(esims),
}))

export const esimsRelations = relations(esims, ({ one, many }) => ({
  order: one(orders, {
    fields: [esims.orderId],
    references: [orders.productOrderId],
  }),
  plans: many(plans),
}))

export const planTypesRelations = relations(planTypes, ({ many }) => ({
  plans: many(plans),
}))

export const plansRelations = relations(plans, ({ one }) => ({
  esim: one(esims, {
    fields: [plans.esimId],
    references: [esims.esimId],
  }),
  planType: one(planTypes, {
    fields: [plans.planTypeId],
    references: [planTypes.planTypeId],
  }),
}))

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert
export type Esim = typeof esims.$inferSelect
export type NewEsim = typeof esims.$inferInsert
export type PlanType = typeof planTypes.$inferSelect
export type Plan = typeof plans.$inferSelect
export type NewPlan = typeof plans.$inferInsert
