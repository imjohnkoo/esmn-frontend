<script setup lang="ts">
// 설치 가이드 카드 2 + 하단 시트(client-guide F-6 · D-13 · D-15 · D-17 · D-19) — 발급 완료 화면 · 본인 확인 화면이 같이 쓴다.
// 화면을 떠나지 않고(QR · 입력한 이름 · 전화 그대로) 같은 화면 위 하단 시트로 OS 가이드를 본다.
import { NLinkCard } from '@imjohnkoo/design-vue'
import { keepScrollAfterClose } from '~/utils/keep-scroll'
import { GUIDE_PAGES } from '~/content/guide/common'
import type { GuideOs } from '~/content/guide/types'
import GuideSheet from './GuideSheet.vue'

const route = useRoute()
const router = useRouter()

// 설치 가이드 시트에 열 OS(null = 닫힘) — 새 탭 대신 이 화면 위 하단 시트(client-guide D-13).
// 주소의 ?guide=<os> 가 상태다(D-15) — 휴대폰 뒤로 가기가 시트만 닫고 이 화면(QR · 입력한 이름 · 전화)에 남는다. 같은 경로라 스크롤 · 4-step 가드(저장소 주문)는 그대로
const guideOs = computed<GuideOs | null>({
  get: () => {
    const q = route.query.guide
    return q === 'ios' || q === 'android' ? q : null
  },
  set: (os) => setGuide(os),
})
// 바로 앞 기록 칸이 이 주소인가 — vue-router 가 history.state.back 에 앞 칸 주소를 적어 둔다(새로 고침에도 남는다).
// 끝 «/» · «#…» 는 빼고 비교한다(vue-router 는 들어온 주소 그대로 적고, resolve 는 다시 만들어 그 둘이 빠진다)
const samePage = (a: string, b: string) => {
  const norm = (p: string) => p.replace(/#.*$/, '').replace(/\/(?=\?|$)/, '')
  return norm(a) === norm(b)
}
const backIs = (fullPath: string) => {
  if (typeof window === 'undefined') return false
  const back = (window.history.state as { back?: unknown } | null)?.back
  return typeof back === 'string' && samePage(back, fullPath)
}
// 닫는 중 — 앞 칸으로 돌아가는 이동이 끝나기 전에 닫기가 또 오면(두 번 누름 · Esc 여러 번) 한 번만 처리한다(이 화면을 떠나지 않게)
let closing = false
// 시트가 닫히면 reka 가 연 카드로 포커스를 돌려준다(스크롤 옵션 없이) — 카드가 화면 가장자리나 아래 붙은 버튼(D-25) 여백 밑에
// 걸쳐 있으면 페이지가 밀린다. 닫기가 시작되는 곳(X · Esc · 바깥 = setGuide(null), 휴대폰 뒤로 가기 = 주소 변화)에서 바로
// 그 스크롤을 되돌릴 준비를 한다(S-4 «닫으면 화면 그대로» · QA ⑥ R12 m1 · R13 m1) — reka 가 주소보다 먼저 포커스를 돌려줄 수 있다
let stopKeep: (() => void) | undefined
function keepPage() {
  if (typeof window === 'undefined') return
  stopKeep?.()
  stopKeep = keepScrollAfterClose()
}
watch(guideOs, (os, prev) => {
  if (os) return
  closing = false
  if (prev) keepPage()
})
function setGuide(os: GuideOs | null) {
  const query = { ...route.query }
  if (os) {
    query.guide = os
    if (guideOs.value) return router.replace({ query }) // 시트 안 OS 전환 — 기록을 늘리지 않는다
    return router.push({ query })
  }
  if (!guideOs.value || closing) return
  closing = true
  keepPage()
  delete query.guide
  // 앞 칸이 «?guide 없는 이 화면» 이면 그 칸으로 돌아간다(이 화면에서 연 시트 · 앞으로 가기로 다시 연 시트 · 그 뒤 새로 고침 — 기록이 쌓이지 않게).
  // 아니면(?guide 주소로 처음 들어온 시트 — 새 탭 · 밖 링크) 되돌릴 칸이 없으니 ?guide 만 지운다
  if (backIs(router.resolve({ query }).fullPath)) return router.back()
  return router.replace({ query })
}
// 카드 = 사이트판 링크(새 탭)이고 보조키 없는 클릭만 시트로(D-17 — 화면 준비 전 · 보조키 · 가운데 클릭은 링크 그대로).
// 누른 카드에 포커스를 먼저 준다 — Safari 는 눌러도 포커스를 주지 않아, 시트가 «연 요소» 를 body 로 기억하고 닫힌 뒤 포커스를 잃는다(S-4).
// 스크롤은 하지 않는다 — 본인 확인 화면의 아래 붙은 버튼(D-25) 여백 때문에 반쯤 가린 카드를 누르면 뒤 페이지가 밀린다(QA ⑥ R11 m4)
const openGuide = (os: GuideOs, e: MouseEvent) => {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  ;(e.currentTarget as HTMLElement | null)?.focus({ preventScroll: true })
  setGuide(os)
}
</script>

<template>
  <div class="guide-cards">
    <div class="guide-cards__divider"><span>설치 가이드</span></div>
    <div class="guide-cards__list">
      <NLinkCard
        :label="GUIDE_PAGES.ios.label"
        :sub="GUIDE_PAGES.ios.sub"
        :href="GUIDE_PAGES.ios.to"
        external
        :aria-label="`${GUIDE_PAGES.ios.label} — ${GUIDE_PAGES.ios.sub}`"
        aria-haspopup="dialog"
        @click="openGuide('ios', $event)"
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
        :label="GUIDE_PAGES.android.label"
        :sub="GUIDE_PAGES.android.sub"
        :href="GUIDE_PAGES.android.to"
        external
        :aria-label="`${GUIDE_PAGES.android.label} — ${GUIDE_PAGES.android.sub}`"
        aria-haspopup="dialog"
        @click="openGuide('android', $event)"
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
    <GuideSheet v-model="guideOs" />
  </div>
</template>

<style scoped>
.guide-cards__divider {
  margin: 22px 0 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.guide-cards__divider::before,
.guide-cards__divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e5e7eb;
}

.guide-cards__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* 가이드 카드 설명은 설치 방법 목록 — DS 기본(#a3a3a3)은 명암비 2.5:1 이라 한 단계 진하게 · 어절 줄바꿈(«코/드 입력» 0) · 줄간격 1.6(client-guide QA) */
.guide-cards__list :deep(.n-link-card__sub) {
  color: var(--n-color-neutral-500, #737373);
  font-size: 13px;
  line-height: 1.6;
  word-break: keep-all;
}
</style>
