<script setup lang="ts">
// zone 지도(catalog spec F-7) — 축소 SVG(자사 자산 · 해시 파일명) 위에 도시 핀을 % 좌표로 겹친다(2609 pins.json 그대로).
// 라벨 위아래 보정(labelShift)은 2609 labelStyle(top 8px · −24px = 라벨 한 줄 아래 · 위)을 라벨 높이 100% 로 옮긴 것이다.
// 지도 viewBox 1183.6 × 1015.8 비율을 고정해 핀이 어긋나지 않게 한다.
import { mapUrl, type AssetManifest } from '#shared/catalog/assets'
import type { PinView } from '#shared/catalog/types'
import manifest from '~/content/catalog-assets.json'

const props = defineProps<{ src: string; pins: PinView[]; alt: string }>()
const url = computed(() => mapUrl(manifest as AssetManifest, props.src))
</script>

<template>
  <figure class="zone-map">
    <img class="zone-map__img" :src="url" :alt="alt" loading="lazy" decoding="async" />
    <span
      v-for="p in pins"
      :key="p.name"
      class="zone-map__pin"
      :class="{
        'zone-map__pin--big': p.big,
        'zone-map__pin--left': p.labelLeft,
        'zone-map__pin--down': p.labelShift === 'down',
        'zone-map__pin--up': p.labelShift === 'up',
      }"
      :style="{ left: `${p.x}%`, top: `${p.y}%` }"
      aria-hidden="true"
    >
      <i />
      <em>{{ p.name }}</em>
    </span>
  </figure>
</template>

<style scoped>
.zone-map {
  position: relative;
  margin: 8px 0 0;
  overflow: hidden;
  border-radius: 14px;
  background: #ededed;
  aspect-ratio: 1183.5554 / 1015.8372;
}

.zone-map__img {
  display: block;
  width: 100%;
  height: 100%;
}

.zone-map__pin {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 3px;
  transform: translate(-5px, -50%);
}

.zone-map__pin--left {
  flex-direction: row-reverse;
  transform: translate(calc(-100% + 5px), -50%);
}

.zone-map__pin i {
  flex-shrink: 0;
  width: 9px;
  height: 9px;
  border: 2px solid #fff;
  border-radius: 50%;
  background: var(--n-color-primary-700, #3f1cc0);
  box-shadow: 0 0 0 1px var(--n-color-primary-700, #3f1cc0);
}

.zone-map__pin--big i {
  width: 12px;
  height: 12px;
}

.zone-map__pin em {
  padding: 0 4px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.92);
  font-size: 10.5px;
  font-style: normal;
  font-weight: 700;
  color: var(--n-color-neutral-900, #171717);
  white-space: nowrap;
}

.zone-map__pin--down em {
  transform: translateY(100%);
}

.zone-map__pin--up em {
  transform: translateY(-100%);
}
</style>
