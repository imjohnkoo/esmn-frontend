<script setup lang="ts">
// S-2 로그인(member-client-auth ⑤ · 패킷 M-2) — 계정 유무와 같은 문장(E-1) · 잠금 E-3 · next 는 같은 사이트 경로만(safeNext)
import { NButton, NInput, NTrustNote } from '@imjohnkoo/design-vue'
import MemberShell from '~/components/member/MemberShell.vue'
import MemberDialog from '~/components/member/MemberDialog.vue'
import MemberStatus from '~/components/member/MemberStatus.vue'
import PasswordField from '~/components/member/PasswordField.vue'
import {
  EMAIL_PATTERN,
  MEMBER_DIALOG,
  MEMBER_FIELD,
  MEMBER_FLASH,
  PURCHASE_LOGIN_NOTE,
  isPurchaseNext,
} from '~/content/member'
import { safeNext } from '#shared/utils/safe-next'

definePageMeta({ layout: 'flow', middleware: 'member' })
useHead({ title: '로그인' })

const route = useRoute()
const router = useRouter()
const next = computed(() => safeNext(route.query.next))
const fromPurchase = computed(() => isPurchaseNext(next.value))
const flash = useMemberFlash()
const notice = flash.value ? MEMBER_FLASH[flash.value] : null
// 화면을 떠날 때 지운다 — 도착 직후 다시 마운트돼도(레이아웃 전환 · Suspense) 안내를 잃지 않게(키보드 walk minor)
onBeforeRouteLeave(() => {
  flash.value = null
})

const email = ref('')
const password = ref('')
const emailError = ref('')
const passwordError = ref('')
const busy = ref(false)
const { key: dialogKey, open: dialogOpen, show } = useMemberDialog<'e1' | 'e3' | 'e30'>('e30')
const dialogView = computed(() =>
  dialogKey.value === 'e3'
    ? { ...MEMBER_DIALOG.e3, secondary: '비밀번호 재설정' }
    : MEMBER_DIALOG[dialogKey.value],
)

async function submit() {
  emailError.value = EMAIL_PATTERN.test(email.value.trim()) ? '' : MEMBER_FIELD.e2
  passwordError.value = password.value ? '' : MEMBER_FIELD.pwEmpty
  if (emailError.value || passwordError.value) return focusFirstInvalidIn('login-form')
  busy.value = true
  try {
    await authPost('login', { email: email.value, password: password.value })
    await loadAuthSession(true)
    await navigateTo(next.value)
  } catch (e) {
    const code = (e as AuthApiError).code
    show(code === 'INVALID_CREDENTIALS' ? 'e1' : code === 'LOGIN_LOCKED' ? 'e3' : 'e30')
  } finally {
    busy.value = false
  }
}

// 뒤로 — 구매하기(next)에서 온 고객은 온 곳으로(design-qa 3-11) · 그 밖은 마이
function back() {
  if (route.query.next && window.history.length > 1) router.back()
  else navigateTo('/my')
}

const withNext = (path: string) =>
  route.query.next ? `${path}?next=${encodeURIComponent(next.value)}` : path
</script>

<template>
  <MemberShell eyebrow="로그인" :title="`이메일로\n로그인해요`" @back="back">
    <MemberStatus :text="notice" />
    <NTrustNote v-if="fromPurchase">{{ PURCHASE_LOGIN_NOTE }}</NTrustNote>
    <form id="login-form" class="member-form" novalidate @submit.prevent="submit">
      <div>
        <NInput
          id="login-email"
          v-model="email"
          variant="underline"
          label="이메일"
          aria-label="이메일"
          type="email"
          autocomplete="email"
          inputmode="email"
          :error="!!emailError"
          :aria-invalid="emailError ? 'true' : undefined"
          :aria-describedby="emailError ? 'login-email-err' : undefined"
        />
        <p v-if="emailError" id="login-email-err" class="member-err" role="alert">
          {{ emailError }}
        </p>
      </div>
      <PasswordField
        v-model="password"
        input-id="login-password"
        autocomplete="current-password"
        :error="passwordError"
      />
    </form>
    <div class="member-links">
      <NuxtLink to="/password/reset">비밀번호를 잊었어요</NuxtLink>
      <NuxtLink :to="withNext('/signup')">처음이라면 회원가입</NuxtLink>
    </div>

    <template #cta>
      <NButton
        type="submit"
        form="login-form"
        variant="primary"
        size="xl"
        full-width
        :loading="busy"
        :disabled="busy"
      >
        로그인
      </NButton>
    </template>
  </MemberShell>

  <MemberDialog
    v-model="dialogOpen"
    v-bind="dialogView"
    @secondary="navigateTo('/password/reset')"
  />
</template>
