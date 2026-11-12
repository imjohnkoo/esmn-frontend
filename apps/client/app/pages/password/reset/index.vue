<script setup lang="ts">
// S-4a · 4b 재설정 요청(member-client-auth ⑤ · 패킷 M-4a · M-4b) — 가입 여부와 상관없이 언제나 4b(E-9 · I-2)
import { NButton, NInput } from '@imjohnkoo/design-vue'
import MemberShell from '~/components/member/MemberShell.vue'
import MemberDialog from '~/components/member/MemberDialog.vue'
import { EMAIL_PATTERN, MEMBER_DIALOG, MEMBER_FIELD } from '~/content/member'

definePageMeta({ layout: 'flow', middleware: 'member' })
useHead({ title: '비밀번호 재설정' })

const email = ref('')
const emailErr = ref('')
const busy = ref(false)
const sent = ref(false)
const failed = ref(false)

async function submit() {
  emailErr.value = EMAIL_PATTERN.test(email.value.trim()) ? '' : MEMBER_FIELD.e2
  if (emailErr.value) return focusFirstInvalidIn('reset-form')
  busy.value = true
  try {
    await authPost('password-reset', { email: email.value })
    sent.value = true
  } catch (e) {
    if ((e as AuthApiError).code === 'INVALID_EMAIL') {
      emailErr.value = MEMBER_FIELD.e2
      focusFirstInvalidIn('reset-form')
    } else failed.value = true
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <MemberShell
    eyebrow="비밀번호 재설정"
    :title="sent ? '메일을 확인해 주세요' : `가입한 이메일을\n입력해 주세요`"
    :description="
      sent
        ? '가입한 이메일이라면 비밀번호를 바꿀 수 있는 링크가 도착해요. 링크는 30분 동안 쓸 수 있어요.'
        : '비밀번호를 바꿀 수 있는 링크를 보내 드려요.'
    "
    @back="navigateTo('/login')"
  >
    <form v-if="!sent" id="reset-form" class="member-form" novalidate @submit.prevent="submit">
      <div>
        <NInput
          id="reset-email"
          v-model="email"
          variant="underline"
          label="이메일"
          aria-label="이메일"
          type="email"
          autocomplete="email"
          inputmode="email"
          :error="!!emailErr"
          :aria-invalid="emailErr ? 'true' : undefined"
          :aria-describedby="emailErr ? 'reset-email-err' : undefined"
        />
        <p v-if="emailErr" id="reset-email-err" class="member-err" role="alert">{{ emailErr }}</p>
      </div>
    </form>
    <template #cta>
      <NButton
        v-if="!sent"
        type="submit"
        form="reset-form"
        variant="primary"
        size="xl"
        full-width
        :loading="busy"
        :disabled="busy"
      >
        링크 받기
      </NButton>
      <NButton v-else variant="primary" size="xl" full-width @click="navigateTo('/login')"
        >로그인으로 돌아가기</NButton
      >
    </template>
  </MemberShell>

  <MemberDialog v-model="failed" v-bind="MEMBER_DIALOG.e30" />
</template>
