<script setup lang="ts">
// S-4c 새 비밀번호(member-client-auth ⑤ · D-8) — 토큰은 주소 프래그먼트(#)에만: 서버 · CloudFront 로그 · Referer 0.
// 진입 때 읽고 주소에서 지운 뒤 서버에 유효 여부를 묻는다(무효 · 없음 → E-12). 완료 → 모든 세션 끊김 → 로그인(E-11)
import { NButton, NLoaderDialog } from '@imjohnkoo/design-vue'
import MemberShell from '~/components/member/MemberShell.vue'
import MemberDialog from '~/components/member/MemberDialog.vue'
import PasswordField from '~/components/member/PasswordField.vue'
import { MEMBER_DIALOG, MEMBER_FIELD, MEMBER_MIN_PASSWORD } from '~/content/member'

definePageMeta({ layout: 'flow', middleware: 'member' })
useHead({ title: '새 비밀번호' })

const state = ref<'checking' | 'form' | 'invalid'>('checking')
const token = ref('')
const password = ref('')
const pwErr = ref('')
const busy = ref(false)
const failed = ref(false)

onMounted(async () => {
  token.value = window.location.hash.slice(1)
  // 주소창 · 방문 기록에서 토큰을 지운다
  if (window.location.hash) history.replaceState(history.state, '', window.location.pathname)
  if (!/^[A-Za-z0-9_-]{43}$/.test(token.value)) {
    state.value = 'invalid'
    return
  }
  try {
    await authPost('password-reset/check', { token: token.value })
    state.value = 'form'
  } catch {
    state.value = 'invalid'
  }
})

async function submit() {
  pwErr.value = [...password.value].length >= MEMBER_MIN_PASSWORD ? '' : MEMBER_FIELD.e8
  if (pwErr.value) return
  busy.value = true
  try {
    await authPost('password-reset/confirm', { token: token.value, password: password.value })
    useMemberFlash().value = 'e11'
    await loadAuthSession(true)
    await navigateTo('/login')
  } catch (e) {
    const c = (e as AuthApiError).code
    if (c === 'TOKEN_INVALID') state.value = 'invalid'
    else if (c === 'WEAK_PASSWORD') pwErr.value = MEMBER_FIELD.e8
    else failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <MemberShell
    v-if="state === 'invalid'"
    eyebrow="비밀번호 재설정"
    title="링크를 쓸 수 있는 시간이 지났어요"
    description="비밀번호 재설정 링크를 다시 받아 주세요."
    @back="navigateTo('/login')"
  >
    <template #cta>
      <NButton variant="primary" size="xl" full-width @click="navigateTo('/password/reset')"
        >링크 다시 받기</NButton
      >
    </template>
  </MemberShell>

  <MemberShell
    v-else
    eyebrow="비밀번호 재설정"
    :title="`새 비밀번호를\n정해 주세요`"
    @back="navigateTo('/login')"
  >
    <form
      v-if="state === 'form'"
      id="reset-new-form"
      class="member-form"
      novalidate
      @submit.prevent="submit"
    >
      <PasswordField
        v-model="password"
        input-id="reset-new-password"
        autocomplete="new-password"
        :error="pwErr"
        :hint="`${MEMBER_MIN_PASSWORD}자 이상`"
      />
    </form>
    <template #cta>
      <NButton
        type="submit"
        form="reset-new-form"
        variant="primary"
        size="xl"
        full-width
        :loading="busy"
        :disabled="busy || state !== 'form'"
      >
        비밀번호 바꾸기
      </NButton>
    </template>
  </MemberShell>

  <NLoaderDialog :model-value="state === 'checking'" title="링크를 확인하고 있어요" />
  <MemberDialog
    v-if="failed"
    :model-value="true"
    v-bind="MEMBER_DIALOG.e30"
    @confirm="failed = false"
  />
</template>
