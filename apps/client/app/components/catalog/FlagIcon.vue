<script setup lang="ts">
// 원형 국기 — flag-icons(MIT) 1:1 SVG 를 자체 호스팅(spec D-7). 이모지 국기는 Windows 에서 «CZ» 두 글자로 보여 쓰지 않는다.
// 나라 이름이 항상 옆에 있으므로 장식 이미지(alt="")다. 컴포넌트 테스트가 Nuxt 없이 그린다 — vue 에서 명시 import 한다.
import { computed } from 'vue'
import { flagUrl, type AssetManifest } from '#shared/catalog/assets'
import manifest from '~/content/catalog-assets.json'

const props = withDefaults(defineProps<{ iso2: string; size?: number }>(), { size: 24 })
const src = computed(() => flagUrl(manifest as AssetManifest, props.iso2))
</script>

<template>
  <img
    class="flag-icon"
    :src="src"
    alt=""
    :width="size"
    :height="size"
    loading="lazy"
    decoding="async"
  />
</template>

<style scoped>
.flag-icon {
  flex-shrink: 0;
  border-radius: 50%;
  object-fit: cover;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.08);
}
</style>
