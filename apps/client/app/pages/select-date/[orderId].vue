<script setup lang="ts">
import {
  NStepProgress,
  NPageHeading,
  NInfoChip,
  NFieldCard,
  NHighlightCard,
  NTrustNote,
  NDurationCalendar,
  NBottomSheet,
  NButton,
  NCheckbox,
  NAlertDialog,
  NLoaderDialog,
} from '@imjohnkoo/design-vue'
import type { CalDate } from '@imjohnkoo/design-vue'
import { addDays, format } from 'date-fns'
import { useOrderStore } from '~/stores/order'
import { useApi } from '~/composables/useApi'
import type { Order } from '~/types/order'
import { findProductOrder } from '~/utils/flow-guard'

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const api = useApi()

const orderId = computed(() => Number(route.params.orderId))
const order = computed(() => orderStore.singleOrder)

const combinedCountries = computed(() => {
  if (!order.value) return []
  return order.value.planCountriesKr.map((country, index) => ({
    kr: country,
    en: order.value?.planCountriesEng[index] || '',
    iso: order.value?.planCountriesIso[index] || '',
    timeZone: order.value?.timeZones[index] || '',
  }))
})

const selectedCountry = ref<string>('')
const selectedDate = ref<CalDate | null>(null)

const errors = ref<{ country?: string; date?: string }>({})

const isCountrySheetOpen = ref(false)
const isDateSheetOpen = ref(false)
const isSubmitting = ref(false)
const isPolicyAgreed = ref(false)
const isIssueQrCodesVisible = ref(false)
const isNoOrderAlertVisible = ref(false)
const isCancelledOrderVisible = ref(false)
const isConfirmOrderVisible = ref(false)

const formatDate = (d: CalDate | null) => {
  if (!d) return ''
  const dow = ['일', '월', '화', '수', '목', '금', '토']
  const js = new Date(d.year, d.month - 1, d.day)
  return `${d.year}.${String(d.month).padStart(2, '0')}.${String(d.day).padStart(2, '0')} (${dow[js.getDay()]})`
}

const endDateLabel = computed(() => {
  if (!selectedDate.value || !order.value) return ''
  const start = new Date(
    selectedDate.value.year,
    selectedDate.value.month - 1,
    selectedDate.value.day,
  )
  const end = addDays(start, order.value.planDataDuration)
  const dow = ['일', '월', '화', '수', '목', '금', '토']
  return `${format(end, 'yyyy.MM.dd')} (${dow[end.getDay()]})`
})

const startDateLabel = computed(() => formatDate(selectedDate.value))

const countryLabel = computed(() => {
  if (!selectedCountry.value) return ''
  const c = combinedCountries.value.find((c) => c.kr === selectedCountry.value)
  return c ? `${c.kr} · ${c.timeZone}` : selectedCountry.value
})

const getTimeZone = () => {
  const c = combinedCountries.value.find((c) => c.kr === selectedCountry.value)
  return c?.timeZone || 'Asia/Seoul'
}

const onCountrySelect = (kr: string) => {
  selectedCountry.value = kr
  isCountrySheetOpen.value = false
  errors.value.country = undefined
}

const onDateConfirm = () => {
  if (selectedDate.value) errors.value.date = undefined
  isDateSheetOpen.value = false
}

const validate = () => {
  errors.value = {}
  if (!selectedCountry.value) errors.value.country = '국가를 선택해 주세요.'
  if (!selectedDate.value) errors.value.date = '시작 날짜를 선택해 주세요.'
  return Object.keys(errors.value).length === 0
}

const onSubmit = () => {
  if (!validate()) return

  if (order.value && selectedDate.value) {
    const start = new Date(
      selectedDate.value.year,
      selectedDate.value.month - 1,
      selectedDate.value.day,
    )
    const end = addDays(start, order.value.planDataDuration)

    // startTime = -24: backend createUTCDateTime 이 addHours(midnight, -24) 로
    // timeToBeActivatedInUTC 를 (선택일 -1 day) 00:00 현지시각으로 저장 → eSIM
    // 사전 활성화 버퍼. startDate 는 사용자가 선택한 날짜 그대로.
    const updatedOrder: Order = {
      ...order.value,
      startDate: format(start, 'yyyy-MM-dd'),
      endDate: format(end, 'yyyy-MM-dd'),
      startTime: -24,
      startTimeZone: getTimeZone(),
      startCountry: selectedCountry.value,
    }
    orderStore.setSingleOrder(updatedOrder)
    isPolicyAgreed.value = false
    isConfirmOrderVisible.value = true
  } else {
    isNoOrderAlertVisible.value = true
    setTimeout(() => {
      isNoOrderAlertVisible.value = false
      router.push(`/verify/${orderId.value}`)
    }, 3000)
  }
}

const onConfirm = async () => {
  if (isSubmitting.value || !isPolicyAgreed.value) return
  isSubmitting.value = true
  isConfirmOrderVisible.value = false
  isIssueQrCodesVisible.value = true

  if (!order.value) {
    isSubmitting.value = false
    isIssueQrCodesVisible.value = false
    isNoOrderAlertVisible.value = true
    setTimeout(() => {
      isNoOrderAlertVisible.value = false
      router.push(`/verify/${orderId.value}`)
    }, 3000)
    return
  }

  await new Promise((resolve) => setTimeout(resolve, 2000))

  try {
    const verifyResponse = await api.verifyOrder({
      orderId: orderId.value,
      phoneNumber: order.value.receiverPhoneNumber,
      fullName: order.value.receiverName,
    })
    const { verified, cancelled } = verifyResponse

    if (verified && !cancelled) {
      // 요청한 상품주문번호를 먼저 잡는다 — 발급을 기다리는 동안 다른 상품을 고르면 store 가 바뀐다
      const requestedProductOrderId = orderStore.singleOrder?.productOrderId
      const activateResponse = await api.activateOrder(orderStore.singleOrder!)
      const { verified: activateVerified, details } = activateResponse
      // 발급한 상품주문을 productOrderId 로 찾는다(D-14 — 위치로 집지 않는다 · flow-guard 순수함수)
      const issued = findProductOrder(details, requestedProductOrderId)
      if (activateVerified && issued) {
        isIssueQrCodesVisible.value = false
        orderStore.setSingleOrder(issued)

        const updatedOrders = await api.verifyOrder({
          orderId: orderId.value,
          phoneNumber: order.value.receiverPhoneNumber,
          fullName: order.value.receiverName,
        })
        if (updatedOrders.details) orderStore.setOrders(updatedOrders.details)

        router.push(`/view/${orderId.value}`)
      } else {
        isSubmitting.value = false
        isIssueQrCodesVisible.value = false
        isNoOrderAlertVisible.value = true
        setTimeout(() => {
          isNoOrderAlertVisible.value = false
          router.push(`/verify/${orderId.value}`)
        }, 2000)
      }
    } else if (verified && cancelled) {
      isSubmitting.value = false
      isIssueQrCodesVisible.value = false
      isCancelledOrderVisible.value = true
      setTimeout(() => {
        isCancelledOrderVisible.value = false
        router.push(`/verify/${orderId.value}`)
      }, 2000)
    } else {
      isSubmitting.value = false
      isIssueQrCodesVisible.value = false
      isNoOrderAlertVisible.value = true
      setTimeout(() => {
        isNoOrderAlertVisible.value = false
        router.push(`/verify/${orderId.value}`)
      }, 2000)
    }
  } catch (error) {
    console.error(error)
    isSubmitting.value = false
    isIssueQrCodesVisible.value = false
    isNoOrderAlertVisible.value = true
    setTimeout(() => {
      isNoOrderAlertVisible.value = false
      router.push(`/verify/${orderId.value}`)
    }, 3000)
  }
}

// 진입 가드는 order-flow 미들웨어 — 선택 없음 · 취소 · 전량 발급이면 주문 목록으로, 부분 발급(이어서 발급)은 통과 (K8 · spec S-8)
// 게스트 발급 4-step 은 헤더 · 하단 탭 없는 flow 레이아웃 (spec D-2)
definePageMeta({ layout: 'flow', middleware: 'order-flow' })

// 발급 화면 고지 문구(client-shell spec D-32 · D-35 — 05-A) — 스크립트 끝에 둔다(typecheck 기준선 줄 번호 불변)
import { ISSUE_NOTICE } from '~/content/legal/issue-notice'
import { confirmScrollFit } from '~/utils/confirm-fit'
import { renderNoticeList } from '~/utils/legal-render'
import IssueConsentLabel from '~/components/legal/IssueConsentLabel.vue'

// 05-A 안내 중 «지원 기기 확인» 1줄만(spec D-43 · D-49 · John 2026-10-03)
const NOTICE_LINES = [ISSUE_NOTICE.device]

// 발급 확인 팝업 — 안내 · 요약만 스크롤하고 동의 체크 · 버튼은 화면 안. 높이는 열릴 때 실제 크기로(utils/confirm-fit)
const confirmScrollEl = ref<HTMLElement | null>(null)
const confirmScrollMax = ref<number | null>(null)
const confirmCompact = ref(false)
const confirmHasMore = ref(false)
const confirmScrollStyle = computed(() =>
  confirmScrollMax.value === null ? undefined : { maxHeight: `${confirmScrollMax.value}px` },
)
const updateConfirmMore = () => {
  const el = confirmScrollEl.value
  confirmHasMore.value = !!el && el.scrollTop + el.clientHeight < el.scrollHeight - 4
}
const fitConfirm = () => {
  const el = confirmScrollEl.value
  const dialog = el?.closest<HTMLElement>('[role="alertdialog"], [role="dialog"]')
  if (!el || !dialog) return
  // 다이얼로그는 layout viewport 에 고정된다 — documentElement.clientHeight(iOS 에서 innerHeight 는 손가락 확대로 줄어든다) ·
  // offsetHeight 는 열림 애니메이션 scale 무관
  const fit = confirmScrollFit(
    document.documentElement.clientHeight,
    dialog.offsetHeight,
    el.offsetHeight,
    confirmCompact.value,
  )
  if (fit.compact && !confirmCompact.value) {
    // 체크를 스크롤 안으로 옮긴 뒤(고정 부분이 줄어든 채) 다시 잰다
    confirmCompact.value = true
    nextTick(fitConfirm)
    return
  }
  confirmScrollMax.value = fit.max
  nextTick(updateConfirmMore)
}
watch(isConfirmOrderVisible, async (open) => {
  if (!open) return
  confirmScrollMax.value = null
  confirmCompact.value = false
  await nextTick()
  requestAnimationFrame(fitConfirm)
})
onMounted(() => window.addEventListener('resize', fitConfirm))
onBeforeUnmount(() => window.removeEventListener('resize', fitConfirm))

// 약관 · 환불 정책 하단 시트(spec D-45 · John 2026-10-03) — 새 탭 대신. 열린 문서 하나 · 시트를 닫아도 확인 팝업 · 체크는 그대로
import type { DocSheetKey } from '~/components/legal/DocSheet.vue'
// 시트(법정 문서 3종 + 지원 기기 본문)는 첫 화면 묶음에서 뺀다
const DocSheet = defineAsyncComponent(() => import('~/components/legal/DocSheet.vue'))

const legalSheet = ref<DocSheetKey | null>(null)
const openLegalSheet = (doc: DocSheetKey) => {
  legalSheet.value = doc
}
// 확인 팝업을 닫으면(뒤로 · 발급) 시트도 닫는다 — 다음에 팝업을 열 때 시트가 먼저 떠 있지 않게
watch(isConfirmOrderVisible, (open) => {
  if (!open) legalSheet.value = null
})

// 안내 줄의 «지원 기기 확인» 도 새 탭 대신 하단 시트(spec D-48 · John 2026-10-03) — 다른 주소는 렌더러 기본(새 탭)
const noticeSheet = (href: string) => (href === '/supported-devices' ? () => openLegalSheet('devices') : undefined)
</script>

<template>
  <div class="select-date-page">
    <div class="select-date-page__top">
      <NStepProgress :step="3" :total="4" label="사용 일시" />
    </div>

    <div class="select-date-page__heading">
      <NPageHeading
        eyebrow="eSIM QR 코드 발급"
        :title="`사용 시작 날짜를\n선택해 주세요`"
        :description="`현지에 도착하는 날짜를 골라 주시면\n그날부터 회선이 자동으로 켜져요.`"
      />
    </div>

    <div class="select-date-page__chip-row">
      <NInfoChip label="주문번호" :value="String(orderId)">
        <template #icon>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M8 2v4M16 2v4M3 10h18" />
          </svg>
        </template>
      </NInfoChip>
      <NInfoChip v-if="order" :value="order.planNameKr">
        <template #icon>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </template>
      </NInfoChip>
    </div>

    <div class="select-date-page__fields">
      <div class="select-date-page__field-wrap">
        <NFieldCard
          label="시작 국가"
          :value="countryLabel"
          placeholder="국가를 선택해 주세요"
          :active="!!selectedCountry"
          :error="!!errors.country"
          @click="isCountrySheetOpen = true"
        />
        <p v-if="errors.country" class="select-date-page__err">{{ errors.country }}</p>
      </div>

      <div class="select-date-page__field-wrap">
        <NFieldCard
          label="시작 날짜"
          :value="startDateLabel"
          placeholder="날짜를 선택해 주세요"
          :active="!!selectedDate"
          :error="!!errors.date"
          @click="isDateSheetOpen = true"
        />
        <p v-if="errors.date" class="select-date-page__err">{{ errors.date }}</p>
      </div>
    </div>

    <div v-if="selectedDate" class="select-date-page__preview">
      <NHighlightCard>
        <template #icon>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 8v4l3 2" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </template>
        eSIM 사용 예상 기간은
        <b style="color: var(--n-color-primary-700)">{{ startDateLabel }} ~ {{ endDateLabel }}</b>
        이에요.
      </NHighlightCard>
    </div>

    <div class="select-date-page__notes">
      <NTrustNote>
        <template #icon>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 7v5l3 2" />
          </svg>
        </template>
        <b style="color: #111827">사용 일수는 첫 연결 시점부터 24시간 단위로 차감돼요.</b><br />
        현지에 도착해 처음 회선이 연결된 순간부터 24시간이 지나면 1일이 차감돼요. 선택한 날짜에
        도착하지 않아도 실제 연결 전까지는 사용일이 줄지 않아요.
      </NTrustNote>
      <div style="height: 8px" />
      <NTrustNote>
        <template #icon>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path
              d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
            />
          </svg>
        </template>
        <b style="color: #111827">다국가 이심은 자동 로밍으로 그대로 사용할 수 있어요.</b><br />
        한 번 개통된 다음에는 포함된 국가들을 오가도 추가 설치나 설정 변경 없이 자동으로 연결돼요.
      </NTrustNote>
    </div>

    <div class="select-date-page__cta">
      <NButton
        type="button"
        variant="primary"
        size="xl"
        full-width
        :disabled="isSubmitting"
        @click="onSubmit"
      >
        QR 코드 발행하기
      </NButton>
    </div>

    <!-- Country bottom sheet -->
    <NBottomSheet v-model="isCountrySheetOpen" title="시작 국가 선택">
      <p class="select-date-page__sheet-desc">
        사용을 시작할 국가를 선택해 주세요.<br />
        시작한 뒤에는 아래 어느 국가로 이동해도 재설치나 재선택 없이 자동으로 연결돼요.
      </p>
      <div class="select-date-page__sheet-list">
        <button
          v-for="c in combinedCountries"
          :key="c.iso"
          type="button"
          class="select-date-page__sheet-row"
          :class="{ 'select-date-page__sheet-row--active': selectedCountry === c.kr }"
          @click="onCountrySelect(c.kr)"
        >
          <span class="select-date-page__sheet-row-main">{{ c.kr }}</span>
          <span class="select-date-page__sheet-row-sub">{{ c.timeZone }}</span>
        </button>
      </div>
    </NBottomSheet>

    <!-- Date bottom sheet -->
    <NBottomSheet v-model="isDateSheetOpen" title="시작 날짜 선택">
      <div class="select-date-page__cal">
        <NDurationCalendar v-model="selectedDate" :duration="order?.planDataDuration || 0" />
      </div>
      <template #footer>
        <NButton variant="primary" size="xl" full-width @click="onDateConfirm"> 선택 완료 </NButton>
      </template>
    </NBottomSheet>

    <!-- Confirm summary -->
    <NAlertDialog
      v-model="isConfirmOrderVisible"
      title="이 내용으로 발급할까요?"
      color="primary"
      :closable="false"
      :width="340"
    >
      <!-- 요약 · 안내만 스크롤 — 필수 동의 체크 · «뒤로 · 발급하기» 는 늘 화면 안(팝업은 페이지 스크롤을 잠근다).
           높이는 열릴 때 실제 크기로 맞춘다(글자 확대 · 작은 화면) · 아래에 더 있으면 흐림 표시 -->
      <div
        class="select-date-page__confirm-scroll-wrap"
        :class="{ 'is-more': confirmHasMore }"
      >
        <div
          ref="confirmScrollEl"
          class="select-date-page__confirm-scroll"
          :style="confirmScrollStyle"
          @scroll="updateConfirmMore"
        >
          <div v-if="order" class="select-date-page__confirm">
            <div class="select-date-page__confirm-row">
              <span>상품</span><b>{{ order.planNameKr }}</b>
            </div>
            <div class="select-date-page__confirm-row">
              <span>시작 국가</span><b>{{ selectedCountry }}</b>
            </div>
            <div class="select-date-page__confirm-row">
              <span>시작 날짜</span><b>{{ startDateLabel }}</b>
            </div>
            <div class="select-date-page__confirm-row">
              <span>사용 기간</span><b>{{ order.planDataDuration }}일</b>
            </div>
            <div class="select-date-page__confirm-row">
              <span>수량</span><b>{{ order.quantity }}개</b>
            </div>
          </div>
          <!-- 고지(05-A 원문 · 약관 12조③ 의 «미리 표시») — 주문 요약 바로 아래(client-shell spec D-42 · John 2026-10-02) -->
          <div class="select-date-page__confirm-policy">
            <svg
              class="select-date-page__confirm-policy-icon"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <!-- 05-A(client-shell spec F-21 · D-43 · D-49) — 제목 + «지원 기기 확인» 1줄 · 링크는 하단 시트(D-48) -->
            <div class="select-date-page__confirm-notice">
              <p class="select-date-page__confirm-notice-title">{{ ISSUE_NOTICE.heading }}</p>
              <component :is="renderNoticeList(NOTICE_LINES, [], { sheet: noticeSheet })" />
            </div>
          </div>
          <!-- 공간이 모자라는 화면(가로 · 글자 크게)에서만 동의 체크를 스크롤 안 끝으로 — 버튼을 지킨다 -->
          <div
            v-if="confirmCompact"
            class="select-date-page__confirm-agree"
          >
            <NCheckbox v-model="isPolicyAgreed"><IssueConsentLabel @open="openLegalSheet" /></NCheckbox>
          </div>
        </div>
      </div>
      <!-- /confirm-scroll -->
      <div
        v-if="!confirmCompact"
        class="select-date-page__confirm-agree"
      >
        <!-- 필수 동의(D-44 · John 2026-10-03) — 문구 안 «이용약관» · «취소·환불 정책» 링크(새 탭) · 따로 있던 링크 줄은 없앴다 · 서버 기록은 W1-6 -->
        <NCheckbox v-model="isPolicyAgreed"><IssueConsentLabel @open="openLegalSheet" /></NCheckbox>
      </div>
      <!-- 약관 · 환불 정책 본문(D-45) — 하단 시트 · 팝업 안에 둔다(중첩 레이어 — 바깥 누름 · X · Esc 는 시트만 닫는다) -->
      <DocSheet v-model="legalSheet" />
      <template #actions>
        <div class="select-date-page__confirm-actions">
          <NButton variant="secondary" @click="isConfirmOrderVisible = false">뒤로</NButton>
          <NButton
            variant="primary"
            :disabled="isSubmitting || !isPolicyAgreed"
            @click="onConfirm"
          >
            eSIM 발급하기
          </NButton>
        </div>
      </template>
    </NAlertDialog>

    <NLoaderDialog
      v-model="isIssueQrCodesVisible"
      title="QR 코드를 발급하고 있어요"
      description="잠시만 기다려주세요…"
    />

    <NAlertDialog
      v-model="isNoOrderAlertVisible"
      title="주문 정보를 찾을 수 없어요"
      color="warning"
      :closable="false"
    >
      <p class="select-date-page__dialog-desc">
        주문번호를 다시 확인해 주세요.<br />본인 확인 페이지로 돌아갈게요.
      </p>
    </NAlertDialog>

    <NAlertDialog
      v-model="isCancelledOrderVisible"
      title="이미 취소된 주문이에요"
      color="warning"
      :closable="false"
    >
      <p class="select-date-page__dialog-desc">
        취소된 주문은 발급할 수 없어요.<br />본인 확인 페이지로 돌아갈게요.
      </p>
    </NAlertDialog>
  </div>
</template>

<style scoped>
.select-date-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 20px 24px 32px;
  background: #ffffff;
}

.select-date-page__heading {
  margin-top: 28px;
}

.select-date-page__chip-row {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.select-date-page__fields {
  margin-top: 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.select-date-page__field-wrap {
  display: flex;
  flex-direction: column;
}

.select-date-page__err {
  margin: 6px 0 0 4px;
  font-size: 12px;
  color: var(--n-color-error-500, #ef4444);
}

.select-date-page__preview {
  margin-top: 20px;
}

.select-date-page__notes {
  margin-top: 16px;
}

.select-date-page__cta {
  margin-top: auto;
  padding-top: 32px;
}

.select-date-page__sheet-desc {
  margin: 0 0 12px;
  padding: 0 12px;
  font-size: 13px;
  line-height: 1.55;
  color: #64748b;
  text-align: center;
  word-break: keep-all;
}

.select-date-page__sheet-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.select-date-page__sheet-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  width: 100%;
  padding: 14px 12px;
  border: none;
  background: transparent;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: background 120ms ease;
}

.select-date-page__sheet-row:hover {
  background: #f8fafc;
}

.select-date-page__sheet-row--active {
  background: var(--n-color-primary-50, #f3efff);
}

.select-date-page__sheet-row-main {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
}

.select-date-page__sheet-row-sub {
  font-size: 11.5px;
  color: #94a3b8;
}

.select-date-page__cal {
  padding: 0 4px 12px;
}

.select-date-page__confirm {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  background: #f9fafb;
  border-radius: 14px;
  padding: 14px;
  font-size: 13px;
}

.select-date-page__confirm-row {
  display: flex;
  justify-content: space-between;
}

.select-date-page__confirm-row span {
  color: #6b7280;
}

.select-date-page__confirm-row b {
  font-weight: 600;
  color: #111827;
}

.select-date-page__confirm-scroll-wrap {
  position: relative;
  width: 100%;
}

/* 아래에 더 있으면 흐림 — 스크롤바를 숨기는 모바일에서 «끝» 처럼 보이지 않게 */
.select-date-page__confirm-scroll-wrap.is-more::after {
  content: '';
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: 28px;
  background: linear-gradient(rgba(255, 255, 255, 0), #fff);
  pointer-events: none;
}

/* max-height 는 열릴 때 스크립트가 실제 크기로 덮는다 — 아래는 그 전 · 스크립트가 없을 때의 기본값 */
.select-date-page__confirm-scroll {
  width: 100%;
  max-height: max(120px, calc(100vh - 360px));
  max-height: max(120px, calc(100dvh - 360px));
  overflow-y: auto;
  overscroll-behavior: contain;
}

.select-date-page__confirm-policy {
  margin-top: 10px;
  word-break: keep-all;
  overflow-wrap: break-word;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  background: #fef2f2;
  border-radius: 12px;
  font-size: 12px;
  line-height: 1.55;
  /* 분홍 바탕(#fef2f2) 위 12px — 대비 4.5:1 이상 */
  color: #4b5563;
  text-align: left;
}

.select-date-page__confirm-policy-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: #dc2626;
}

.select-date-page__confirm-policy-link {
  font-weight: 600;
  color: #6239ff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.select-date-page__confirm-notice-title {
  margin: 0 0 6px;
  color: #111827;
  font-weight: 700;
}

.select-date-page__confirm-policy :deep(.issue-notice__list) {
  /* 글머리 점 · 들여쓰기 없이 제목과 같은 폭으로 한 줄씩(John 2026-10-03 화면 피드백) */
  margin: 0;
  padding: 0;
  list-style: none;
}

.select-date-page__confirm-policy :deep(.issue-notice__list li) {
  margin: 0 0 4px;
}

.select-date-page__confirm-policy :deep(.issue-notice__list strong) {
  /* 분홍 바탕(#fef2f2) 위 12px — 대비 4.5:1 이상(약관 12조③ 의 표시 문장) */
  color: #b91c1c;
  font-weight: 600;
}

.select-date-page__confirm-policy :deep(.legal-md__link) {
  font-weight: 600;
  color: #6239ff;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.select-date-page__confirm-policy b {
  display: block;
  margin-bottom: 6px;
  font-weight: 600;
  /* 분홍 바탕(#fef2f2) 위 12px — 대비 4.5:1 이상(약관 12조③ 의 표시 문장) */
  color: #b91c1c;
}

.select-date-page__confirm-agree {
  word-break: keep-all;
  overflow-wrap: break-word;
  width: 100%;
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
  text-align: left;
  font-size: 13px;
}

.select-date-page__confirm-actions {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 8px;
  width: 100%;
}

.select-date-page__dialog-desc {
  margin: -6px 0 0;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
  line-height: 1.55;
}
</style>
