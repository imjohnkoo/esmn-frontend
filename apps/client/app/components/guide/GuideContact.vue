<script setup lang="ts">
// 설치 가이드 문의(client-guide spec F-5) — 카카오톡 채널 · 네이버 톡톡 링크 + 고객센터 전체.
// 값 · 링크는 고객센터 정의 한 곳(app/content/support.ts — supportRows: 확정 전 값이면 링크 없이 글자만).
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import { GUIDE_CONTACT } from '~/content/guide/common'
import { supportRows } from '~/content/support'

const props = withDefaults(defineProps<{ title?: string }>(), { title: GUIDE_CONTACT.title })
const rows = supportRows().filter((r) => r.key === 'kakao' || r.key === 'naver')
</script>

<template>
  <section class="g-cs" aria-labelledby="guide-cs-title">
    <h2 id="guide-cs-title" class="g-cs__title">{{ props.title }}</h2>
    <p class="g-cs__lede">{{ GUIDE_CONTACT.lede }}</p>
    <ul class="g-cs__cards">
      <li v-for="row in rows" :key="row.key">
        <component
          :is="row.href ? 'a' : 'div'"
          class="g-cs__card"
          :href="row.href ?? undefined"
          :target="row.href ? '_blank' : undefined"
          :rel="row.href ? 'noopener noreferrer' : undefined"
        >
          <span class="g-cs__icon" :class="`g-cs__icon--${row.key}`" aria-hidden="true">{{
            row.key === 'kakao' ? 'TALK' : 'N'
          }}</span>
          <span class="g-cs__text">
            <span class="g-cs__name">{{ row.label }}</span>
            <span class="g-cs__handle">{{ row.text }}</span>
          </span>
          <ChevronRightIcon v-if="row.href" class="g-cs__chev" aria-hidden="true" />
        </component>
      </li>
    </ul>
    <NuxtLink to="/my#cs" class="g-cs__more">{{ GUIDE_CONTACT.more }}</NuxtLink>
  </section>
</template>

<style scoped>
.g-cs {
  margin-top: 36px;
  padding: 28px 20px;
  border-radius: var(--n-radius-2xl, 16px);
  background: var(--n-color-neutral-900, #171717);
  color: #fff;
  text-align: center;
}

.g-cs__title {
  margin: 0 0 6px;
  font-size: 19px;
  font-weight: 800;
  line-height: 1.4;
}

.g-cs__lede {
  margin: 0 0 18px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-300, #d4d4d4);
}

.g-cs__cards {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.g-cs__card {
  display: grid;
  grid-template-columns: 44px 1fr 18px;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--n-radius-xl, 12px);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  text-align: left;
  text-decoration: none;
}

.g-cs__icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 900;
}

.g-cs__icon--kakao {
  background: #fee500;
  color: #191919;
  font-size: 11px;
}

.g-cs__icon--naver {
  background: #03c75a;
  color: #fff;
  font-size: 20px;
}

.g-cs__text {
  display: grid;
  gap: 2px;
}

.g-cs__name {
  font-size: 13px;
  color: var(--n-color-neutral-400, #a3a3a3);
}

.g-cs__handle {
  font-size: 16px;
  font-weight: 800;
}

.g-cs__chev {
  width: 18px;
  height: 18px;
  color: var(--n-color-neutral-400, #a3a3a3);
}

.g-cs__more {
  display: inline-block;
  margin-top: 16px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  text-decoration: underline;
  text-underline-offset: 3px;
}
</style>
