<script setup lang="ts">
// 설치 확인 · 현지 통신사 바꾸기 본문(client-guide-check spec S-1 · S-2 · S-3) — 설치 가이드(GuideArticle)와 같은 틀
// (머리 · OS 전환 · 바로가기 칩 줄(sticky) · 빨간 테두리 안내 · 구간 · 안내 상자 · 화면 창 · 문의)에 구간 구성만 다르다.
// 틀 CSS 는 GuideArticle 값을 복제한다 — guide-frame-css.test.ts 가 같은 값인지 본다(plan §2.1 — 설치 가이드 골든 불변).
// mode — page: 사이트판(default 레이아웃 · 칩 줄은 헤더 아래) · bare: 전용판(flow 레이아웃 · 링크는 메뉴 없는 판끼리 — S-5)
import { GlobeAltIcon, LifebuoyIcon, SignalIcon } from '@heroicons/vue/24/outline'
import { NLinkCard } from '@imjohnkoo/design-vue'
import { CHECK_CONTACT_LEDE } from '~/content/guide/check'
import { GUIDE_CHECK, GUIDE_PAGES } from '~/content/guide/common'
import type { GuideCheckContent, GuideLink, GuideOs } from '~/content/guide/types'
import GuideAfter from './GuideAfter.vue'
import GuideContact from './GuideContact.vue'
import GuideNote from './GuideNote.vue'
import GuidePoints from './GuidePoints.vue'
import GuideShot from './GuideShot.vue'
import GuideStatusBar from './GuideStatusBar.vue'
import GuideSteps from './GuideSteps.vue'
import GuideText from './GuideText.vue'

const props = withDefaults(defineProps<{ content: GuideCheckContent; mode?: 'page' | 'bare' }>(), {
  mode: 'page',
})
const to = (l: Pick<GuideLink, 'page' | 'bare'>) => (props.mode === 'bare' ? l.bare : l.page)
const OS_ORDER: GuideOs[] = ['ios', 'android']
const CARD_ICONS = { network: SignalIcon, help: LifebuoyIcon, carriers: GlobeAltIcon } as const
</script>

<template>
  <article class="g-article">
    <header class="g-hero">
      <p class="g-hero__eyebrow">{{ content.eyebrow }}</p>
      <h1 class="g-hero__title">{{ content.title }}</h1>
      <p class="g-hero__lede">
        <template v-for="(line, i) in content.lede" :key="i"
          ><br v-if="i > 0" /><GuideText v-if="typeof line === 'string'" :src="line" /><template
            v-else
            >{{ line.before
            }}<NuxtLink :to="to(line.link)" class="g-hero__link">{{ line.link.label }}</NuxtLink
            >{{ line.after }}</template
          ></template
        >
      </p>

      <nav v-if="content.os" class="g-os" aria-label="기기 종류">
        <NuxtLink
          v-for="os in OS_ORDER"
          :key="os"
          :to="to(GUIDE_CHECK[os])"
          class="g-os__tab"
          :class="{ 'g-os__tab--on': os === content.os }"
          :aria-current="os === content.os ? 'page' : undefined"
        >
          {{ GUIDE_PAGES[os].short }}
        </NuxtLink>
      </nav>
    </header>

    <nav
      class="g-jump"
      :class="{ 'g-jump--under-header': mode === 'page' }"
      aria-label="이 페이지 안에서 이동"
    >
      <a v-for="c in content.chips" :key="c.id" :href="`#${c.id}`" class="g-jump__chip"
        ><span class="g-jump__label"
          ><span v-if="c.step" class="g-jump__step">{{ c.step }}</span
          >{{ c.step ? ` ${c.label}` : c.label }}</span
        ></a
      >
    </nav>
    <p class="g-hero__hint">{{ content.hint }}</p>

    <div v-if="content.intro" class="g-sec g-sec--intro">
      <GuideNote v-for="(n, i) in content.intro" :key="i" :note="n"
        ><p v-if="n.link" class="g-note__more">
          {{ n.link.before
          }}<NuxtLink :to="to(n.link.link)" class="g-note__link">{{ n.link.link.label }}</NuxtLink
          >{{ n.link.after }}
        </p></GuideNote
      >
    </div>

    <section
      v-for="s in content.sections"
      :id="s.id"
      :key="s.id"
      class="g-sec"
      :class="{ 'g-sec--alt': s.alt }"
      :aria-labelledby="`${s.id}-title`"
    >
      <span class="g-badge">{{ s.badge }}</span>
      <h2 :id="`${s.id}-title`" class="g-sec__title">{{ s.title }}</h2>
      <p v-if="s.lede" class="g-sec__lede"><GuideText :src="s.lede" /></p>
      <GuidePoints v-if="s.points" :points="s.points" />
      <GuideShot v-for="f in s.figures ?? []" :key="f" :figure="f" />
      <GuideStatusBar v-if="s.status" :os="s.status" />
      <GuideSteps v-if="s.steps" :steps="s.steps" class="g-sec__steps" />
      <GuideNote v-for="(n, i) in s.notes ?? []" :key="i" :note="n"
        ><p v-if="n.link" class="g-note__more">
          {{ n.link.before
          }}<NuxtLink :to="to(n.link.link)" class="g-note__link">{{ n.link.link.label }}</NuxtLink
          >{{ n.link.after }}
        </p></GuideNote
      >
    </section>

    <section
      class="g-sec g-sec--end"
      :class="{ 'g-sec--alt': content.end.alt }"
      :aria-labelledby="content.end.title ? 'end-title' : undefined"
      :aria-label="content.end.title ? undefined : '더 보기'"
    >
      <h2 v-if="content.end.title" id="end-title" class="g-sec__title">
        {{ content.end.title }}
      </h2>
      <p v-if="content.end.lede" class="g-sec__lede">{{ content.end.lede }}</p>
      <GuideAfter v-if="content.end.after" :rows="content.end.after" :mode="mode" />
      <div class="g-more">
        <NuxtLink
          v-for="c in content.end.cards"
          :key="c.page"
          v-slot="{ href, navigate }"
          :to="to(c)"
          custom
        >
          <NLinkCard :label="c.label" :sub="c.sub" :href="href" @click="navigate">
            <template #icon>
              <component :is="CARD_ICONS[c.icon]" class="g-more__icon" aria-hidden="true" />
            </template>
          </NLinkCard>
        </NuxtLink>
      </div>
      <GuideContact :lede="CHECK_CONTACT_LEDE" />
    </section>
  </article>
</template>

<style scoped>
/* ===== 틀 — GuideArticle.vue 와 같은 값(guide-frame-css.test.ts 가 대조) ===== */
.g-article {
  --g-jump-h: 53px;
  word-break: keep-all;
  overflow-wrap: break-word;
  color: var(--n-color-neutral-900, #171717);
}

.g-article :is(h1, h2, .g-hero__lede, .g-sec__lede) {
  text-wrap: balance;
}

.g-article p {
  text-wrap: pretty;
}

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

.g-sec {
  padding: 32px 16px;
  scroll-margin-top: var(--g-jump-h);
}

@media (max-width: 350px) {
  .g-article {
    --g-jump-h: 72px;
  }
}

.g-jump--under-header ~ .g-sec {
  scroll-margin-top: calc(var(--g-jump-h) - 8px);
}

.g-article :deep(:is(a, button, [tabindex])) {
  scroll-margin-top: calc(var(--g-jump-h) + 4px);
}

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

/* ===== 이 페이지들에만 ===== */
/* 머리 설명 안 링크 · 안내 상자 링크 — 설치 가이드 링크(지원 기기 확인하기 · 내 eSIM 조회하기)와 같은 보라 밑줄 */
.g-hero__link,
.g-note__link {
  font-weight: 700;
  color: var(--n-color-primary-600, #5025e8);
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* 안내 상자 링크 줄 — 상자 문단 사이 간격(GuideNote .g-note__body p + p)과 같다 */
.g-note__more {
  margin: 6px 0 0;
}

/* 칩 줄 아래 첫 안내(통신사 바꾸기 tip) — 빨간 테두리 안내 줄 바로 아래 */
.g-sec--intro {
  padding-top: 0;
}

.g-sec--intro > :first-child {
  margin-top: 0;
}

/* 확인 목록 아래 화면 · 상태 표시줄은 목록과 조금 띄운다 */
.g-sec :deep(.g-points + .g-shot),
.g-sec :deep(.g-points + .g-status) {
  margin-top: 16px;
}

.g-more {
  display: grid;
  gap: 10px;
  margin-top: 10px;
}

.g-more :deep(.n-link-card__label) {
  font-size: 15px;
}

.g-more :deep(.n-link-card__sub) {
  color: var(--n-color-neutral-500, #737373);
  font-size: 13px;
  line-height: 1.6;
}

.g-more__icon {
  width: 20px;
  height: 20px;
  color: var(--n-color-primary-600, #5025e8);
}
</style>
