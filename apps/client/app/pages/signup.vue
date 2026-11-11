<script setup lang="ts">
// S-3a ~ c 가입(member-client-auth ⑤ · 패킷 M-3a ~ c · 디자인 리뷰 R2 · R5) — 이메일 → 코드 6자리 → 비밀번호 · 동의.
// 단계 상태는 페이지 메모리만(이메일 · 코드를 URL · 저장소에 두지 않는다 · 단계마다 history 를 쌓지 않는다). 계정은 3단계에서 만든다(K-A3).
import {
  NButton,
  NCheckbox,
  NInput,
  NLoaderDialog,
  NPinInput,
  NTrustNote,
} from '@imjohnkoo/design-vue'
import MemberShell from '~/components/member/MemberShell.vue'
import MemberDialog from '~/components/member/MemberDialog.vue'
import PasswordField from '~/components/member/PasswordField.vue'
import DocSheet, { type DocSheetKey } from '~/components/legal/DocSheet.vue'
import {
  EMAIL_PATTERN,
  MEMBER_DIALOG,
  MEMBER_FIELD,
  MEMBER_MIN_PASSWORD,
  PURCHASE_LOGIN_NOTE,
  RESEND_SECONDS,
  codeSentText,
  maskEmailForView,
} from '~/content/member'
import { SIGNUP_CONSENT, SIGNUP_CONSENT_LINES } from '#shared/consent/signup-consent'
import { safeNext } from '#shared/utils/safe-next'

definePageMeta({ layout: 'flow', middleware: 'member' })
useHead({ title: '회원가입' })

const route = useRoute()
const router = useRouter()
const next = computed(() => safeNext(route.query.next))
const fromPurchase = computed(() => /^\/(products|checkout)(\/|$|\?)/.test(next.value))

const step = ref<1 | 2 | 3>(1)
const email = ref('')
const pin = ref<string[]>([])
const password = ref('')
const agreeTerms = ref(false)
const agreeAge = ref(false)
const emailErr = ref('')
const codeErr = ref('')
const pwErr = ref('')
const busy = ref(false)
type Dialog = 'c1' | 'c2' | 'e30' | 'e31' | 'codeMismatch' | 'codeLocked'
const dialog = ref<Dialog | null>(null)
const sheet = ref<DocSheetKey | null>(null)

const code = computed(() => pin.value.join(''))
const masked = computed(() => maskEmailForView(email.value))

// 재발송 60초 — 매초 읽지 않게 aria-live 없음(끝나면 버튼만 살아난다)
const resendLeft = ref(0)
let timer: ReturnType<typeof setInterval> | undefined
function startCooldown() {
  resendLeft.value = RESEND_SECONDS
  clearInterval(timer)
  timer = setInterval(() => {
    resendLeft.value = Math.max(0, resendLeft.value - 1)
    if (resendLeft.value === 0) clearInterval(timer)
  }, 1000)
}
onBeforeUnmount(() => clearInterval(timer))
const resendLabel = computed(() =>
  resendLeft.value > 0
    ? `코드 다시 받기 0:${String(resendLeft.value).padStart(2, '0')}`
    : '코드 다시 받기',
)

function toStep1() {
  pin.value = []
  password.value = ''
  codeErr.value = ''
  pwErr.value = ''
  step.value = 1
}

async function sendCode(): Promise<boolean> {
  busy.value = true
  try {
    await authPost('signup/code', { email: email.value })
    startCooldown()
    return true
  } catch (e) {
    const err = e as AuthApiError
    if (err.code === 'INVALID_EMAIL') emailErr.value = MEMBER_FIELD.e2
    else dialog.value = err.code === 'TOO_MANY_REQUESTS' ? 'c1' : 'e30'
    return false
  } finally {
    busy.value = false
  }
}

async function submitEmail() {
  emailErr.value = EMAIL_PATTERN.test(email.value.trim()) ? '' : MEMBER_FIELD.e2
  if (emailErr.value) return
  if (await sendCode()) {
    pin.value = []
    step.value = 2
  }
}

async function verifyCode() {
  if (!/^\d{6}$/.test(code.value) || busy.value) return
  busy.value = true
  codeErr.value = ''
  try {
    await authPost('signup/verify', { email: email.value, code: code.value })
    step.value = 3
  } catch (e) {
    const c = (e as AuthApiError).code
    if (c === 'CODE_MISMATCH') codeErr.value = MEMBER_FIELD.e5
    else if (c === 'CODE_EXPIRED') codeErr.value = MEMBER_FIELD.e6
    else if (c === 'CODE_LOCKED') codeErr.value = MEMBER_FIELD.e7
    else dialog.value = 'e30'
    pin.value = []
  } finally {
    busy.value = false
  }
}

const canSignUp = computed(() => agreeTerms.value && agreeAge.value && !busy.value)

async function submitSignup() {
  pwErr.value = [...password.value].length >= MEMBER_MIN_PASSWORD ? '' : MEMBER_FIELD.e8
  if (pwErr.value || !canSignUp.value) return
  busy.value = true
  try {
    await authPost('signup', {
      email: email.value,
      code: code.value,
      password: password.value,
      consent: SIGNUP_CONSENT,
      age14: true,
    })
    useMemberFlash().value = 'e10'
    await loadAuthSession(true)
    await navigateTo(next.value)
  } catch (e) {
    const c = (e as AuthApiError).code
    if (c === 'WEAK_PASSWORD') pwErr.value = MEMBER_FIELD.e8
    else if (c === 'EMAIL_TAKEN') dialog.value = 'e31'
    else if (c === 'CODE_EXPIRED') dialog.value = 'c2'
    else if (c === 'CODE_MISMATCH') dialog.value = 'codeMismatch'
    else if (c === 'CODE_LOCKED') dialog.value = 'codeLocked'
    else dialog.value = 'e30'
  } finally {
    busy.value = false
  }
}

// 3단계에서 코드가 무효 → 1단계(이메일 채운 채 · R2)
function restart() {
  dialog.value = null
  toStep1()
}

function back() {
  if (step.value === 1) {
    if (window.history.length > 1) router.back()
    else navigateTo('/my')
  } else toStep1()
}

const heading = computed(() =>
  step.value === 1
    ? { title: '가입할 이메일을\n입력해 주세요', description: '인증 코드를 보내 드려요.' }
    : step.value === 2
      ? {
          title: '메일로 받은\n코드 6자리를 입력해 주세요',
          description: codeSentText(masked.value),
        }
      : { title: '비밀번호를\n정해 주세요', description: undefined },
)
</script>

<template>
  <MemberShell
    eyebrow="회원가입"
    :title="heading.title"
    :description="heading.description"
    :step="step"
    :total="3"
    step-label="회원가입"
    @back="back"
  >
    <template v-if="step === 1">
      <NTrustNote v-if="fromPurchase">{{ PURCHASE_LOGIN_NOTE }}</NTrustNote>
      <form id="signup-form" class="member-form" novalidate @submit.prevent="submitEmail">
        <div>
          <NInput
            id="signup-email"
            v-model="email"
            variant="underline"
            label="이메일"
            type="email"
            autocomplete="email"
            inputmode="email"
            :error="!!emailErr"
            :aria-invalid="emailErr ? 'true' : undefined"
            :aria-describedby="emailErr ? 'signup-email-err' : undefined"
          />
          <p v-if="emailErr" id="signup-email-err" class="member-err">{{ emailErr }}</p>
        </div>
      </form>
    </template>

    <template v-else-if="step === 2">
      <form id="signup-form" class="member-form" novalidate @submit.prevent="verifyCode">
        <div>
          <NPinInput
            v-model="pin"
            :length="6"
            type="number"
            placeholder=""
            aria-label="인증 코드 6자리"
            @complete="verifyCode"
          />
          <p v-if="codeErr" class="member-err" role="alert">{{ codeErr }}</p>
        </div>
      </form>
      <div class="signup__resend">
        <button
          type="button"
          class="signup__resend-btn"
          :disabled="resendLeft > 0 || busy"
          @click="sendCode"
        >
          {{ resendLabel }}
        </button>
        <p class="signup__help">메일이 오지 않으면 스팸함도 확인해 주세요.</p>
      </div>
    </template>

    <template v-else>
      <form id="signup-form" class="member-form" novalidate @submit.prevent="submitSignup">
        <PasswordField
          v-model="password"
          input-id="signup-password"
          autocomplete="new-password"
          :error="pwErr"
          :hint="`${MEMBER_MIN_PASSWORD}자 이상`"
        />
        <div class="signup__consents">
          <div class="signup__consent">
            <NCheckbox v-model="agreeTerms" :label="SIGNUP_CONSENT_LINES[0]" />
            <a
              href="/terms"
              target="_blank"
              rel="noopener"
              aria-haspopup="dialog"
              @click.exact.prevent="sheet = 'terms'"
              >보기</a
            >
          </div>
          <div class="signup__consent">
            <NCheckbox v-model="agreeAge" :label="SIGNUP_CONSENT_LINES[1]" />
          </div>
          <div class="signup__consent signup__consent--info">
            <span>개인정보 수집·이용 안내</span>
            <a
              href="/privacy"
              target="_blank"
              rel="noopener"
              aria-haspopup="dialog"
              @click.exact.prevent="sheet = 'privacy'"
              >보기</a
            >
          </div>
        </div>
      </form>
      <DocSheet v-model="sheet" />
    </template>

    <template #cta>
      <NButton
        v-if="step === 1"
        type="submit"
        form="signup-form"
        variant="primary"
        size="xl"
        full-width
        :loading="busy"
        :disabled="busy"
      >
        인증 코드 받기
      </NButton>
      <NButton
        v-else-if="step === 2"
        type="submit"
        form="signup-form"
        variant="primary"
        size="xl"
        full-width
        :disabled="code.length !== 6 || busy"
      >
        다음
      </NButton>
      <NButton
        v-else
        type="submit"
        form="signup-form"
        variant="primary"
        size="xl"
        full-width
        :disabled="!canSignUp"
        :loading="busy"
      >
        가입하기
      </NButton>
    </template>
  </MemberShell>

  <NLoaderDialog :model-value="busy && step === 2" title="코드를 확인하고 있어요" />
  <MemberDialog
    v-if="dialog === 'c1'"
    :model-value="true"
    v-bind="MEMBER_DIALOG.c1"
    @confirm="dialog = null"
  />
  <MemberDialog
    v-if="dialog === 'e30'"
    :model-value="true"
    v-bind="MEMBER_DIALOG.e30"
    @confirm="dialog = null"
  />
  <MemberDialog
    v-if="dialog === 'e31'"
    :model-value="true"
    v-bind="MEMBER_DIALOG.e31"
    secondary="비밀번호 재설정"
    @confirm="navigateTo('/login')"
    @secondary="navigateTo('/password/reset')"
  />
  <MemberDialog
    v-if="dialog === 'c2' || dialog === 'codeMismatch' || dialog === 'codeLocked'"
    :model-value="true"
    v-bind="MEMBER_DIALOG[dialog]"
    @confirm="restart"
  />
</template>

<style scoped>
.signup__resend {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.signup__resend-btn {
  align-self: flex-start;
  padding: 4px 0;
  border: 0;
  background: none;
  color: var(--n-color-primary-600, #5025e8);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.signup__resend-btn:disabled {
  color: var(--n-color-neutral-400, #a3a3a3);
  cursor: default;
}

.signup__help {
  margin: 0;
  font-size: 13px;
  color: var(--n-color-neutral-500, #737373);
}

.signup__consents {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 8px;
}

.signup__consent {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 14px;
}

.signup__consent a {
  flex-shrink: 0;
  color: var(--n-color-neutral-500, #737373);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.signup__consent--info {
  color: var(--n-color-neutral-600, #525252);
}
</style>
