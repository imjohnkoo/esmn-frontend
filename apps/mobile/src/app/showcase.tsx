/**
 * design-mobile 컴포넌트 showcase — Storybook 대체 경로.
 *
 * `dev:web` 으로 http://localhost:8081/showcase 에서 보거나,
 * `expo export --platform web` 으로 정적 HTML 로 뽑을 수 있다.
 * 앱과 같은 RN 런타임/React 19 를 그대로 쓰므로 실제 화면과 렌더 결과가 일치한다.
 *
 * 제품 흐름에서 이 라우트로 가는 링크는 없다 (내부 확인용).
 */
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import {
  NAlert,
  NAlertDialog,
  NAvatar,
  NBadge,
  NBottomSheet,
  NButton,
  NCard,
  NCheckbox,
  NCodeRow,
  NDivider,
  NDurationCalendar,
  NFieldCard,
  NHeader,
  NHighlightCard,
  NInfoChip,
  NInput,
  NLinkCard,
  NLoaderDialog,
  NLottie,
  NPageHeading,
  NSkeleton,
  NStatusPill,
  NStepProgress,
  NSwitch,
  NTabBar,
  NText,
  NTrustNote,
  theme,
  useReducedMotion,
  type CalDate,
} from '@imjohnkoo/design-mobile'
import checkSuccess from '@imjohnkoo/design-assets/lottie/check-success.json'

function Section({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {meta && <Text style={styles.sectionMeta}>{meta}</Text>}
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  )
}

/** Reanimated 4 + theme.motion — 누름 scale .97 · press · out. 줄이기 켬이면 Reanimated 가 스스로 건너뛴다(ReduceMotion.System) */
function PressDemo() {
  const scale = useSharedValue(1)
  const timing = { duration: theme.motion.duration.press, easing: Easing.bezier(...theme.motion.easing.out) }
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return (
    <Pressable
      onPressIn={() => (scale.value = withTiming(0.97, timing))}
      onPressOut={() => (scale.value = withTiming(1, timing))}
    >
      <Animated.View style={[styles.pressDemo, style]}>
        <Text style={styles.pressDemoText}>눌러 보기 (Reanimated)</Text>
      </Animated.View>
    </Pressable>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>
}

export default function Showcase() {
  const [checked, setChecked] = useState(true)
  const [switched, setSwitched] = useState(true)
  const [text, setText] = useState('')
  const [tab, setTab] = useState('home')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [calSheetOpen, setCalSheetOpen] = useState(false)
  const [dialog, setDialog] = useState<null | 'primary' | 'warning' | 'error'>(null)
  const [loaderOpen, setLoaderOpen] = useState(false)
  const [calDate, setCalDate] = useState<CalDate | null>(null)
  const reduced = useReducedMotion()
  const [replay, setReplay] = useState(0)
  const [completed, setCompleted] = useState(0)

  const showLoader = () => {
    setLoaderOpen(true)
    setTimeout(() => setLoaderOpen(false), 1600)
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.h1}>@imjohnkoo/design-mobile</Text>
        <Text style={styles.h1sub}>0.3.1 · React Native Web 렌더 · 컴포넌트 27종</Text>
      </View>

      {/* ───────────── Flow set (0.3.1 신규 12종) ───────────── */}
      <Text style={styles.groupLabel}>Flow — 4-step 발급 흐름 세트 (0.3.1 신규)</Text>

      <Section title="NStepProgress" meta="step / total / label">
        <NStepProgress step={1} total={4} label="본인 확인" />
        <View style={styles.gap} />
        <NStepProgress step={3} total={4} label="사용 일시" />
        <View style={styles.gap} />
        <NStepProgress step={4} total={4} label="발급 완료" />
      </Section>

      <Section title="NPageHeading" meta="eyebrow + title + description, \n 줄바꿈">
        <NPageHeading
          eyebrow="eSIM QR 코드 발급"
          title={'주문하신 분이\n맞는지 확인할게요'}
          description={'주문 시 입력하신 이름과 전화번호를\n그대로 입력해 주세요.'}
        />
      </Section>

      <Section title="NInfoChip" meta="label + value + icon">
        <Row>
          <NInfoChip label="주문번호" value="2026081900123" />
          <NInfoChip value="일본 8일 매일 1GB" />
        </Row>
      </Section>

      <Section title="NStatusPill" meta="color 6종 · dot">
        <Row>
          <NStatusPill color="success" dot>주문완료</NStatusPill>
          <NStatusPill color="info" dot>발급완료</NStatusPill>
          <NStatusPill color="warning" dot>확인필요</NStatusPill>
          <NStatusPill color="error" dot>취소됨</NStatusPill>
          <NStatusPill color="primary">브랜드</NStatusPill>
          <NStatusPill color="neutral">기본</NStatusPill>
        </Row>
      </Section>

      <Section title="NTrustNote" meta="title(강조) + 본문">
        <NTrustNote title="사용 일수는 첫 연결 시점부터 24시간 단위로 차감돼요.">
          현지에 도착해 처음 회선이 연결된 순간부터 24시간이 지나면 1일이 차감돼요. 선택한 날짜에
          도착하지 않아도 실제 연결 전까지는 사용일이 줄지 않아요.
        </NTrustNote>
        <View style={styles.gap} />
        <NTrustNote title="다국가 이심은 자동 로밍으로 그대로 사용할 수 있어요.">
          한 번 개통된 다음에는 포함된 국가들을 오가도 추가 설치나 설정 변경 없이 자동으로 연결돼요.
        </NTrustNote>
      </Section>

      <Section title="NHighlightCard" meta="brand-50 요약 카드">
        <NHighlightCard>
          <Text style={styles.previewText}>
            eSIM 사용 예상 기간은{' '}
            <Text style={styles.previewStrong}>2026.09.01 (화) ~ 2026.09.09 (수)</Text> 이에요.
          </Text>
        </NHighlightCard>
      </Section>

      <Section title="NFieldCard" meta="탭형 dropdown trigger · active / error">
        <NFieldCard label="시작 국가" placeholder="국가를 선택해 주세요" onPress={() => setSheetOpen(true)} />
        <View style={styles.gap} />
        <NFieldCard label="시작 국가" value="일본 · Asia/Tokyo" active onPress={() => setSheetOpen(true)} />
        <View style={styles.gap} />
        <NFieldCard label="시작 날짜" placeholder="날짜를 선택해 주세요" error onPress={() => setCalSheetOpen(true)} />
      </Section>

      <Section title="NDurationCalendar" meta="시작일 선택 + duration range">
        <NDurationCalendar value={calDate} onChange={setCalDate} duration={8} />
        <Text style={styles.hint}>
          선택값: {calDate ? `${calDate.year}.${calDate.month}.${calDate.day}` : '(없음)'} · duration 8일
        </Text>
      </Section>

      <Section title="NAlertDialog" meta="color 별 · actions 슬롯 · primary 는 size wide">
        <Row>
          <NButton size="sm" onPress={() => setDialog('primary')}>primary</NButton>
          <NButton size="sm" variant="secondary" onPress={() => setDialog('warning')}>warning</NButton>
          <NButton size="sm" variant="danger" onPress={() => setDialog('error')}>error</NButton>
        </Row>
      </Section>

      <Section title="NLoaderDialog" meta="1.6초 뒤 자동 닫힘">
        <NButton size="sm" variant="outline" onPress={showLoader}>로더 띄우기</NButton>
      </Section>

      <Section title="NLottie" meta="결과 일러스트 · 동작 줄이기 켬 = 정지 프레임(last-frame)">
        <Row>
          <NLottie
            key={replay}
            source={checkSuccess}
            label="발급 완료"
            onComplete={() => setCompleted((n) => n + 1)}
          />
          <View style={{ gap: 8 }}>
            <Text style={styles.sectionMeta}>동작 줄이기: {reduced ? '켬 — 정지 프레임' : '끔 — 재생'}</Text>
            <Text style={styles.sectionMeta}>complete {completed}회</Text>
            <NButton size="sm" variant="outline" onPress={() => setReplay((n) => n + 1)}>다시 재생</NButton>
          </View>
        </Row>
        <View style={styles.gap} />
        <PressDemo />
      </Section>

      <Section title="NCodeRow" meta="mono value + 복사 (onCopy 콜백)">
        <NCodeRow label="SM-DP+ 주소" value="smdp.maya.net" onCopy={() => {}} />
        <NCodeRow
          label="LPA 전체"
          value="LPA:1$smdp.maya.net$K2-1A2B3C-4D5E6F"
          onCopy={() => {}}
        />
        <NCodeRow label="복사 버튼 없음 (onCopy 미지정)" value="selectable 텍스트만 제공" />
      </Section>

      <Section title="NLinkCard" meta="외부 가이드 링크">
        <NLinkCard label="아이폰 설치 가이드" sub="iOS · Universal Link 자동 설치" onPress={() => {}} />
        <View style={styles.gap} />
        <NLinkCard label="안드로이드 설치 가이드" sub="Galaxy · Pixel · 수동 등록" onPress={() => {}} />
      </Section>

      {/* ───────────── Base / Form / Layout / Feedback / Navigation (0.3.0) ───────────── */}
      <Text style={styles.groupLabel}>Base (0.3.0)</Text>

      <Section title="NText" meta="variant 7종">
        <NText variant="h1">H1 헤딩</NText>
        <NText variant="h2">H2 헤딩</NText>
        <NText variant="h3">H3 헤딩</NText>
        <NText variant="body">Body — 본문 텍스트입니다.</NText>
        <NText variant="bodySmall">BodySmall — 작은 본문입니다.</NText>
        <NText variant="label">Label — 라벨</NText>
        <NText variant="caption">Caption — 캡션</NText>
      </Section>

      <Section title="NButton" meta="variant 5종 × size 4종 (xl = 0.3.1 신규)">
        <Row>
          <NButton variant="primary">Primary</NButton>
          <NButton variant="secondary">Secondary</NButton>
          <NButton variant="outline">Outline</NButton>
          <NButton variant="ghost">Ghost</NButton>
          <NButton variant="danger">Danger</NButton>
        </Row>
        <View style={styles.gap} />
        <Row>
          <NButton size="sm">sm</NButton>
          <NButton size="md">md</NButton>
          <NButton size="lg">lg</NButton>
        </Row>
        <View style={styles.gap} />
        <NButton size="xl" fullWidth>xl — CTA (h56, radius 2xl)</NButton>
        <View style={styles.gap} />
        <Row>
          <NButton loading>loading</NButton>
          <NButton disabled>disabled</NButton>
        </Row>
      </Section>

      <Section title="NAvatar / NBadge">
        <Row>
          <NAvatar text="김" size="sm" />
          <NAvatar text="김" size="md" />
          <NAvatar text="김" size="lg" />
          <NAvatar text="김" size="xl" />
        </Row>
        <View style={styles.gap} />
        <Row>
          <NBadge label="primary" color="primary" />
          <NBadge label="success" color="success" />
          <NBadge label="warning" color="warning" />
          <NBadge label="error" color="error" />
          <NBadge label="solid" color="primary" variant="solid" />
          <NBadge label="outline" color="primary" variant="outline" />
        </Row>
      </Section>

      <Text style={styles.groupLabel}>Form (0.3.0)</Text>

      <Section title="NInput" meta="label / hint / error / disabled">
        <NInput label="이름" placeholder="이름을 입력하세요" value={text} onChangeText={setText} />
        <View style={styles.gap} />
        <NInput label="전화번호" placeholder="010-0000-0000" hint="하이픈은 자동으로 입력돼요" />
        <View style={styles.gap} />
        <NInput label="주문번호" value="123" error="주문번호를 다시 확인해 주세요." />
        <View style={styles.gap} />
        <NInput label="비활성" placeholder="disabled" disabled />
      </Section>

      <Section title="NCheckbox / NSwitch">
        <NCheckbox checked={checked} onToggle={setChecked} label="위 내용을 확인했고 동의해요" />
        <View style={styles.gap} />
        <NCheckbox checked={false} onToggle={() => {}} label="비활성" disabled />
        <View style={styles.gap} />
        <NSwitch value={switched} onValueChange={setSwitched} />
      </Section>

      <Text style={styles.groupLabel}>Layout (0.3.0)</Text>

      <Section title="NCard" meta="elevated / outlined / filled">
        <NCard variant="elevated"><Text>elevated</Text></NCard>
        <View style={styles.gap} />
        <NCard variant="outlined"><Text>outlined</Text></NCard>
        <View style={styles.gap} />
        <NCard variant="filled"><Text>filled</Text></NCard>
      </Section>

      <Section title="NDivider / NHeader">
        <Text>위</Text>
        <NDivider />
        <Text>아래</Text>
        <View style={styles.gap} />
        <View style={styles.bordered}>
          <NHeader title="주문 확인" subtitle="step 1 / 4" />
        </View>
      </Section>

      <Text style={styles.groupLabel}>Feedback (0.3.0)</Text>

      <Section title="NAlert" meta="color 4종">
        <NAlert title="정보" description="info 알림입니다." color="info" />
        <View style={styles.gap} />
        <NAlert title="성공" description="발급이 완료됐어요." color="success" />
        <View style={styles.gap} />
        <NAlert title="주의" description="확인이 필요해요." color="warning" />
        <View style={styles.gap} />
        <NAlert title="오류" description="잠시 후 다시 시도해 주세요." color="error" />
      </Section>

      <Section title="NSkeleton">
        <NSkeleton width="60%" height={20} />
        <View style={styles.gap} />
        <NSkeleton width="100%" height={14} />
        <View style={styles.gap} />
        <NSkeleton width={48} height={48} circle />
      </Section>

      <Text style={styles.groupLabel}>Navigation (0.3.0)</Text>

      <Section title="NBottomSheet" meta="footer prop = 0.3.1 신규">
        <Row>
          <NButton size="sm" onPress={() => setSheetOpen(true)}>기본 시트</NButton>
          <NButton size="sm" variant="outline" onPress={() => setCalSheetOpen(true)}>footer 있는 시트</NButton>
        </Row>
      </Section>

      <Section title="NTabBar">
        <View style={styles.bordered}>
          <NTabBar
            items={[
              { key: 'home', label: '홈' },
              { key: 'orders', label: '주문' },
              { key: 'my', label: '내 정보' },
            ]}
            activeKey={tab}
            onSelect={setTab}
          />
        </View>
        <Text style={styles.hint}>선택: {tab}</Text>
      </Section>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          apps/mobile/src/app/showcase.tsx · theme primary/500 = {theme.colors.primary[500]}
        </Text>
      </View>

      {/* ───────────── Overlays ───────────── */}
      <NBottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title="시작 국가 선택">
        <View style={{ gap: 2 }}>
          {['일본 · Asia/Tokyo', '베트남 · Asia/Ho_Chi_Minh', '태국 · Asia/Bangkok'].map((c) => (
            <Text key={c} style={styles.sheetRow}>{c}</Text>
          ))}
        </View>
      </NBottomSheet>

      <NBottomSheet
        visible={calSheetOpen}
        onClose={() => setCalSheetOpen(false)}
        title="시작 날짜 선택"
        footer={
          <NButton variant="primary" size="xl" fullWidth onPress={() => setCalSheetOpen(false)}>
            선택 완료
          </NButton>
        }
      >
        <NDurationCalendar value={calDate} onChange={setCalDate} duration={8} />
      </NBottomSheet>

      <NAlertDialog
        visible={dialog === 'primary'}
        title="이 내용으로 발급할까요?"
        color="primary"
        closable={false}
        size="wide"
        actions={<NButton variant="primary" fullWidth onPress={() => setDialog(null)}>확인</NButton>}
      >
        {'발급 후에는 취소와 환불이 불가해요.'}
      </NAlertDialog>

      <NAlertDialog
        visible={dialog === 'warning'}
        title="주문번호와 일치하지 않아요"
        color="warning"
        closable={false}
        actions={<NButton variant="primary" fullWidth onPress={() => setDialog(null)}>다시 입력하기</NButton>}
      >
        {'주문 시 입력하신 이름과 전화번호를\n다시 한 번 확인해 주세요.'}
      </NAlertDialog>

      <NAlertDialog
        visible={dialog === 'error'}
        title="잠시 후 다시 시도해 주세요"
        color="error"
        closable={false}
        actions={<NButton variant="primary" fullWidth onPress={() => setDialog(null)}>확인</NButton>}
      >
        {'서버에 일시적인 문제가 발생했어요.'}
      </NAlertDialog>

      <NLoaderDialog visible={loaderOpen} title="주문을 확인하고 있어요" description="잠시만 기다려주세요…" />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f6f7f9',
  },
  content: {
    padding: 20,
    paddingBottom: 80,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    marginBottom: 8,
  },
  h1: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a',
  },
  h1sub: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748b',
  },
  groupLabel: {
    marginTop: 28,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.primary[600],
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  section: {
    marginBottom: 12,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fafbfc',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  sectionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#111827',
  },
  sectionMeta: {
    flexShrink: 1,
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
  },
  sectionBody: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  gap: {
    height: 10,
  },
  hint: {
    marginTop: 10,
    fontSize: 11.5,
    color: '#94a3b8',
  },
  bordered: {
    borderWidth: 1,
    borderColor: '#eef2f7',
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#374151',
  },
  previewStrong: {
    fontWeight: '700',
    color: '#4c1d95',
  },
  sheetRow: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  pressDemo: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[4],
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary[50],
  },
  pressDemoText: {
    color: theme.colors.primary[700],
    fontSize: theme.fontSize.sm,
  },
})
