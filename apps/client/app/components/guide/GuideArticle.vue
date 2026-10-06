<script setup lang="ts">
// OS 설치 가이드 본문(client-guide spec S-2 · S-3) — 2609 판 구성 그대로, 휴대폰 폭 1열.
// 머리(흐름 · OS 전환 · 구간 바로가기) → 확인 → STEP 1(방법 A · B · C) → STEP 2 → STEP 3 → 문제 해결(전부 펼침 — D-6) → 문의.
import {
  ArrowPathIcon,
  DevicePhoneMobileIcon,
  NoSymbolIcon,
  PowerIcon,
  WifiIcon,
} from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import { GUIDE_BARE, GUIDE_HL_HINT, GUIDE_PAGES, GUIDE_SECTIONS } from '~/content/guide/common'
import type { GuideContent, GuideOs } from '~/content/guide/types'
import GuideContact from './GuideContact.vue'
import GuideFlow from './GuideFlow.vue'
import GuideNote from './GuideNote.vue'
import GuideShot from './GuideShot.vue'
import GuideSteps from './GuideSteps.vue'
import GuideText from './GuideText.vue'

// 쓰는 곳(client-guide D-13 · D-14) — page: 사이트 /guide/<os>(DOM 은 골든 그대로) · bare: 전용판 /install-guide/<os> ·
// sheet: 발급 화면 시트(OS 전환 · 바로가기 = 버튼 — 주소를 바꾸지 않는다 · 발급 화면을 떠나는 링크는 숨기거나 새 탭)
type GuideMode = 'page' | 'bare' | 'sheet'
const props = withDefaults(defineProps<{ content: GuideContent; mode?: GuideMode }>(), {
  mode: 'page',
})
const emit = defineEmits<{ os: [os: GuideOs]; jump: [id: string] }>()
// 시트 판은 발급 화면과 한 문서라 id 에 접두를 붙인다(겹침 방지) — 페이지 · 전용판은 그대로
const sid = (id: string) => (props.mode === 'sheet' ? `gs-${id}` : id)
const osTo = (os: GuideOs) => (props.mode === 'bare' ? GUIDE_BARE[os] : GUIDE_PAGES[os].to)
// 시트 판 바로가기는 구간 제목으로 포커스를 옮긴다(GuideSheet) — 그 제목만 프로그램 포커스를 받게(탭 순서에는 넣지 않는다)
const headTab = computed(() => (props.mode === 'sheet' ? -1 : undefined))
// 문제 해결의 «내 eSIM 조회하기» 링크는 시트에서 숨긴다 — 지금 보고 있는 발급 화면이다(D-13)
// 확인 카드 링크(«지원 기기 확인하기» — D-22)는 시트에서 새 탭(발급 · 본인 확인 화면을 떠나지 않게), 사이트판 · 전용판은 같은 탭.
// 목적지 — 사이트판은 메뉴 있는 사이트 페이지, 전용판 · 시트(메뉴 없는 화면)는 메뉴 없는 판(D-24)
const checkTo = (l: { to: string; bareTo?: string }) => (props.mode === 'page' ? l.to : (l.bareTo ?? l.to))
const CHECK_ICONS = {
  wifi: WifiIcon,
  update: ArrowPathIcon,
  device: DevicePhoneMobileIcon,
  clean: PowerIcon,
} as const
const OS_ORDER: GuideOs[] = ['ios', 'android']
// 바로가기 칩 4개는 늘 한 줄(D-21) — 폭이 모자라면 칩 안 글자만 «STEP 1» / «설치» 로 접는다(«STEP n» 은 붙여 둔다)
// 칩 줄은 스크롤해도 위에 붙어 있다(D-23) — 머리 밖 칸에 둔다(머리 안이면 머리와 함께 올라간다). 사이트판(page)은 사이트 헤더 바로 아래,
// 전용판은 화면 맨 위, 시트는 본문 스크롤 영역 맨 위(GuideSheet 의 이동 계산이 칩 줄 높이를 뺀다)
const chipStep = (label: string) => /^STEP \d+(?= )/.exec(label)?.[0] ?? ''
</script>

<template>
  <article class="g-article">
    <header class="g-hero">
      <p class="g-hero__eyebrow">{{ content.eyebrow }}</p>
      <h1 class="g-hero__title">{{ content.title }}</h1>
      <p class="g-hero__lede">
        <template v-for="(line, i) in content.lede" :key="i"
          ><br v-if="i > 0" />{{ line }}</template
        >
      </p>

      <nav class="g-os" aria-label="기기 종류">
        <template v-if="mode === 'sheet'">
          <button
            v-for="os in OS_ORDER"
            :key="os"
            type="button"
            class="g-os__tab"
            :class="{ 'g-os__tab--on': os === content.os }"
            :aria-pressed="os === content.os"
            @click="emit('os', os)"
          >
            {{ GUIDE_PAGES[os].short }}
          </button>
        </template>
        <template v-else>
          <NuxtLink
            v-for="os in OS_ORDER"
            :key="os"
            :to="osTo(os)"
            class="g-os__tab"
            :class="{ 'g-os__tab--on': os === content.os }"
            :aria-current="os === content.os ? 'page' : undefined"
          >
            {{ GUIDE_PAGES[os].short }}
          </NuxtLink>
        </template>
      </nav>

      <GuideFlow class="g-hero__flow" />
    </header>

    <nav
      class="g-jump"
      :class="{ 'g-jump--under-header': mode === 'page' }"
      aria-label="이 페이지 안에서 이동"
    >
      <template v-if="mode === 'sheet'">
        <button
          v-for="s in GUIDE_SECTIONS"
          :key="s.id"
          type="button"
          class="g-jump__chip"
          @click="emit('jump', sid(s.id))"
        >
          <span class="g-jump__label"
            ><span v-if="chipStep(s.label)" class="g-jump__step">{{ chipStep(s.label) }}</span
            >{{ s.label.slice(chipStep(s.label).length) }}</span
          >
        </button>
      </template>
      <template v-else>
        <a v-for="s in GUIDE_SECTIONS" :key="s.id" :href="`#${s.id}`" class="g-jump__chip"
          ><span class="g-jump__label"
            ><span v-if="chipStep(s.label)" class="g-jump__step">{{ chipStep(s.label) }}</span
            >{{ s.label.slice(chipStep(s.label).length) }}</span
          ></a
        >
      </template>
    </nav>
    <p class="g-hero__hint">{{ GUIDE_HL_HINT }}</p>

    <!-- 설치 전 확인 -->
    <section :id="sid('check')" class="g-sec" :aria-labelledby="sid('check-title')">
      <h2 :id="sid('check-title')" class="g-sec__title" :tabindex="headTab">설치 전에 확인해 주세요</h2>
      <p class="g-sec__lede"><GuideText :src="content.checks.lede" /></p>
      <ul class="g-checks">
        <li v-for="c in content.checks.items" :key="c.title" class="g-check">
          <span class="g-check__tile" aria-hidden="true"
            ><component :is="CHECK_ICONS[c.icon]" class="g-check__icon"
          /></span>
          <div>
            <h3 class="g-check__h">{{ c.title }}</h3>
            <p class="g-check__body"><GuideText :src="c.body" /></p>
            <template v-if="c.link">
              <a
                v-if="mode === 'sheet'"
                :href="checkTo(c.link)"
                class="g-check__link"
                target="_blank"
                rel="noopener noreferrer"
                >{{ c.link.label }}<span class="g-check__sr">(새 창)</span></a
              >
              <NuxtLink v-else :to="checkTo(c.link)" class="g-check__link">{{
                c.link.label
              }}</NuxtLink>
            </template>
          </div>
        </li>
      </ul>
      <div class="g-alert" role="note">
        <span class="g-alert__tile" aria-hidden="true"><NoSymbolIcon class="g-alert__icon" /></span>
        <div>
          <h3 class="g-alert__h">{{ content.checks.alert.title }}</h3>
          <p class="g-alert__body"><GuideText :src="content.checks.alert.body" /></p>
        </div>
      </div>
    </section>

    <!-- STEP 1 -->
    <section :id="sid('step1')" class="g-sec g-sec--alt" :aria-labelledby="sid('step1-title')">
      <span class="g-badge">{{ content.step1.badge }}</span>
      <h2 :id="sid('step1-title')" class="g-sec__title" :tabindex="headTab">{{ content.step1.title }}</h2>
      <p class="g-sec__lede"><GuideText :src="content.step1.lede" /></p>
      <div
        v-for="m in content.step1.methods"
        :key="m.tag"
        class="g-method"
        :aria-label="`${m.tag} ${m.title}`"
        role="group"
      >
        <div class="g-method__tags">
          <span class="g-pill">{{ m.tag }}</span
          ><span class="g-pill g-pill--soft">{{ m.badge }}</span>
        </div>
        <h3 class="g-method__title">{{ m.title }}</h3>
        <p class="g-method__desc"><GuideText :src="m.desc" /></p>
        <GuideSteps :steps="m.steps" class="g-method__steps" />
        <GuideNote v-if="m.note" :note="m.note" />
      </div>
      <GuideNote v-for="(n, i) in content.step1.notes" :key="i" :note="n" />
    </section>

    <!-- STEP 2 · STEP 3 -->
    <section
      v-for="sec in [
        { id: 'step2', data: content.step2 },
        { id: 'step3', data: content.step3 },
      ]"
      :id="sid(sec.id)"
      :key="sec.id"
      class="g-sec"
      :class="{ 'g-sec--alt': sec.id === 'step3' }"
      :aria-labelledby="sid(`${sec.id}-title`)"
    >
      <span class="g-badge">{{ sec.data.badge }}</span>
      <h2 :id="sid(`${sec.id}-title`)" class="g-sec__title" :tabindex="headTab">{{ sec.data.title }}</h2>
      <p class="g-sec__lede"><GuideText :src="sec.data.lede" /></p>
      <GuideSteps :steps="sec.data.steps" class="g-sec__steps" />
      <GuideNote v-for="(n, i) in sec.data.notes" :key="i" :note="n" />
    </section>

    <!-- 문제 해결 -->
    <section :id="sid('help')" class="g-sec" :aria-labelledby="sid('help-title')">
      <span class="g-badge">{{ content.help.badge }}</span>
      <h2 :id="sid('help-title')" class="g-sec__title" :tabindex="headTab">{{ content.help.title }}</h2>
      <p class="g-sec__lede"><GuideText :src="content.help.lede" /></p>
      <div class="g-faqs">
        <div v-for="(f, i) in content.help.faqs" :key="f.q" class="g-faq">
          <h3 class="g-faq__q">
            <span class="g-faq__n">Q{{ i + 1 }}</span> <span><GuideText :src="f.q" /></span>
          </h3>
          <div class="g-faq__a">
            <p v-for="(a, j) in f.a" :key="j"><GuideText :src="a" /></p>
            <NuxtLink v-if="f.link && mode !== 'sheet'" :to="f.link.to" class="g-faq__link">{{
              f.link.label
            }}</NuxtLink>
          </div>
          <GuideShot v-if="f.figure" :figure="f.figure" class="g-faq__shot" />
        </div>
      </div>
      <GuideContact :more-new-tab="mode === 'sheet'" />
    </section>
  </article>
</template>

<style scoped>
.g-article {
  --g-jump-h: 53px;
  word-break: keep-all;
  overflow-wrap: break-word;
  color: var(--n-color-neutral-900, #171717);
}

/* 가운데 정렬 제목 · 설명은 줄 길이를 고르게, 본문 문단은 마지막 줄 외톨이 글자 방지 */
.g-article :is(h1, h2, .g-hero__lede, .g-sec__lede, .g-method__title, .g-method__desc) {
  text-wrap: balance;
}

.g-article p {
  text-wrap: pretty;
}

/* ----- 머리 ----- */
.g-hero {
  padding: 28px 16px 8px;
  background: linear-gradient(180deg, var(--n-color-primary-50, #f1edff) 0%, #fff 100%);
  text-align: center;
}

.g-hero__eyebrow {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  color: var(--n-color-primary-600, #5025e8);
}

.g-hero__title {
  margin: 0 0 10px;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.3;
}

.g-hero__lede {
  margin: 0;
  font-size: 15px;
  line-height: 1.65;
  color: var(--n-color-neutral-600, #525252);
}

.g-os {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin: 20px 0 0;
  padding: 4px;
  border-radius: var(--n-radius-full, 9999px);
  background: var(--n-color-neutral-100, #f5f5f5);
}

.g-os__tab {
  padding: 9px 0;
  border-radius: var(--n-radius-full, 9999px);
  font-size: 15px;
  font-weight: 700;
  color: var(--n-color-neutral-600, #525252);
  text-decoration: none;
}

.g-os__tab--on {
  background: #fff;
  color: var(--n-color-primary-600, #5025e8);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.12);
}

.g-hero__flow {
  margin-top: 16px;
  text-align: left;
}

/* 칩 4개는 늘 한 줄(D-21) — 줄을 채워 늘고, 모자라면 줄어들며 칩 안 글자만 «STEP n» 뒤에서 접힌다.
   스크롤해도 위에 붙어 있다(D-23 — 바탕은 머리 끝과 같은 흰색). 확대로 줄이 넘치면 왼쪽이 잘리지 않게 safe center */
.g-jump {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  justify-content: center;
  justify-content: safe center;
  gap: 3px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--n-color-neutral-100, #f5f5f5);
  background: #fff;
}

/* 사이트판은 사이트 헤더(sticky) 바로 아래 */
.g-jump--under-header {
  top: var(--shell-header-height, 56px);
}

.g-jump__chip {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  padding: 7px 4px;
  text-align: center;
  word-break: keep-all;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: var(--n-radius-full, 9999px);
  background: #fff;
  font-size: 13px;
  font-weight: 600;
  color: var(--n-color-neutral-700, #404040);
  text-decoration: none;
}

.g-jump__step {
  white-space: nowrap;
}

.g-hero__hint {
  margin: 0;
  padding: 6px 16px 24px;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.6;
  color: #c62828;
}

/* ----- 구간 ----- */
.g-sec {
  padding: 32px 16px;
  scroll-margin-top: var(--g-jump-h);
}

/* 칩 줄(sticky) 높이 — 칩 글자 한 줄 53px · 두 줄 72px(칩 줄 폭이 모자라는 폭 350 이하 — D-21 · D-23) */
@media (max-width: 350px) {
  .g-article {
    --g-jump-h: 72px;
  }
}

/* 칩으로 이동한 구간 머리가 칩 줄 바로 아래에(D-23). 사이트판은 html 의 scroll-padding(헤더 + 8px — default 레이아웃)이
   이미 있으니 그 8px 를 뺀다(겹치면 칩 줄과 구간 사이가 벌어져 앞 구간이 비친다 — QA ⑥ R8 m3) */
.g-jump--under-header ~ .g-sec {
  scroll-margin-top: calc(var(--g-jump-h) - 8px);
}

/* 키보드 포커스로 링크 · 버튼이 칩 줄 밑에 숨지 않게 — 칩 줄 높이 + 4px(두 줄이어도 — QA ⑥ R8 m2) */
.g-article :deep(:is(a, button, [tabindex])) {
  scroll-margin-top: calc(var(--g-jump-h) + 4px);
}

/* 칩 줄 안의 칩은 늘 보이는 자리(sticky)라 여백을 두지 않는다 — 두면 칩에 포커스가 갈 때마다 페이지가 칩 줄 높이만큼 밀린다(QA ⑥ R9 m4) */
.g-article .g-jump .g-jump__chip {
  scroll-margin-top: 0;
}

.g-sec--alt {
  background: var(--n-color-neutral-50, #fafafa);
}

.g-badge {
  display: block;
  width: fit-content;
  margin: 0 auto 14px;
  padding: 6px 16px;
  border-radius: var(--n-radius-full, 9999px);
  background: var(--n-color-primary-500, #6239ff);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
}

.g-sec__title {
  margin: 0 0 8px;
  font-size: 21px;
  font-weight: 800;
  line-height: 1.35;
  text-align: center;
}

.g-sec__lede {
  margin: 0 0 20px;
  font-size: 15px;
  line-height: 1.65;
  color: var(--n-color-neutral-600, #525252);
  text-align: center;
}

.g-sec__steps {
  margin-top: 4px;
}

/* ----- 설치 전 확인 ----- */
.g-checks {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.g-check,
.g-alert {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 12px;
  align-items: start;
  padding: 16px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: var(--n-radius-2xl, 16px);
  background: #fff;
}

.g-check__tile,
.g-alert__tile {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: var(--n-radius-lg, 10px);
  background: var(--n-color-primary-50, #f1edff);
}

.g-check__icon {
  width: 22px;
  height: 22px;
  color: var(--n-color-primary-600, #5025e8);
}

.g-check__h,
.g-alert__h {
  margin: 1px 0 4px;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.4;
}

.g-check__body,
.g-alert__body {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--n-color-neutral-600, #525252);
}

.g-check__link {
  display: inline-block;
  margin-top: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--n-color-primary-600, #5025e8);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* «(새 창)» — 화면에는 숨기고 낭독기만 읽는다(시트 스크롤 영역이 위치 기준 — GuideSheet) */
.g-check__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.g-alert {
  margin-top: 12px;
  border: 1.5px solid var(--n-color-error-300, #fca5a5);
  background: var(--n-color-error-50, #fef2f2);
}

.g-alert__tile {
  background: #fff;
}

.g-alert__icon {
  width: 22px;
  height: 22px;
  color: var(--n-color-error-600, #dc2626);
}

.g-alert__h {
  color: var(--n-color-error-700, #b91c1c);
}

.g-alert__body {
  color: var(--n-color-neutral-700, #404040);
}

/* ----- 방법 카드 ----- 옆 여백을 작게 — 화면 이미지가 휴대폰 폭에서 최대한 크게 보이게(spec D-3) */
.g-method {
  padding: 20px 10px 22px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: 20px;
  background: #fff;
}

.g-method + .g-method {
  margin-top: 16px;
}

.g-method__tags {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 10px;
}

.g-pill {
  padding: 4px 12px;
  border-radius: var(--n-radius-full, 9999px);
  background: var(--n-color-primary-500, #6239ff);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}

.g-pill--soft {
  background: var(--n-color-primary-50, #f1edff);
  color: var(--n-color-primary-700, #4a1fd6);
}

.g-method__title {
  margin: 0 6px 4px;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.4;
  text-align: center;
}

.g-method__desc {
  margin: 0 6px 20px;
  font-size: 15px;
  line-height: 1.6;
  color: var(--n-color-neutral-600, #525252);
  text-align: center;
}

/* ----- 문제 해결 ----- */
.g-method :deep(.g-step__text),
.g-method :deep(.g-note) {
  margin-left: 6px;
  margin-right: 6px;
}

.g-faqs {
  display: grid;
  gap: 12px;
}

.g-faq {
  padding: 18px 12px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: 20px;
  background: #fff;
}

.g-faq__q {
  display: grid;
  grid-template-columns: 36px 1fr;
  gap: 10px;
  align-items: start;
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 800;
  line-height: 1.45;
}

.g-faq__n {
  display: grid;
  place-items: center;
  height: 26px;
  border-radius: var(--n-radius-md, 8px);
  background: var(--n-color-primary-500, #6239ff);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
}

.g-faq__a {
  font-size: 15px;
  line-height: 1.65;
  color: var(--n-color-neutral-700, #404040);
}

.g-faq__a p {
  margin: 0;
}

.g-faq__a p + p {
  margin-top: 8px;
}

.g-faq__link {
  display: inline-block;
  margin-top: 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--n-color-primary-600, #5025e8);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.g-faq__shot {
  margin-top: 14px;
}
</style>
