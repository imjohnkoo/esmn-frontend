<script setup lang="ts">
// 마이 (spec S-3) — 로그인 자리(Phase 2) · 고객센터(#cs) · 약관 및 정책. 고객 PII 를 읽거나 보여주지 않는다.
import { ChevronRightIcon } from '@heroicons/vue/24/outline'
import { supportRows } from '~/content/support'
import { LEGAL_LINKS } from '~/utils/shell-nav'

useHead({ title: '마이' })

const channels = supportRows()
</script>

<template>
  <div class="my-page">
    <h1 class="my-page__title">마이</h1>

    <section class="my-page__login" aria-labelledby="my-login-title">
      <h2 id="my-login-title" class="my-page__login-title">로그인은 준비 중이에요</h2>
      <p class="my-page__login-desc">지금은 주문번호로 eSIM 을 조회할 수 있어요.</p>
      <NuxtLink to="/my-esim" class="my-page__login-link">주문번호로 조회하기</NuxtLink>
    </section>

    <section id="cs" class="my-page__section" aria-labelledby="my-cs-title">
      <h2 id="my-cs-title" class="my-page__section-title">고객센터</h2>
      <ul class="my-page__rows">
        <li v-for="channel in channels" :key="channel.key" class="my-page__row">
          <span class="my-page__row-label">{{ channel.label }}</span>
          <a
            v-if="channel.href"
            :href="channel.href"
            class="my-page__row-value my-page__row-value--link"
            :target="channel.href.startsWith('http') ? '_blank' : undefined"
            :rel="channel.href.startsWith('http') ? 'noopener noreferrer' : undefined"
          >
            {{ channel.text
            }}<span v-if="channel.href.startsWith('http')" class="sr-only"> (새 창)</span>
          </a>
          <span v-else class="my-page__row-value">{{ channel.text }}</span>
        </li>
      </ul>
    </section>

    <section class="my-page__section" aria-labelledby="my-legal-title">
      <h2 id="my-legal-title" class="my-page__section-title">약관 및 정책</h2>
      <ul class="my-page__links">
        <li v-for="link in LEGAL_LINKS" :key="link.to">
          <NuxtLink :to="link.to" class="my-page__link">
            <span>{{ link.label }}</span>
            <ChevronRightIcon class="my-page__chev" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.my-page {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 24px 20px 32px;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.my-page__title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--n-color-neutral-900, #171717);
}

.my-page__login {
  padding: 20px 18px;
  border-radius: 18px;
  background: var(--n-color-primary-50, #f1edff);
}

.my-page__login-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--n-color-neutral-900, #171717);
}

.my-page__login-desc {
  margin: 6px 0 14px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-600, #525252);
}

.my-page__login-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 48px;
  border-radius: 12px;
  background: var(--n-color-primary-500, #6239ff);
  color: var(--n-color-neutral-0, #ffffff);
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
}

.my-page__login-link:focus-visible {
  outline: 2px solid var(--n-color-primary-700, #3f1cc0);
  outline-offset: 2px;
}

.my-page__section-title {
  margin: 0 0 10px;
  font-size: 15px;
  font-weight: 700;
  color: var(--n-color-neutral-900, #171717);
}

.my-page__rows,
.my-page__links {
  margin: 0;
  padding: 0;
  list-style: none;
}

.my-page__row {
  display: flex;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--n-color-neutral-100, #f5f5f5);
  font-size: 14px;
  line-height: 1.6;
}

.my-page__row-label {
  flex-shrink: 0;
  min-width: 92px;
  color: var(--n-color-neutral-500, #737373);
}

.my-page__row-value {
  color: var(--n-color-neutral-900, #171717);
  font-weight: 600;
}

.my-page__row-value--link {
  color: var(--n-color-primary-600, #5025e8);
  text-decoration: underline;
  text-underline-offset: 2px;
}

.my-page__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0;
  border-bottom: 1px solid var(--n-color-neutral-100, #f5f5f5);
  color: var(--n-color-neutral-900, #171717);
  font-size: 15px;
  text-decoration: none;
}

.my-page__chev {
  width: 18px;
  height: 18px;
  color: var(--n-color-neutral-300, #d4d4d4);
}
</style>
