<script setup lang="ts">
// 설치 가이드 허브 (client-guide spec S-1 · F-1) — OS 카드 2 · 3단계 흐름 · 지원 기기 · 문의.
// 본문은 /guide/ios · /guide/android (외부 가이드 사이트는 쓰지 않는다 — F-8).
import { NLinkCard } from '@imjohnkoo/design-vue'
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import GuideContact from '~/components/guide/GuideContact.vue'
import GuideFlow from '~/components/guide/GuideFlow.vue'
import { GUIDE_CONTACT, GUIDE_HUB, GUIDE_PAGES } from '~/content/guide/common'
import type { GuideOs } from '~/content/guide/types'

// canonical · 설명 — sitemap 에 든 정적 페이지(catalog F-9)
useCatalogSeo({ title: GUIDE_HUB.title, description: STATIC_DESCRIPTIONS['/guide'] })

const ICONS: Record<GuideOs, string> = { ios: '/icons/apple.svg', android: '/icons/android.svg' }
const OS_ORDER: GuideOs[] = ['ios', 'android']
</script>

<template>
  <div class="guide-page">
    <h1 class="guide-page__title">{{ GUIDE_HUB.title }}</h1>
    <p class="guide-page__desc">{{ GUIDE_HUB.desc }}</p>

    <div class="guide-page__cards">
      <NuxtLink
        v-for="os in OS_ORDER"
        :key="os"
        v-slot="{ href, navigate }"
        :to="GUIDE_PAGES[os].to"
        custom
      >
        <NLinkCard
          :label="GUIDE_PAGES[os].label"
          :sub="GUIDE_PAGES[os].sub"
          :href="href"
          @click="navigate"
        >
          <template #icon>
            <img :src="ICONS[os]" alt="" width="20" height="20" />
          </template>
        </NLinkCard>
      </NuxtLink>
    </div>

    <h2 class="guide-page__h2">이렇게 진행돼요</h2>
    <GuideFlow />
    <p class="guide-page__note">{{ GUIDE_HUB.flowNote }}</p>

    <NuxtLink to="/supported-devices" class="guide-page__link">지원 기기 확인</NuxtLink>

    <GuideContact :title="GUIDE_CONTACT.hubTitle" />
  </div>
</template>

<style scoped>
.guide-page {
  display: flex;
  flex-direction: column;
  padding: 24px 20px 32px;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.guide-page__title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
}

.guide-page__desc {
  margin: 6px 0 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--n-color-neutral-600, #525252);
}

.guide-page__cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
}

/* DS 카드 설명(#a3a3a3 · 11px)은 명암비 2.5:1 — 설치 방법 목록이라 읽혀야 한다(4.5:1 이상) */
.guide-page__cards :deep(.n-link-card__sub) {
  color: var(--n-color-neutral-500, #737373);
}

.guide-page__h2 {
  margin: 28px 0 10px;
  font-size: 17px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
}

.guide-page__note {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-600, #525252);
}

.guide-page__link {
  align-self: flex-start;
  margin-top: 20px;
  font-size: 14px;
  font-weight: 600;
  color: var(--n-color-primary-600, #5025e8);
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
