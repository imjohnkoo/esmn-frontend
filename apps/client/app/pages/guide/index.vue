<script setup lang="ts">
// 설치 가이드 자리 (spec S-5 · D-16) — 현행 외부 가이드 링크 + 지원 기기. 여정 3단계 본문 · /guide/devices 는 W1-4.
import { STATIC_DESCRIPTIONS } from '#shared/catalog/seo'
import { NLinkCard } from '@imjohnkoo/design-vue'

// canonical · 설명 — sitemap 에 든 정적 페이지(catalog F-9 · QA ⑥ R11)
useCatalogSeo({ title: '설치 가이드', description: STATIC_DESCRIPTIONS['/guide'] })

// view 화면의 현행 가이드 카드와 같은 값 (W1-4 에서 이 사이트의 가이드로 바뀐다)
const GUIDE_URL = 'https://esimmany.super.site'
</script>

<template>
  <div class="guide-page">
    <h1 class="guide-page__title">설치 가이드</h1>
    <p class="guide-page__desc">설치 방법과 지원 기기를 확인해 보세요.</p>

    <div class="guide-page__cards">
      <NLinkCard
        label="아이폰 설치 가이드"
        sub="iOS · Universal Link 자동 설치"
        :href="GUIDE_URL"
        external
      >
        <template #icon>
          <img src="/icons/apple.svg" alt="" width="20" height="20" />
        </template>
      </NLinkCard>
      <NLinkCard
        label="안드로이드 설치 가이드"
        sub="Galaxy · Pixel · QR 등록"
        :href="GUIDE_URL"
        external
      >
        <template #icon>
          <img src="/icons/android.svg" alt="" width="20" height="20" />
        </template>
      </NLinkCard>
    </div>

    <NuxtLink to="/supported-devices" class="guide-page__link">지원 기기 확인</NuxtLink>
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
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-600, #525252);
}

.guide-page__cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 20px;
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
