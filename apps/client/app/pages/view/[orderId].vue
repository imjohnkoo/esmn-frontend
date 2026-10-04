<script setup lang="ts">
import QRCodeVue3 from 'qrcode-vue3'
import {
  NStepProgress,
  NPageHeading,
  NInfoChip,
  NStatusPill,
  NCodeRow,
  NLinkCard,
  NButton,
} from '@imjohnkoo/design-vue'
import { useOrderStore } from '~/stores/order'

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()

const orderId = computed(() => Number(route.params.orderId))
const order = computed(() => orderStore.singleOrder)

// 다발 발급 케이스: 2개 이상이면 accordion 으로 1번만 펼쳐서 시작
const isMulti = computed(() => (order.value?.esims?.length ?? 0) >= 2)
const openIdx = ref<number>(0)
const toggle = (idx: number) => {
  openIdx.value = openIdx.value === idx ? -1 : idx
}

const downloadQR = (index: number) => {
  const canvas = document.querySelector(`#qr-code-${index} canvas`) as HTMLCanvasElement
  if (!canvas) return

  const pngUrl = canvas.toDataURL('image/png').replace('image/png', 'image/octet-stream')
  const downloadLink = document.createElement('a')
  downloadLink.href = pngUrl
  downloadLink.download = `qr-code-${index + 1}.png`
  document.body.appendChild(downloadLink)
  downloadLink.click()
  document.body.removeChild(downloadLink)
}

// 진입 가드는 order-flow 미들웨어 — 주문 없음 → 본인 확인, 선택 없음 · 발급 0 → 주문 목록 (K8 · spec S-8)
// 게스트 발급 4-step 은 헤더 · 하단 탭 없는 flow 레이아웃 (spec D-2)
definePageMeta({ layout: 'flow', middleware: 'order-flow' })
</script>

<template>
  <div class="view-page">
    <div class="view-page__top">
      <NStepProgress :step="4" :total="4" label="발급 완료" />
    </div>

    <div class="view-page__heading">
      <NPageHeading
        eyebrow="eSIM QR 코드 발급"
        :title="`eSIM 발급이\n완료됐어요`"
        :description="`QR 코드를 스캔해서 설치해 주세요.\n현지 도착 후 데이터 로밍을 켜면 자동으로 연결돼요.`"
      />
    </div>

    <div v-if="order" class="view-page__chip-row">
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
      <NInfoChip :value="order.planNameKr">
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
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path
              d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"
            />
          </svg>
        </template>
      </NInfoChip>
    </div>

    <template v-if="order && order.esims && order.esims.length > 0">
      <!-- Single esim — full card without accordion -->
      <div v-if="!isMulti" class="view-page__esim">
        <div class="view-page__esim-head">
          <NStatusPill color="success" dot>발급완료</NStatusPill>
        </div>

        <div class="view-page__qr-wrap">
          <div :id="`qr-code-0`" class="view-page__qr">
            <ClientOnly>
              <QRCodeVue3
                :value="order.esims[0]!.activationCode"
                :width="220"
                :height="220"
                :margin="2"
              />
              <template #fallback>
                <div class="view-page__qr-skeleton" />
              </template>
            </ClientOnly>
          </div>
        </div>

        <div class="view-page__download">
          <NButton variant="secondary" size="md" @click="downloadQR(0)">
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </template>
            QR 코드 다운로드
          </NButton>
        </div>

        <p class="view-page__qr-hint">다운로드가 안 되면 스크린샷으로 저장해 주세요.</p>

        <div class="view-page__divider view-page__divider--ios">
          <span class="view-page__divider-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#111827" aria-hidden="true">
              <path
                d="M19.665 16.811a10.32 10.32 0 0 1-1.021 1.837c-.537.767-.978 1.297-1.316 1.592-.525.482-1.089.73-1.692.744-.432 0-.954-.123-1.563-.373-.61-.249-1.17-.371-1.683-.371-.537 0-1.113.122-1.73.371-.616.25-1.114.381-1.495.393-.577.025-1.154-.229-1.732-.764-.367-.32-.826-.87-1.377-1.648-.59-.829-1.075-1.794-1.456-2.891-.408-1.187-.611-2.335-.611-3.447 0-1.273.275-2.372.826-3.292a4.857 4.857 0 0 1 1.73-1.751 4.65 4.65 0 0 1 2.34-.662c.46 0 1.063.142 1.81.422.745.28 1.224.422 1.434.422.157 0 .688-.166 1.588-.493.852-.303 1.572-.429 2.164-.379 1.604.13 2.809.762 3.611 1.901-1.434.871-2.144 2.091-2.13 3.658.012 1.221.456 2.237 1.33 3.044a4.378 4.378 0 0 0 1.336.871c-.108.31-.221.609-.341.895z"
              />
            </svg>
            아이폰 수동 설치
          </span>
        </div>

        <div class="view-page__codes">
          <NCodeRow label="SM-DP+ 주소" :value="order.esims[0]!.smdpAddress" />
          <NCodeRow label="활성화 코드" :value="order.esims[0]!.manualCode" />
        </div>

        <div class="view-page__divider view-page__divider--android">
          <span class="view-page__divider-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="#3ddc84" aria-hidden="true">
              <path
                d="M17.523 15.34a1.123 1.123 0 1 1 1.122-1.123 1.123 1.123 0 0 1-1.122 1.123m-11.046 0a1.123 1.123 0 1 1 1.123-1.123 1.123 1.123 0 0 1-1.123 1.123m11.45-6.02 2.24-3.879a.465.465 0 0 0-.165-.635.466.466 0 0 0-.635.17l-2.27 3.931a14.107 14.107 0 0 0-11.793 0L3.034 4.976a.467.467 0 0 0-.806.464l2.24 3.88A13.219 13.219 0 0 0 0 19.59h24a13.218 13.218 0 0 0-6.077-10.27"
              />
            </svg>
            안드로이드 수동 설치
          </span>
        </div>

        <div class="view-page__codes">
          <NCodeRow label="LPA 전체" :value="order.esims[0]!.activationCode" />
        </div>
      </div>

      <!-- Multi esim — accordion list, 1번 esim 만 펼쳐서 시작 -->
      <ul v-else class="view-page__list">
        <li
          v-for="(esim, index) in order.esims"
          :key="index"
          class="view-page__row"
          :class="{ 'view-page__row--open': openIdx === index }"
        >
          <button class="view-page__row-head" type="button" @click="toggle(index)">
            <span class="view-page__row-head-left">
              <span class="view-page__row-num">eSIM {{ index + 1 }}</span>
              <NStatusPill color="success" dot>발급완료</NStatusPill>
            </span>
            <svg
              class="view-page__chev"
              :class="{ 'view-page__chev--open': openIdx === index }"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <div v-show="openIdx === index" class="view-page__row-body">
            <div class="view-page__qr-wrap">
              <div :id="`qr-code-${index}`" class="view-page__qr">
                <ClientOnly>
                  <QRCodeVue3 :value="esim.activationCode" :width="200" :height="200" :margin="2" />
                  <template #fallback>
                    <div class="view-page__qr-skeleton" />
                  </template>
                </ClientOnly>
              </div>
            </div>

            <div class="view-page__download">
              <NButton variant="secondary" size="sm" @click="downloadQR(index)">
                QR 다운로드
              </NButton>
            </div>

            <div class="view-page__divider view-page__divider--ios">
              <span class="view-page__divider-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#111827" aria-hidden="true">
                  <path
                    d="M19.665 16.811a10.32 10.32 0 0 1-1.021 1.837c-.537.767-.978 1.297-1.316 1.592-.525.482-1.089.73-1.692.744-.432 0-.954-.123-1.563-.373-.61-.249-1.17-.371-1.683-.371-.537 0-1.113.122-1.73.371-.616.25-1.114.381-1.495.393-.577.025-1.154-.229-1.732-.764-.367-.32-.826-.87-1.377-1.648-.59-.829-1.075-1.794-1.456-2.891-.408-1.187-.611-2.335-.611-3.447 0-1.273.275-2.372.826-3.292a4.857 4.857 0 0 1 1.73-1.751 4.65 4.65 0 0 1 2.34-.662c.46 0 1.063.142 1.81.422.745.28 1.224.422 1.434.422.157 0 .688-.166 1.588-.493.852-.303 1.572-.429 2.164-.379 1.604.13 2.809.762 3.611 1.901-1.434.871-2.144 2.091-2.13 3.658.012 1.221.456 2.237 1.33 3.044a4.378 4.378 0 0 0 1.336.871c-.108.31-.221.609-.341.895z"
                  />
                </svg>
                아이폰 수동 설치
              </span>
            </div>

            <div class="view-page__codes">
              <NCodeRow label="SM-DP+ 주소" :value="esim.smdpAddress" />
              <NCodeRow label="활성화 코드" :value="esim.manualCode" />
            </div>

            <div class="view-page__divider view-page__divider--android">
              <span class="view-page__divider-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="#3ddc84" aria-hidden="true">
                  <path
                    d="M17.523 15.34a1.123 1.123 0 1 1 1.122-1.123 1.123 1.123 0 0 1-1.122 1.123m-11.046 0a1.123 1.123 0 1 1 1.123-1.123 1.123 1.123 0 0 1-1.123 1.123m11.45-6.02 2.24-3.879a.465.465 0 0 0-.165-.635.466.466 0 0 0-.635.17l-2.27 3.931a14.107 14.107 0 0 0-11.793 0L3.034 4.976a.467.467 0 0 0-.806.464l2.24 3.88A13.219 13.219 0 0 0 0 19.59h24a13.218 13.218 0 0 0-6.077-10.27"
                  />
                </svg>
                안드로이드 수동 설치
              </span>
            </div>

            <div class="view-page__codes">
              <NCodeRow label="LPA 전체" :value="esim.activationCode" />
            </div>
          </div>
        </li>
      </ul>

      <!-- 공통 설치 가이드 — single/multi 둘 다 1회만 -->
      <div class="view-page__divider"><span>설치 가이드</span></div>

      <div class="view-page__guides">
        <NLinkCard
          label="아이폰 설치 가이드"
          sub="iOS · Universal Link 자동 설치"
          href="https://esimmany.super.site"
          external
        >
          <template #icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#111827">
              <path
                d="M19.665 16.811a10.32 10.32 0 0 1-1.021 1.837c-.537.767-.978 1.297-1.316 1.592-.525.482-1.089.73-1.692.744-.432 0-.954-.123-1.563-.373-.61-.249-1.17-.371-1.683-.371-.537 0-1.113.122-1.73.371-.616.25-1.114.381-1.495.393-.577.025-1.154-.229-1.732-.764-.367-.32-.826-.87-1.377-1.648-.59-.829-1.075-1.794-1.456-2.891-.408-1.187-.611-2.335-.611-3.447 0-1.273.275-2.372.826-3.292a4.857 4.857 0 0 1 1.73-1.751 4.65 4.65 0 0 1 2.34-.662c.46 0 1.063.142 1.81.422.745.28 1.224.422 1.434.422.157 0 .688-.166 1.588-.493.852-.303 1.572-.429 2.164-.379 1.604.13 2.809.762 3.611 1.901-1.434.871-2.144 2.091-2.13 3.658.012 1.221.456 2.237 1.33 3.044a4.378 4.378 0 0 0 1.336.871c-.108.31-.221.609-.341.895z"
              />
            </svg>
          </template>
        </NLinkCard>
        <NLinkCard
          label="안드로이드 설치 가이드"
          sub="Galaxy · Pixel · QR 등록"
          href="https://esimmany.super.site"
          external
        >
          <template #icon>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#3ddc84">
              <path
                d="M17.523 15.34a1.123 1.123 0 1 1 1.122-1.123 1.123 1.123 0 0 1-1.122 1.123m-11.046 0a1.123 1.123 0 1 1 1.123-1.123 1.123 1.123 0 0 1-1.123 1.123m11.45-6.02 2.24-3.879a.465.465 0 0 0-.165-.635.466.466 0 0 0-.635.17l-2.27 3.931a14.107 14.107 0 0 0-11.793 0L3.034 4.976a.467.467 0 0 0-.806.464l2.24 3.88A13.219 13.219 0 0 0 0 19.59h24a13.218 13.218 0 0 0-6.077-10.27"
              />
            </svg>
          </template>
        </NLinkCard>
      </div>
    </template>

    <div v-else class="view-page__empty">
      <p>주문 정보를 불러오는 중이에요…</p>
    </div>

    <div class="view-page__notes">
      <h2 class="view-page__faq-title">자주 묻는 질문</h2>
      <ul class="view-page__faq">
        <li class="view-page__faq-item">
          <p class="view-page__faq-q"><span>Q.</span>설치는 언제 하면 되나요?</p>
          <p class="view-page__faq-a">
            설치 시점과 사용 시점은 무관해요. 설치는 언제든 하셔도 돼요. 출국하시기 2~3일 전,
            와이파이가 연결된 자택에서 미리 설치하시는 것을 권장드려요.
          </p>
        </li>
        <li class="view-page__faq-item">
          <p class="view-page__faq-q"><span>Q.</span>사용 일수는 언제부터 차감되나요?</p>
          <p class="view-page__faq-a">
            첫 연결 시점부터 24시간 단위로 차감돼요. 현지에 도착해 처음 회선이 연결된 순간부터
            24시간이 지나면 1일이 차감돼요.
          </p>
        </li>
        <li class="view-page__faq-item">
          <p class="view-page__faq-q"><span>Q.</span>여러 국가를 오가며 써도 되나요?</p>
          <p class="view-page__faq-a">
            다국가 이심은 자동 로밍으로 그대로 사용할 수 있어요. 한 번 개통된 다음에는 포함된
            국가들을 오가도 추가 설치나 설정 변경 없이 자동으로 연결돼요.
          </p>
        </li>
      </ul>
    </div>

    <div class="view-page__back">
      <!-- 홈이 판매 사이트가 되어 «처음으로» 의 뜻이 흐려졌다 — 같은 주문의 목록으로 (spec D-5) -->
      <NButton variant="ghost" size="md" full-width @click="router.push(`/details/${orderId}`)">
        주문 목록으로
      </NButton>
    </div>
  </div>
</template>

<style scoped>
.view-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 20px 24px 32px;
  background: #ffffff;
}

.view-page__heading {
  margin-top: 28px;
}

.view-page__chip-row {
  margin-top: 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.view-page__esim {
  margin-top: 24px;
  padding: 20px 18px 22px;
  border: 1px solid #eef2f7;
  border-radius: var(--n-radius-xl, 18px);
  background: #ffffff;
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px -16px rgba(15, 23, 42, 0.12);
}

.view-page__esim-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.view-page__esim-index {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

/* ===== Multi-esim accordion ===== */
.view-page__list {
  margin: 24px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-page__row {
  border: 1px solid #eef2f7;
  border-radius: 14px;
  background: #ffffff;
  overflow: hidden;
  transition:
    box-shadow 160ms ease,
    border-color 160ms ease;
}

.view-page__row--open {
  border-color: var(--n-color-primary-300, #a78bff);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px -16px rgba(15, 23, 42, 0.12);
}

.view-page__row-head {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.view-page__row-head-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.view-page__row-num {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.005em;
}

.view-page__chev {
  color: #94a3b8;
  transition: transform 200ms ease;
}

.view-page__chev--open {
  transform: rotate(180deg);
  color: var(--n-color-primary-500, #6239ff);
}

.view-page__row-body {
  padding: 4px 16px 18px;
  border-top: 1px solid #f1f5f9;
}

.view-page__qr-wrap {
  display: flex;
  justify-content: center;
  margin-top: 14px;
}

.view-page__qr {
  display: flex;
  padding: 12px;
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e5e7eb;
}

.view-page__qr-skeleton {
  width: 220px;
  height: 220px;
  border-radius: 8px;
  background: linear-gradient(90deg, #f3f4f6 0%, #e5e7eb 50%, #f3f4f6 100%);
  background-size: 200% 100%;
  animation: view-page__qr-shimmer 1.4s ease-in-out infinite;
}

@keyframes view-page__qr-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

.view-page__download {
  display: flex;
  justify-content: center;
  margin-top: 14px;
}

.view-page__qr-hint {
  margin: 8px 0 0;
  font-size: 11.5px;
  color: #94a3b8;
  text-align: center;
}

.view-page__divider {
  margin: 22px 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.view-page__divider-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  font-size: 11.5px;
  font-weight: 600;
  color: #475569;
  letter-spacing: -0.005em;
}

.view-page__divider::before,
.view-page__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

.view-page__guides {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.view-page__codes {
  display: flex;
  flex-direction: column;
}

.view-page__notes {
  margin-top: 28px;
}

.view-page__faq-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.view-page__faq {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
}

.view-page__faq-item {
  padding: 14px 2px;
}

.view-page__faq-item + .view-page__faq-item {
  border-top: 1px solid #f3f4f6;
}

.view-page__faq-q {
  display: flex;
  gap: 6px;
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  line-height: 1.5;
}

.view-page__faq-q span {
  color: #6239ff;
}

.view-page__faq-a {
  margin: 6px 0 0;
  padding-left: 21px;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.65;
}

.view-page__empty {
  margin-top: 60px;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}

.view-page__back {
  margin-top: 28px;
}
</style>
