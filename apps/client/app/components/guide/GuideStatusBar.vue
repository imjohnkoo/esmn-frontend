<script setup lang="ts">
// 상태 표시줄 그림(client-guide spec S-2 · S-3) — 현지에서만 볼 수 있는 화면이라 캡처 대신 그린다(2609 guide.css .ig-status).
// 아이폰 = 듀얼 회선 신호(막대 4개 아이콘을 위아래로 나눈 모양) · 안드로이드 = 일반 신호 막대.
import type { GuideOs } from '~/content/guide/types'

defineProps<{ os: GuideOs }>()
</script>

<template>
  <div
    class="g-status"
    role="img"
    :aria-label="
      os === 'ios'
        ? '상태 표시줄 예시 — 신호 표시가 위아래 두 칸으로 나뉘고 5G 가 뜬 모습. 위 칸은 여행용 eSIM, 아래 칸은 한국 회선'
        : '상태 표시줄 예시 — 5G 와 신호 표시가 뜬 모습. 5G 또는 LTE 가 뜨면 연결된 것'
    "
  >
    <div class="g-status__bar">
      <span>{{ os === 'ios' ? '9:41' : '12:45' }}</span>
      <span class="g-status__right">
        <template v-if="os === 'ios'">
          <span class="g-dual" aria-hidden="true"><b /><b /><b /><b /></span>
          <span class="g-status__net">5G</span>
        </template>
        <template v-else>
          <span class="g-status__net">5G</span>
          <span class="g-sig" aria-hidden="true"><b /><b /><b /><b /></span>
        </template>
        <span class="g-status__bat" aria-hidden="true" />
      </span>
    </div>
    <span v-if="os === 'ios'" class="g-status__cap">위 칸 = 여행용 eSIM · 아래 칸 = 한국 회선</span>
    <span v-else class="g-status__cap">신호 표시 + <b>5G</b> 또는 <b>LTE</b></span>
  </div>
</template>

<style scoped>
.g-status {
  box-sizing: border-box;
  display: grid;
  gap: 14px;
  justify-items: center;
  width: 100%;
  max-width: calc(368px + 10px);
  margin: 12px auto 0;
  padding: 22px 18px;
  border: 5px solid #1d1d1f;
  border-radius: 26px;
  background: #fff;
  box-shadow: 0 14px 30px -18px rgba(17, 17, 17, 0.45);
}

.g-status__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  box-sizing: border-box;
  padding: 10px 16px;
  border-radius: var(--n-radius-full, 9999px);
  background: var(--n-color-neutral-100, #f5f5f5);
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.g-status__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 아이폰 듀얼 회선 신호 — 아래 칸 네모 4개, 위 칸은 오른쪽으로 갈수록 높아진다 */
.g-dual {
  display: flex;
  align-items: flex-end;
  gap: 2.4px;
  height: 18px;
}

.g-dual b {
  display: grid;
  grid-template-rows: auto 5px;
  row-gap: 2px;
  width: 5px;
}

.g-dual b::before,
.g-dual b::after {
  content: '';
  border-radius: 1.6px;
  background: var(--n-color-neutral-900, #171717);
}

.g-dual b::before {
  height: var(--h);
}

.g-dual b:nth-child(1),
.g-dual b:nth-child(2) {
  --h: 5px;
}

.g-dual b:nth-child(3) {
  --h: 7.5px;
}

.g-dual b:nth-child(4) {
  --h: 11px;
}

.g-sig {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 16px;
}

.g-sig b {
  width: 4px;
  border-radius: 1.5px;
  background: var(--n-color-neutral-900, #171717);
}

.g-sig b:nth-child(1) {
  height: 5px;
}

.g-sig b:nth-child(2) {
  height: 8px;
}

.g-sig b:nth-child(3) {
  height: 12px;
}

.g-sig b:nth-child(4) {
  height: 16px;
}

.g-status__net {
  padding: 0 6px;
  border-radius: 5px;
  background: var(--n-color-primary-500, #6239ff);
  color: #fff;
  font-size: 14px;
  font-weight: 800;
}

.g-status__bat {
  position: relative;
  width: 28px;
  height: 13px;
  border: 2px solid var(--n-color-neutral-900, #171717);
  border-radius: 4px;
}

.g-status__bat::after {
  content: '';
  position: absolute;
  inset: 2px 6px 2px 2px;
  border-radius: 1px;
  background: var(--n-color-neutral-900, #171717);
}

.g-status__cap {
  font-size: 14px;
  font-weight: 700;
  color: var(--n-color-neutral-600, #525252);
  text-align: center;
}

.g-status__cap b {
  color: var(--n-color-primary-600, #5025e8);
}
</style>
