<script setup lang="ts">
// 내 eSIM (spec S-2) — 주문번호로 발급 호스트의 본인 확인(/verify/{주문번호})으로 보낸다. 안내는 옛 랜딩 카피를 잇는다.
import { NPageHeading } from '@imjohnkoo/design-vue'
import OrderLookupForm from '~/components/order/OrderLookupForm.vue'

useHead({ title: '내 eSIM' })
</script>

<template>
  <div class="my-esim">
    <NPageHeading
      eyebrow="내 eSIM"
      :title="`주문번호로\neSIM 을 찾아요`"
      :description="`스마트스토어에서 주문하시면 QR 코드를 발급할 수 있는 링크를 보내드려요.\n링크를 찾기 어렵다면 주문번호를 입력해 주세요.`"
    />

    <div class="my-esim__form">
      <OrderLookupForm input-id="my-esim-order-lookup" />
    </div>

    <ul class="my-esim__help">
      <li>주문번호는 네이버페이 주문 상세에서 확인할 수 있어요.</li>
      <li>링크를 받지 못하셨거나 문제가 있다면 스마트스토어 채팅 문의로 연락해 주세요.</li>
    </ul>

    <NuxtLink to="/supported-devices" class="my-esim__link">eSIM 지원 기기 확인하기</NuxtLink>
  </div>
</template>

<style scoped>
.my-esim {
  display: flex;
  flex-direction: column;
  padding: 28px 20px 32px;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.my-esim__form {
  margin-top: 28px;
}

.my-esim__help {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 24px 0 0;
  padding: 14px 16px 14px 32px;
  border-radius: 14px;
  background: var(--n-color-neutral-50, #fafafa);
  font-size: 13px;
  line-height: 1.6;
  color: var(--n-color-neutral-600, #525252);
}

.my-esim__link {
  align-self: flex-start;
  margin-top: 20px;
  font-size: 14px;
  font-weight: 600;
  color: var(--n-color-primary-600, #5025e8);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
