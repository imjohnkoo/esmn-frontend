<script setup lang="ts">
// eSIM 지원 기기 본문(기준일 · 사용할 수 있어요 · 사용할 수 없어요) — /supported-devices 페이지와 하단 시트(DocSheet · spec D-48)가 같이 쓴다.
// 근거: docs/data/2026-08-19-esim-supported-devices-kr.md (웹검색 검증본)
import { NInfoChip } from '@imjohnkoo/design-vue'

// 아코디언 상태 — 복수 열림 허용, 기본 전부 접힘 (view 페이지 multi-QR 패턴)
const openKeys = ref<string[]>([])
const isOpen = (key: string) => openKeys.value.includes(key)
const toggle = (key: string) => {
  openKeys.value = isOpen(key)
    ? openKeys.value.filter((k) => k !== key)
    : [...openKeys.value, key]
}

interface DeviceGroup {
  brand: string
  models: string[]
  note?: string
}

const supportedGroups: DeviceGroup[] = [
  {
    brand: '아이폰',
    models: [
      'XS · XR',
      '11 ~ 15 전 모델 (Plus · Pro · mini)',
      '16e',
      '17 전 모델',
      '17e',
      'SE 2 · 3세대',
      '이후 출시 모델',
    ],
    note: '아이폰 17 Air 는 물리심 없이 eSIM 만 쓰는 eSIM 전용 모델이에요.',
  },
  {
    brand: 'iPad (셀룰러 모델)',
    models: [
      'Pro 11 전 세대',
      'Pro 12.9 3세대 이후',
      'Air 3세대 이후',
      'mini 5세대 이후',
      '기본 7세대 이후',
      '이후 출시 모델',
    ],
  },
  {
    brand: '갤럭시 (국내판)',
    models: [
      'S23 · S24 · S25 전 모델',
      'S25 Edge',
      'S26 · S26+ · S26 울트라',
      'Z 플립 4 · 5 · 6 · 7 · 8',
      'Z 폴드 4 · 5 · 6 · 7 · 8 · 8 울트라',
      'A35 · A36',
      'A54 · A55 · A56',
      '탭 S9+',
      '탭 S11 울트라 5G',
      '이후 출시 모델',
    ],
  },
  {
    brand: '갤럭시 (해외판)',
    models: ['Z 플립 · Z 폴드 1 ~ 8 해외판', 'S20 ~ S26 해외판'],
    note: '해외판 기기는 한국 통신사에 IMEI 등록이 되어 있어야 해요.',
  },
  {
    brand: 'Xiaomi (국내 정식 발매)',
    models: ['14T · 14T Pro', '15 Pro', '15 Ultra'],
    note: '15T Pro 는 국내판의 eSIM 지원 여부를 확인하고 있어요.',
  },
]

interface UnsupportedItem {
  title: string
  description: string
}

const unsupportedItems: UnsupportedItem[] = [
  {
    title: '갤럭시 S22 이하 국내판',
    description:
      'S22 · S21 · S20 시리즈, Note 20, Z 플립3 이전, Z 폴드3 이전 모델은 eSIM 하드웨어가 없어요.',
  },
  {
    title: '중국 본토에서 구매한 아이폰',
    description:
      '17 Air (eSIM 전용) 와 17e 만 eSIM 을 쓸 수 있어요. 그 외 전 모델 (17 · 17 Pro 포함) 은 물리심 전용이에요.',
  },
  {
    title: '홍콩 · 마카오에서 구매한 아이폰',
    description: '17 Air · 17e · 16e · 13 mini · 12 mini · SE 2 · 3세대 · XS 만 사용할 수 있어요.',
  },
  {
    title: '통신사 잠금 기기',
    description: '통신사 잠금 (캐리어 락) 이 걸린 기기에서는 사용할 수 없어요.',
  },
  {
    title: '한국 미유통 브랜드',
    description:
      'Google Pixel · OnePlus · Oppo · Vivo · Honor · 모토로라 등은 해외 구매 기기라면 한국 통신사 IMEI 등록 후 사용할 수 있어요.',
  },
]
</script>

<template>
  <div class="devices-content">
    <div class="devices-page__chip">
      <NInfoChip label="기준일" value="2026.08.19">
        <template #icon>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M8 2v4M16 2v4M3 10h18" />
          </svg>
        </template>
      </NInfoChip>
    </div>

    <!-- 호환 목록 -->
    <section class="devices-page__section">
      <h2 class="devices-page__section-title devices-page__section-title--ok">
        <span class="devices-page__badge devices-page__badge--ok">✓</span>
        사용할 수 있어요
      </h2>
      <ul class="devices-page__groups">
        <li v-for="group in supportedGroups" :key="group.brand" class="devices-page__card">
          <button class="devices-page__card-head" type="button" @click="toggle(group.brand)">
            <span class="devices-page__brand">{{ group.brand }}</span>
            <svg
              class="devices-page__chev"
              :class="{ 'devices-page__chev--open': isOpen(group.brand) }"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <div v-show="isOpen(group.brand)" class="devices-page__card-body">
            <ul class="devices-page__models">
              <li v-for="model in group.models" :key="model" class="devices-page__model">
                {{ model }}
              </li>
            </ul>
            <p v-if="group.note" class="devices-page__note">{{ group.note }}</p>
          </div>
        </li>
      </ul>
    </section>

    <!-- 불가 목록 -->
    <section class="devices-page__section">
      <h2 class="devices-page__section-title devices-page__section-title--no">
        <span class="devices-page__badge devices-page__badge--no">✕</span>
        사용할 수 없어요
      </h2>
      <ul class="devices-page__groups">
        <li
          v-for="item in unsupportedItems"
          :key="item.title"
          class="devices-page__card devices-page__card--no"
        >
          <button class="devices-page__card-head" type="button" @click="toggle(item.title)">
            <span class="devices-page__brand devices-page__brand--no">{{ item.title }}</span>
            <svg
              class="devices-page__chev devices-page__chev--no"
              :class="{ 'devices-page__chev--open': isOpen(item.title) }"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <div v-show="isOpen(item.title)" class="devices-page__card-body">
            <p class="devices-page__desc">{{ item.description }}</p>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.devices-page__chip {
  margin-top: 18px;
}

.devices-page__section {
  margin-top: 32px;
}

.devices-page__section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.devices-page__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 700;
}

.devices-page__badge--ok {
  background: #ecfdf5;
  color: #059669;
}

.devices-page__badge--no {
  background: #fef2f2;
  color: #dc2626;
}

.devices-page__groups {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 14px 0 0;
  padding: 0;
  list-style: none;
}

.devices-page__card {
  background: #f9fafb;
  border-radius: 14px;
}

.devices-page__card--no {
  background: #fef2f2;
}

.devices-page__card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  padding: 16px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}

.devices-page__card-body {
  padding: 0 16px 16px;
}

.devices-page__chev {
  flex-shrink: 0;
  color: #9ca3af;
  transition: transform 180ms ease;
}

.devices-page__chev--no {
  color: #f0a3a3;
}

.devices-page__chev--open {
  transform: rotate(180deg);
}

.devices-page__brand {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.devices-page__brand--no {
  color: #dc2626;
}

.devices-page__models {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.devices-page__model {
  padding: 5px 10px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  color: #374151;
  line-height: 1.4;
}

.devices-page__note {
  margin: 10px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.55;
}

.devices-page__desc {
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
}
</style>
