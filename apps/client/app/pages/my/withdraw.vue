<script setup lang="ts">
// S-6 탈퇴(member-client-auth ⑤ · 패킷 M-6 · K-A6 · 법 38조④ «가입보다 어렵지 않게») — 비밀번호 한 칸 + 버튼 하나.
// QR 을 받지 않은 자체 구매 주문이 있으면 맨 위 경고(E-18 · 막지 않음 · D-14). 잠김 = E-3w(로그인과 같은 카운터 · R4)
import { NButton, NLoaderDialog } from '@imjohnkoo/design-vue'
import MemberShell from '~/components/member/MemberShell.vue'
import MemberDialog from '~/components/member/MemberDialog.vue'
import PasswordField from '~/components/member/PasswordField.vue'
import { MEMBER_DIALOG, MEMBER_FIELD, unissuedWarningTitle } from '~/content/member'

definePageMeta({ layout: 'flow', middleware: 'member' })
useHead({ title: '회원 탈퇴' })

const { data } = await useFetch<{ unissuedOrderCount: number }>('/api/v1/auth/withdraw', {
  key: 'withdraw-info',
  default: () => ({ unissuedOrderCount: 0 }),
})
const unissued = computed(() => data.value?.unissuedOrderCount ?? 0)

const password = ref('')
const pwErr = ref('')
const busy = ref(false)
const { key: dialogKey, open: dialogOpen, show } = useMemberDialog<'e3w' | 'e30'>('e30')
const dialogView = computed(() =>
  dialogKey.value === 'e3w'
    ? { ...MEMBER_DIALOG.e3w, secondary: '비밀번호 재설정' }
    : MEMBER_DIALOG.e30,
)

async function submit() {
  if (!password.value) return
  pwErr.value = ''
  busy.value = true
  try {
    await authPost('withdraw', { password: password.value })
    useMemberFlash().value = 'e17'
    await loadAuthSession(true)
    await navigateTo('/my')
  } catch (e) {
    const c = (e as AuthApiError).code
    if (c === 'PASSWORD_MISMATCH') pwErr.value = MEMBER_FIELD.e16
    else if (c === 'UNAUTHENTICATED') await navigateTo('/login?next=%2Fmy%2Fwithdraw')
    else show(c === 'LOGIN_LOCKED' ? 'e3w' : 'e30')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <MemberShell
    eyebrow="회원 탈퇴"
    :title="`탈퇴하기 전에\n확인해 주세요`"
    @back="navigateTo('/my')"
  >
    <div v-if="unissued > 0" class="withdraw__warn" role="alert">
      <p class="withdraw__warn-title">{{ unissuedWarningTitle(unissued) }}</p>
      <p class="withdraw__warn-body">탈퇴하면 이 주문을 다시 찾을 수 없어요.</p>
      <NuxtLink to="/my-esim" class="withdraw__warn-link">주문 보기</NuxtLink>
    </div>
    <ul class="withdraw__lines">
      <li>설치한 eSIM은 탈퇴해도 그대로 쓸 수 있어요.</li>
      <li>주문과 결제 기록은 법에 따라 5년 동안 보관해요.</li>
      <li>불러온 스마트스토어 주문은 연결이 풀려요. 주문번호로는 계속 조회할 수 있어요.</li>
    </ul>
    <form id="withdraw-form" class="member-form" novalidate @submit.prevent="submit">
      <PasswordField
        v-model="password"
        input-id="withdraw-password"
        autocomplete="current-password"
        :error="pwErr"
      />
    </form>
    <template #cta>
      <NButton
        type="submit"
        form="withdraw-form"
        variant="danger"
        size="xl"
        full-width
        :disabled="busy || !password"
        >탈퇴하기</NButton
      >
    </template>
  </MemberShell>

  <NLoaderDialog
    :model-value="busy"
    title="탈퇴를 처리하고 있어요"
    description="잠시만 기다려 주세요."
  />
  <MemberDialog
    v-model="dialogOpen"
    v-bind="dialogView"
    @secondary="navigateTo('/password/reset')"
  />
</template>

<style scoped>
.withdraw__warn {
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--n-color-warning-50, #fffbeb);
}

.withdraw__warn-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: var(--n-color-neutral-900, #171717);
}

.withdraw__warn-body {
  margin: 4px 0 8px;
  font-size: 14px;
  color: var(--n-color-neutral-600, #525252);
}

.withdraw__warn-link {
  font-size: 14px;
  font-weight: 600;
  color: var(--n-color-primary-600, #5025e8);
}

.withdraw__lines {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 14px 16px 14px 32px;
  border-radius: 14px;
  background: var(--n-color-neutral-50, #fafafa);
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-700, #404040);
}
</style>
