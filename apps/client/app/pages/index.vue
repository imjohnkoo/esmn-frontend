<script setup lang="ts">
// 랜딩 안내 — 발급 흐름은 주문별 링크 (/verify/{orderId}) 로만 진입.
// 직접 접속한 방문자에게 이용 방법을 안내한다.
import { NLogo } from '@imjohnkoo/design-vue'
import IssuerBusinessInfo from '~/components/legal/IssuerBusinessInfo.vue'
</script>

<template>
  <div class="landing-page">
    <div class="landing-page__card">
      <NLogo variant="kor" size="md" aria-label="eSIM마니" />
      <h1 class="landing-page__title">
        eSIM 발급은<br />
        주문 안내 링크로 접속해 주세요
      </h1>
      <p class="landing-page__desc">
        스마트스토어에서 주문하시면<br />
        QR 코드를 발급할 수 있는 링크를 보내드려요.<br />
        받으신 링크로 접속하면 발급이 시작돼요.
      </p>

      <div class="landing-page__note">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        <p>
          링크를 받지 못하셨거나 문제가 있다면<br />
          스마트스토어 채팅 문의로 연락해 주세요.
        </p>
      </div>

      <NuxtLink to="/supported-devices" class="landing-page__link">
        eSIM 지원 기기 확인하기
      </NuxtLink>
    </div>

    <!-- ⏳ 임시(client-shell spec D-36) — W1-2 홈 · 푸터 머지 때 걷어 낸다 -->
    <IssuerBusinessInfo class="landing-page__biz" />
  </div>
</template>

<style scoped>
.landing-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 24px;
  background: #ffffff;
}

.landing-page__card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.landing-page__title {
  margin: 24px 0 0;
  font-size: 22px;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
}

.landing-page__desc {
  margin: 14px 0 0;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.65;
}

.landing-page__note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 28px;
  padding: 14px 16px;
  background: #f9fafb;
  border-radius: 14px;
  text-align: left;
}

.landing-page__note svg {
  flex-shrink: 0;
  margin-top: 2px;
  color: #6239ff;
}

.landing-page__note p {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
}

.landing-page__biz {
  max-width: 400px;
}

.landing-page__link {
  margin-top: 20px;
  font-size: 14px;
  font-weight: 600;
  color: #6239ff;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
