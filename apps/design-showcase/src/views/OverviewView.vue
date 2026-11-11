<template>
  <div>
    <div class="showcase-section">
      <h1 class="showcase-section__title">Nomacom Design System</h1>
      <p class="showcase-section__desc">
        Vue 3 + React Native 기반 공유 디자인 시스템. 디자인 토큰, 컴포넌트, Composable을
        제공합니다.
      </p>
    </div>

    <div class="showcase-section">
      <h2 class="showcase-section__title">NLogo</h2>
      <p class="showcase-section__desc">
        <span class="showcase-code">variant</span>: <code>eng</code> | <code>kor</code> |
        <code>square</code>
      </p>

      <h3 class="logo-subtitle">라이트 배경</h3>
      <div class="logo-row logo-row--light">
        <div class="logo-cell">
          <NLogo variant="eng" size="lg" />
          <div class="logo-cap">eng</div>
        </div>
        <div class="logo-cell">
          <NLogo variant="kor" size="lg" />
          <div class="logo-cap">kor</div>
        </div>
        <div class="logo-cell">
          <NLogo variant="square" size="lg" />
          <div class="logo-cap">square</div>
        </div>
      </div>

      <h3 class="logo-subtitle">다크 배경</h3>
      <div class="logo-row logo-row--dark">
        <div class="logo-cell">
          <NLogo variant="eng" size="lg" />
          <div class="logo-cap">eng</div>
        </div>
        <div class="logo-cell">
          <NLogo variant="kor" size="lg" />
          <div class="logo-cap">kor</div>
        </div>
        <div class="logo-cell">
          <NLogo variant="square" size="lg" />
          <div class="logo-cap">square</div>
        </div>
      </div>

      <h3 class="logo-subtitle">사이즈 (eng)</h3>
      <div class="logo-row logo-row--light logo-row--baseline">
        <div class="logo-cell">
          <NLogo variant="eng" size="sm" />
          <div class="logo-cap">sm</div>
        </div>
        <div class="logo-cell">
          <NLogo variant="eng" size="md" />
          <div class="logo-cap">md</div>
        </div>
        <div class="logo-cell">
          <NLogo variant="eng" size="lg" />
          <div class="logo-cap">lg</div>
        </div>
        <div class="logo-cell">
          <NLogo variant="eng" size="xl" />
          <div class="logo-cap">xl</div>
        </div>
      </div>
    </div>

    <div class="showcase-grid">
      <div class="showcase-card">
        <div class="showcase-card__title">패키지</div>
        <div class="showcase-stack">
          <div><span class="showcase-code">@imjohnkoo/design-tokens</span> — 디자인 토큰</div>
          <div><span class="showcase-code">@imjohnkoo/design-vue</span> — Vue 3 컴포넌트</div>
          <div>
            <span class="showcase-code">@imjohnkoo/design-mobile</span> — React Native 컴포넌트
          </div>
        </div>
      </div>

      <div class="showcase-card">
        <div class="showcase-card__title">Esimmany 신규 컴포넌트 (12)</div>
        <div class="showcase-stack">
          <div><span class="showcase-code">NStepProgress</span> — 4-dot 진행 표시</div>
          <div><span class="showcase-code">NPageHeading</span> — eyebrow + 큰 헤딩 + 보조설명</div>
          <div>
            <span class="showcase-code">NInfoChip</span> — rounded-full chip (주문번호 / 상품)
          </div>
          <div><span class="showcase-code">NStatusPill</span> — 상태 pill (6 colors)</div>
          <div><span class="showcase-code">NTrustNote</span> — 보안/안내 카드</div>
          <div><span class="showcase-code">NHighlightCard</span> — 브랜드 그라데이션 카드</div>
          <div><span class="showcase-code">NFieldCard</span> — 클릭형 dropdown 카드</div>
          <div><span class="showcase-code">NBottomSheet</span> — 하단 슬라이드 시트</div>
          <div><span class="showcase-code">NLoaderDialog</span> — 백드롭 블러 + 보라 스피너</div>
          <div>
            <span class="showcase-code">NDurationCalendar</span> — range + 한국식 + spillover
          </div>
          <div><span class="showcase-code">NCodeRow</span> — mono 코드 + copy</div>
          <div><span class="showcase-code">NLinkCard</span> — 외부 가이드 링크 카드</div>
        </div>
      </div>

      <div class="showcase-card">
        <div class="showcase-card__title">기존 컴포넌트 확장</div>
        <div class="showcase-stack">
          <div>
            <span class="showcase-code">NInput</span> —
            <code>variant="underline"</code> floating-label 추가
          </div>
          <div>
            <span class="showcase-code">NButton</span> — <code>size="xl"</code> sticky CTA preset +
            brand 그림자
          </div>
          <div>
            <span class="showcase-code">NAlertDialog</span> — 24px radius / 280px(size wide 340 · 토큰 dialog.width) / blur backdrop /
            64px icon-wrap
          </div>
          <div><span class="showcase-code">NSeparator</span> — 라벨 포함 구분선 (이전 추가)</div>
        </div>
      </div>

      <div class="showcase-card">
        <div class="showcase-card__title">디자인 토큰 갱신</div>
        <div class="showcase-stack">
          <div>
            <span class="showcase-code">primary</span> — #6239FF 중심 토스풍 보라 팔레트 (50~900)
          </div>
          <div><span class="showcase-code">radius.3xl</span> — 24px (modal / bottom-sheet)</div>
          <div><span class="showcase-code">shadow.cta-brand</span> — 보라 sticky CTA 그림자</div>
          <div><span class="showcase-code">shadow.modal</span> — 중앙 카드 그림자</div>
        </div>
      </div>

      <div class="showcase-card">
        <div class="showcase-card__title">Composable</div>
        <div class="showcase-stack">
          <div><span class="showcase-code">useCopyToClipboard</span> — 클립보드 복사</div>
          <div><span class="showcase-code">usePhoneFormat</span> — 전화번호 자동 포매팅</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NLogo } from '@imjohnkoo/design-vue'
</script>

<style scoped>
.logo-subtitle {
  margin: 20px 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #525252;
}

.logo-row {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #e5e5e5;
  margin-bottom: 8px;
}

.logo-row--light {
  background: #ffffff;
}

.logo-row--dark {
  background: #171717;
  border-color: #262626;
}

.logo-row--dark .logo-cap {
  color: #a3a3a3;
}

.logo-row--baseline {
  align-items: baseline;
}

.logo-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.logo-cap {
  font-size: 11px;
  color: #737373;
  font-family:
    ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
    monospace;
}
</style>
