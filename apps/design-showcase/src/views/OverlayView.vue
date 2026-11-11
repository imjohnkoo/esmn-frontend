<template>
  <div>
    <div class="showcase-section">
      <h1 class="showcase-section__title">Overlay</h1>
      <p class="showcase-section__desc">
        모달, 경고 다이얼로그, 확인 다이얼로그 등 오버레이 컴포넌트입니다.
      </p>
    </div>

    <div class="showcase-grid">
      <!-- NModal -->
      <div class="showcase-card">
        <div class="showcase-card__title">NModal</div>
        <div class="showcase-stack">
          <NButton size="sm" @click="modalOpen = true">모달 열기</NButton>
        </div>

        <NModal
          v-model="modalOpen"
          title="기본 모달"
          description="표준 대화상자입니다."
        >
          <template #body>
            <p style="font-size: 14px; color: var(--n-color-neutral-600); line-height: 1.6;">
              모달 본문 콘텐츠입니다. 폼, 상세 정보, 알림 등 다양한 용도로 사용합니다.
            </p>
          </template>
          <template #footer>
            <NButton variant="outline" size="sm" @click="modalOpen = false">취소</NButton>
            <NButton size="sm" @click="modalOpen = false">확인</NButton>
          </template>
        </NModal>
      </div>

      <!-- NAlertDialog (NEW) -->
      <div class="showcase-card">
        <div class="showcase-card__title">NAlertDialog <span class="showcase-code">NEW</span></div>
        <div class="showcase-stack">
          <NButton size="sm" variant="outline" @click="alertInfoOpen = true">정보 알림</NButton>
          <NButton size="sm" variant="outline" @click="alertErrorOpen = true">오류 알림</NButton>
          <NButton size="sm" variant="outline" @click="alertSuccessOpen = true">성공 알림</NButton>
          <NButton size="sm" variant="outline" @click="alertWarningOpen = true">경고 알림</NButton>
        </div>

        <NAlertDialog
          v-model="alertInfoOpen"
          color="info"
          title="주문데이터를 불러오지 못했습니다."
          description="한번 더 주문 정보를 입력해 주세요."
        />

        <NAlertDialog
          v-model="alertErrorOpen"
          color="error"
          title="주문번호가 일치하지 않습니다."
          description="주문하실때 입력한 전화번호와 이름을 입력해 주세요."
        />

        <NAlertDialog
          v-model="alertSuccessOpen"
          color="success"
          title="주문이 확인되었습니다."
          description="다음 단계로 진행합니다."
        />

        <NAlertDialog
          v-model="alertWarningOpen"
          color="warning"
          title="취소된 주문입니다."
          description="취소를 철회하시거나 다시 구매해 주세요."
        />
      </div>

      <!-- NAlertDialog with actions -->
      <div class="showcase-card">
        <div class="showcase-card__title">NAlertDialog + 액션 버튼</div>
        <div class="showcase-stack">
          <NButton size="sm" variant="outline" @click="alertWithActionOpen = true">서버 오류 알림</NButton>
          <NButton size="sm" variant="outline" @click="alertWideOpen = true">size="wide" (340)</NButton>
        </div>

        <NAlertDialog
          v-model="alertWithActionOpen"
          color="error"
          title="문제가 발생했습니다."
          description="고객센터로 문의해 주세요."
        >
          <template #actions>
            <NButton size="sm" @click="alertWithActionOpen = false">확인</NButton>
          </template>
        </NAlertDialog>

        <!-- size="wide" — 요약 표 · 필수 동의 체크처럼 내용이 많은 확인만(토큰 dialog.width.wide) -->
        <NAlertDialog
          v-model="alertWideOpen"
          color="primary"
          size="wide"
          title="이 내용으로 발급할까요?"
          description="요약 · 동의 체크가 들어가는 확인은 wide(340) 를 쓴다."
        >
          <template #actions>
            <NButton size="sm" @click="alertWideOpen = false">확인</NButton>
          </template>
        </NAlertDialog>
      </div>

      <!-- NConfirmDialog (NEW) -->
      <div class="showcase-card">
        <div class="showcase-card__title">NConfirmDialog <span class="showcase-code">NEW</span></div>
        <div class="showcase-stack">
          <NButton size="sm" @click="confirmDefaultOpen = true">일반 확인</NButton>
          <NButton size="sm" variant="danger" @click="confirmDangerOpen = true">위험 확인</NButton>
          <div v-if="confirmResult !== null" style="font-size: 14px; color: var(--n-color-neutral-600);">
            결과: {{ confirmResult }}
          </div>
        </div>

        <NConfirmDialog
          v-model="confirmDefaultOpen"
          title="QR코드를 발급하시겠습니까?"
          message="발급 후에는 취소와 환불이 불가합니다."
          confirm-text="QR 발급하기"
          cancel-text="뒤로가기"
          @confirm="confirmResult = '확인됨'"
          @cancel="confirmResult = '취소됨'"
        />

        <NConfirmDialog
          v-model="confirmDangerOpen"
          title="주문을 삭제하시겠습니까?"
          message="이 작업은 되돌릴 수 없습니다."
          confirm-text="삭제"
          cancel-text="유지"
          variant="danger"
          @confirm="confirmResult = '삭제됨'"
          @cancel="confirmResult = '취소됨'"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  NButton,
  NModal,
  NAlertDialog,
  NConfirmDialog,
} from '@imjohnkoo/design-vue'

const modalOpen = ref(false)

const alertInfoOpen = ref(false)
const alertErrorOpen = ref(false)
const alertSuccessOpen = ref(false)
const alertWarningOpen = ref(false)
const alertWithActionOpen = ref(false)
const alertWideOpen = ref(false)

const confirmDefaultOpen = ref(false)
const confirmDangerOpen = ref(false)
const confirmResult = ref<string | null>(null)
</script>
