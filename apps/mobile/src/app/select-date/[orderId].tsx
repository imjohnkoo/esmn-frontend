import { useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'

import {
  NAlertDialog,
  NBottomSheet,
  NButton,
  NCheckbox,
  NDurationCalendar,
  NFieldCard,
  NHighlightCard,
  NInfoChip,
  NLoaderDialog,
  NPageHeading,
  NStepProgress,
  NTrustNote,
  type CalDate,
} from '@imjohnkoo/design-mobile'

import { FlowScreen, FlowSpacer } from '@/components/flow-screen'
import { api } from '@/lib/api'
import { addDays, calDateToDate, formatDateLabel, toIsoDateString } from '@/lib/date'
import { useOrderStore } from '@/lib/order-store'
import type { Order } from '@/lib/types'

export default function SelectDateScreen() {
  const router = useRouter()
  const { orderId: orderIdParam } = useLocalSearchParams<{ orderId: string }>()
  const orderId = Number(orderIdParam)
  const orderStore = useOrderStore()

  const order = orderStore.singleOrder

  const combinedCountries = useMemo(() => {
    if (!order) return []
    return order.planCountriesKr.map((country, index) => ({
      kr: country,
      en: order.planCountriesEng[index] || '',
      iso: order.planCountriesIso[index] || '',
      timeZone: order.timeZones[index] || '',
    }))
  }, [order])

  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedDate, setSelectedDate] = useState<CalDate | null>(null)
  const [errors, setErrors] = useState<{ country?: string; date?: string }>({})

  const [isCountrySheetOpen, setIsCountrySheetOpen] = useState(false)
  const [isDateSheetOpen, setIsDateSheetOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isPolicyAgreed, setIsPolicyAgreed] = useState(false)
  const [isIssueQrCodesVisible, setIsIssueQrCodesVisible] = useState(false)
  const [isNoOrderAlertVisible, setIsNoOrderAlertVisible] = useState(false)
  const [isCancelledOrderVisible, setIsCancelledOrderVisible] = useState(false)
  // 확인 다이얼로그에 표시/전송할 스냅샷 — setState 비동기와 무관하게 고정
  const [confirmOrder, setConfirmOrder] = useState<Order | null>(null)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout)
    },
    [],
  )

  const backToVerify = (hideDialog: () => void, delay: number) => {
    timers.current.push(
      setTimeout(() => {
        hideDialog()
        router.replace({ pathname: '/verify/[orderId]', params: { orderId: orderIdParam } })
      }, delay),
    )
  }

  useEffect(() => {
    if (!order) {
      setIsNoOrderAlertVisible(true)
      backToVerify(() => setIsNoOrderAlertVisible(false), 3000)
    } else if (order.esims && order.esims.length > 0) {
      router.replace({ pathname: '/details/[orderId]', params: { orderId: orderIdParam } })
    }
    // 최초 진입 가드 — client select-date 페이지 onMounted 와 동일 정책
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startDateLabel = selectedDate ? formatDateLabel(calDateToDate(selectedDate)) : ''
  const endDateLabel =
    selectedDate && order
      ? formatDateLabel(addDays(calDateToDate(selectedDate), order.planDataDuration))
      : ''

  const countryLabel = useMemo(() => {
    if (!selectedCountry) return ''
    const c = combinedCountries.find((c) => c.kr === selectedCountry)
    return c ? `${c.kr} · ${c.timeZone}` : selectedCountry
  }, [selectedCountry, combinedCountries])

  const getTimeZone = () =>
    combinedCountries.find((c) => c.kr === selectedCountry)?.timeZone || 'Asia/Seoul'

  const onCountrySelect = (kr: string) => {
    setSelectedCountry(kr)
    setIsCountrySheetOpen(false)
    setErrors((e) => ({ ...e, country: undefined }))
  }

  const onDateConfirm = () => {
    if (selectedDate) setErrors((e) => ({ ...e, date: undefined }))
    setIsDateSheetOpen(false)
  }

  const validate = () => {
    const next: typeof errors = {}
    if (!selectedCountry) next.country = '국가를 선택해 주세요.'
    if (!selectedDate) next.date = '시작 날짜를 선택해 주세요.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const onSubmit = () => {
    if (!validate()) return
    if (!order || !selectedDate) {
      setIsNoOrderAlertVisible(true)
      backToVerify(() => setIsNoOrderAlertVisible(false), 3000)
      return
    }

    const start = calDateToDate(selectedDate)
    const end = addDays(start, order.planDataDuration)

    // startTime = -24: backend createUTCDateTime 이 addHours(midnight, -24) 로
    // timeToBeActivatedInUTC 를 (선택일 -1 day) 00:00 현지시각으로 저장 → eSIM
    // 사전 활성화 버퍼. startDate 는 사용자가 선택한 날짜 그대로.
    const updatedOrder: Order = {
      ...order,
      startDate: toIsoDateString(start),
      endDate: toIsoDateString(end),
      startTime: -24,
      startTimeZone: getTimeZone(),
      startCountry: selectedCountry,
    }
    orderStore.setSingleOrder(updatedOrder)
    setConfirmOrder(updatedOrder)
    setIsPolicyAgreed(false)
  }

  const onConfirm = async () => {
    if (isSubmitting || !isPolicyAgreed || !confirmOrder) return
    setIsSubmitting(true)
    const target = confirmOrder
    setConfirmOrder(null)
    setIsIssueQrCodesVisible(true)

    try {
      const verifyResponse = await api.verifyOrder({
        orderId,
        phoneNumber: target.receiverPhoneNumber,
        fullName: target.receiverName,
      })
      const { verified, cancelled } = verifyResponse

      if (verified && !cancelled) {
        const activateResponse = await api.activateOrder(target)
        const { verified: activateVerified, details } = activateResponse
        if (activateVerified && details && details[0]) {
          orderStore.setSingleOrder(details[0])

          const updatedOrders = await api.verifyOrder({
            orderId,
            phoneNumber: target.receiverPhoneNumber,
            fullName: target.receiverName,
          })
          if (updatedOrders.details) orderStore.setOrders(updatedOrders.details)

          setIsIssueQrCodesVisible(false)
          setIsSubmitting(false)
          router.push({ pathname: '/view/[orderId]', params: { orderId: orderIdParam } })
        } else {
          setIsSubmitting(false)
          setIsIssueQrCodesVisible(false)
          setIsNoOrderAlertVisible(true)
          backToVerify(() => setIsNoOrderAlertVisible(false), 2000)
        }
      } else if (verified && cancelled) {
        setIsSubmitting(false)
        setIsIssueQrCodesVisible(false)
        setIsCancelledOrderVisible(true)
        backToVerify(() => setIsCancelledOrderVisible(false), 2000)
      } else {
        setIsSubmitting(false)
        setIsIssueQrCodesVisible(false)
        setIsNoOrderAlertVisible(true)
        backToVerify(() => setIsNoOrderAlertVisible(false), 2000)
      }
    } catch (error) {
      console.error(error)
      setIsSubmitting(false)
      setIsIssueQrCodesVisible(false)
      setIsNoOrderAlertVisible(true)
      backToVerify(() => setIsNoOrderAlertVisible(false), 3000)
    }
  }

  return (
    <FlowScreen>
      <NStepProgress step={3} total={4} label="사용 일시" />

      <View style={styles.heading}>
        <NPageHeading
          eyebrow="eSIM QR 코드 발급"
          title={'사용 시작 날짜를\n선택해 주세요'}
          description={'현지에 도착하는 날짜를 골라 주시면\n그날부터 회선이 자동으로 켜져요.'}
        />
      </View>

      <View style={styles.chipRow}>
        <NInfoChip label="주문번호" value={String(orderId)} />
        {order && <NInfoChip value={order.planNameKr} />}
      </View>

      <View style={styles.fields}>
        <View>
          <NFieldCard
            label="시작 국가"
            value={countryLabel}
            placeholder="국가를 선택해 주세요"
            active={!!selectedCountry}
            error={!!errors.country}
            onPress={() => setIsCountrySheetOpen(true)}
          />
          {errors.country && <Text style={styles.err}>{errors.country}</Text>}
        </View>

        <View>
          <NFieldCard
            label="시작 날짜"
            value={startDateLabel}
            placeholder="날짜를 선택해 주세요"
            active={!!selectedDate}
            error={!!errors.date}
            onPress={() => setIsDateSheetOpen(true)}
          />
          {errors.date && <Text style={styles.err}>{errors.date}</Text>}
        </View>
      </View>

      {selectedDate && (
        <View style={styles.preview}>
          <NHighlightCard>
            <Text style={styles.previewText}>
              eSIM 사용 예상 기간은{' '}
              <Text style={styles.previewStrong}>
                {startDateLabel} ~ {endDateLabel}
              </Text>{' '}
              이에요.
            </Text>
          </NHighlightCard>
        </View>
      )}

      <View style={styles.notes}>
        <NTrustNote title="사용 일수는 첫 연결 시점부터 24시간 단위로 차감돼요.">
          {'현지에 도착해 처음 회선이 연결된 순간부터 24시간이 지나면 1일이 차감돼요. 선택한 날짜에 도착하지 않아도 실제 연결 전까지는 사용일이 줄지 않아요.'}
        </NTrustNote>
        <View style={styles.noteGap} />
        <NTrustNote title="다국가 이심은 자동 로밍으로 그대로 사용할 수 있어요.">
          {'한 번 개통된 다음에는 포함된 국가들을 오가도 추가 설치나 설정 변경 없이 자동으로 연결돼요.'}
        </NTrustNote>
      </View>

      <FlowSpacer />

      <View style={styles.cta}>
        <NButton variant="primary" size="xl" fullWidth disabled={isSubmitting} onPress={onSubmit}>
          QR 코드 발행하기
        </NButton>
      </View>

      {/* 시작 국가 bottom sheet */}
      <NBottomSheet
        visible={isCountrySheetOpen}
        onClose={() => setIsCountrySheetOpen(false)}
        title="시작 국가 선택"
      >
        <View style={styles.sheetList}>
          {combinedCountries.map((c) => (
            <TouchableOpacity
              key={c.iso || c.kr}
              style={[styles.sheetRow, selectedCountry === c.kr && styles.sheetRowActive]}
              onPress={() => onCountrySelect(c.kr)}
              activeOpacity={0.7}
            >
              <Text style={styles.sheetRowMain}>{c.kr}</Text>
              <Text style={styles.sheetRowSub}>{c.timeZone}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </NBottomSheet>

      {/* 시작 날짜 bottom sheet */}
      <NBottomSheet
        visible={isDateSheetOpen}
        onClose={() => setIsDateSheetOpen(false)}
        title="시작 날짜 선택"
        footer={
          <NButton variant="primary" size="xl" fullWidth onPress={onDateConfirm}>
            선택 완료
          </NButton>
        }
      >
        <NDurationCalendar
          value={selectedDate}
          onChange={setSelectedDate}
          duration={order?.planDataDuration || 0}
        />
      </NBottomSheet>

      {/* 발급 확인 */}
      <NAlertDialog
        visible={!!confirmOrder}
        title="이 내용으로 발급할까요?"
        color="primary"
        closable={false}
        size="wide"
        actions={
          <View style={styles.confirmActions}>
            <View style={styles.confirmBack}>
              <NButton variant="secondary" fullWidth onPress={() => setConfirmOrder(null)}>
                뒤로
              </NButton>
            </View>
            <View style={styles.confirmGo}>
              <NButton
                variant="primary"
                fullWidth
                disabled={isSubmitting || !isPolicyAgreed}
                onPress={onConfirm}
              >
                발급하기
              </NButton>
            </View>
          </View>
        }
      >
        {confirmOrder && (
          <View style={styles.confirmBox}>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>상품</Text>
              <Text style={styles.confirmVal}>{confirmOrder.planNameKr}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>시작 국가</Text>
              <Text style={styles.confirmVal}>{confirmOrder.startCountry}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>시작 날짜</Text>
              <Text style={styles.confirmVal}>{startDateLabel}</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>사용 기간</Text>
              <Text style={styles.confirmVal}>{confirmOrder.planDataDuration}일</Text>
            </View>
            <View style={styles.confirmRow}>
              <Text style={styles.confirmKey}>수량</Text>
              <Text style={styles.confirmVal}>{confirmOrder.quantity}개</Text>
            </View>
          </View>
        )}
        <View style={styles.confirmPolicy}>
          <Text style={styles.confirmPolicyTitle}>발급 후에는 취소와 환불이 불가해요.</Text>
          <Text style={styles.confirmPolicyBody}>
            사용하실 기기가 eSIM 지원 기기인지 발급 전에 꼭 확인해 주세요.
          </Text>
        </View>
        <View style={styles.confirmAgree}>
          <NCheckbox
            checked={isPolicyAgreed}
            onToggle={setIsPolicyAgreed}
            label="위 내용을 확인했고 동의해요"
          />
        </View>
      </NAlertDialog>

      <NLoaderDialog
        visible={isIssueQrCodesVisible}
        title="QR 코드를 발급하고 있어요"
        description="잠시만 기다려주세요…"
      />

      <NAlertDialog
        visible={isNoOrderAlertVisible}
        title="주문 정보를 찾을 수 없어요"
        color="warning"
        closable={false}
      >
        {'주문번호를 다시 확인해 주세요.\n본인 확인 페이지로 돌아갈게요.'}
      </NAlertDialog>

      <NAlertDialog
        visible={isCancelledOrderVisible}
        title="이미 취소된 주문이에요"
        color="warning"
        closable={false}
      >
        {'취소된 주문은 발급할 수 없어요.\n본인 확인 페이지로 돌아갈게요.'}
      </NAlertDialog>
    </FlowScreen>
  )
}

const styles = StyleSheet.create({
  heading: {
    marginTop: 28,
  },
  chipRow: {
    marginTop: 18,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  fields: {
    marginTop: 28,
    gap: 10,
  },
  err: {
    marginTop: 6,
    marginLeft: 4,
    fontSize: 12,
    color: '#ef4444',
  },
  preview: {
    marginTop: 20,
  },
  previewText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
  },
  previewStrong: {
    fontWeight: '700',
    color: '#4c1d95',
  },
  notes: {
    marginTop: 16,
  },
  noteGap: {
    height: 8,
  },
  cta: {
    paddingTop: 32,
  },
  sheetList: {
    gap: 2,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  sheetRowActive: {
    backgroundColor: '#f3efff',
  },
  sheetRowMain: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  sheetRowSub: {
    fontSize: 11.5,
    color: '#94a3b8',
  },
  confirmBox: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  confirmKey: {
    fontSize: 13,
    color: '#6b7280',
  },
  confirmVal: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'right',
  },
  confirmPolicy: {
    width: '100%',
    marginTop: 10,
    padding: 13,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
  },
  confirmPolicyTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#dc2626',
    marginBottom: 4,
  },
  confirmPolicyBody: {
    fontSize: 12,
    lineHeight: 18,
    color: '#6b7280',
  },
  confirmAgree: {
    width: '100%',
    marginTop: 12,
    alignItems: 'flex-start',
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 8,
  },
  confirmBack: {
    flex: 1,
  },
  confirmGo: {
    flex: 2,
  },
})
