<script setup lang="ts">
// 홈 (shell spec S-1 · catalog spec S-1) — 검색 진입 · «인기국가 · 다국가» 탭 격자(D-5 · 유심사 배치) ·
// 주문번호 조회 카드(D-8 — 격자 아래) · 바로가기. 격자 목록은 app/content/popular.ts, 이름 · 국기는 카탈로그.
import {
  BookOpenIcon,
  ChatBubbleLeftRightIcon,
  ChevronRightIcon,
  DevicePhoneMobileIcon,
  MagnifyingGlassIcon,
} from '@heroicons/vue/24/outline'
import { HOME_META } from '#shared/catalog/seo'
import FlagIcon from '~/components/catalog/FlagIcon.vue'
import UnderlineTabs from '~/components/catalog/UnderlineTabs.vue'
import OrderLookupForm from '~/components/order/OrderLookupForm.vue'

useCatalogSeo(HOME_META)
const { data: home, error } = await useFetch('/api/catalog/home', { key: 'catalog-home' })
// 데이터 라우트가 실패하면 빈 격자로 두지 않는다 — 페이지를 500 으로 던져 프리렌더(빌드)를 멈춘다(S-1).
// useFetch 는 에러를 삼키고 페이지는 200 으로 굳기 때문에 여기서 다시 던져야 한다.
if (error.value || !home.value)
  throw createError({ statusCode: 500, statusMessage: 'Catalog home unavailable', fatal: true })
const tabs = [
  { key: 'popular', label: '인기국가' },
  { key: 'multi', label: '다국가' },
] as const
const tab = ref<(typeof tabs)[number]['key']>('popular')
const tiles = computed(() => (tab.value === 'popular' ? home.value!.popular : home.value!.multi))

const shortcuts = [
  { to: '/guide', label: '설치 가이드', sub: '출발 전에 미리 설치해 두세요', icon: BookOpenIcon },
  {
    to: '/supported-devices',
    label: '지원 기기 확인',
    sub: '내 휴대폰에서 eSIM 을 쓸 수 있는지 확인해요',
    icon: DevicePhoneMobileIcon,
  },
  { to: '/my#cs', label: '고객센터', sub: '궁금한 점을 물어보세요', icon: ChatBubbleLeftRightIcon },
]
</script>

<template>
  <div class="home">
    <section class="home__hero" aria-labelledby="home-title">
      <h1 id="home-title" class="home__title">어느 나라로 떠나세요?</h1>
      <NuxtLink to="/search" class="home__search">
        <MagnifyingGlassIcon class="home__search-icon" aria-hidden="true" />
        <span>나라나 도시 이름으로 찾기</span>
      </NuxtLink>
    </section>

    <section class="home__catalog" aria-label="나라 고르기">
      <UnderlineTabs v-model="tab" :tabs="[...tabs]" label="나라 목록" id-prefix="home" />
      <div id="home-panel" class="home__grid" role="tabpanel" :aria-labelledby="`home-tab-${tab}`">
        <NuxtLink v-for="t in tiles" :key="t.to" :to="t.to" class="home__tile">
          <span class="home__tile-flags" :class="{ 'home__tile-flags--many': t.iso2s.length > 1 }">
            <FlagIcon
              v-for="iso2 in t.iso2s"
              :key="iso2"
              :iso2="iso2"
              :size="t.iso2s.length > 1 ? 24 : 32"
            />
          </span>
          <span class="home__tile-name">{{ t.label }}</span>
          <span class="home__tile-badge">{{ t.badge }}</span>
        </NuxtLink>
      </div>
      <NuxtLink to="/search" class="home__more">
        전체 국가 보기
        <ChevronRightIcon class="home__more-icon" aria-hidden="true" />
      </NuxtLink>
    </section>

    <section class="home__card" aria-labelledby="home-lookup-title">
      <h2 id="home-lookup-title" class="home__card-title">이미 구매하셨나요?</h2>
      <p class="home__card-desc">
        스마트스토어 주문번호를 넣으면 QR 코드를 발급하거나 다시 볼 수 있어요.
      </p>
      <OrderLookupForm input-id="home-order-lookup" />
    </section>

    <section class="home__shortcuts" aria-label="바로가기">
      <ul class="home__shortcut-list">
        <li v-for="item in shortcuts" :key="item.to">
          <NuxtLink :to="item.to" class="home__shortcut">
            <span class="home__shortcut-icon">
              <component :is="item.icon" aria-hidden="true" />
            </span>
            <span class="home__shortcut-text">
              <span class="home__shortcut-label">{{ item.label }}</span>
              <span class="home__shortcut-sub">{{ item.sub }}</span>
            </span>
            <ChevronRightIcon class="home__shortcut-chev" aria-hidden="true" />
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px 20px 32px;
  word-break: keep-all;
  overflow-wrap: break-word;
}

.home__title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  line-height: 1.4;
  color: var(--n-color-neutral-900, #171717);
  text-wrap: balance;
}

.home__search {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  padding: 14px 16px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: 14px;
  background: var(--n-color-neutral-50, #fafafa);
  color: var(--n-color-neutral-500, #737373);
  font-size: 15px;
  text-decoration: none;
}

.home__search:focus-visible {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
  outline-offset: 2px;
}

.home__search-icon {
  width: 20px;
  height: 20px;
  color: var(--n-color-neutral-500, #737373);
}

.home__catalog {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 8px;
}

.home__grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.home__tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 6px 12px;
  border: 1px solid var(--n-color-neutral-200, #e5e5e5);
  border-radius: 14px;
  color: inherit;
  text-align: center;
  text-decoration: none;
}

.home__tile:focus-visible {
  outline: 2px solid var(--n-color-primary-500, #6239ff);
  outline-offset: 2px;
}

.home__tile-flags {
  display: flex;
  justify-content: center;
}

.home__tile-flags--many > * + * {
  margin-left: -6px;
}

.home__tile-name {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.35;
  color: var(--n-color-neutral-900, #171717);
}

.home__tile-badge {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--n-color-primary-50, #f1edff);
  color: var(--n-color-primary-600, #5025e8);
  font-size: 11.5px;
  font-weight: 700;
}

.home__more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 42px;
  border-radius: 12px;
  background: var(--n-color-neutral-50, #fafafa);
  color: var(--n-color-neutral-600, #525252);
  font-size: 14px;
  text-decoration: none;
}

.home__more-icon {
  width: 16px;
  height: 16px;
}

.home__card {
  margin-top: 8px;
  padding: 20px 18px;
  border: 1px solid var(--n-color-neutral-100, #f5f5f5);
  border-radius: 18px;
  background: var(--n-color-neutral-0, #ffffff);
  box-shadow:
    0 1px 2px rgba(15, 23, 42, 0.04),
    0 8px 24px -16px rgba(15, 23, 42, 0.12);
}

.home__card-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--n-color-neutral-900, #171717);
}

.home__card-desc {
  margin: 6px 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--n-color-neutral-600, #525252);
  text-wrap: pretty;
}

.home__shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home__shortcut {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 4px;
  border-radius: 12px;
  color: inherit;
  text-decoration: none;
}

.home__shortcut:hover {
  background: var(--n-color-neutral-50, #fafafa);
}

.home__shortcut-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: var(--n-color-primary-50, #f1edff);
  color: var(--n-color-primary-600, #5025e8);
}

.home__shortcut-icon svg {
  width: 22px;
  height: 22px;
}

.home__shortcut-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-width: 0;
}

.home__shortcut-label {
  font-size: 15px;
  font-weight: 700;
  color: var(--n-color-neutral-900, #171717);
}

.home__shortcut-sub {
  font-size: 13px;
  line-height: 1.5;
  color: var(--n-color-neutral-500, #737373);
}

.home__shortcut-chev {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  color: var(--n-color-neutral-300, #d4d4d4);
}
</style>
