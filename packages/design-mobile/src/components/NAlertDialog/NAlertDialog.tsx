import React from 'react'
import { View, Text, Modal, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native'
import { theme } from '../../theme'

export interface NAlertDialogProps {
  visible: boolean
  title: string
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info'
  /** true 면 백드롭 탭/뒤로가기로 onClose 호출 */
  closable?: boolean
  onClose?: () => void
  /** 본문 — string 이면 기본 스타일 Text 로 감쌈 */
  children?: React.ReactNode
  /** 하단 버튼 영역 */
  actions?: React.ReactNode
  /** 폭 — 토큰 `dialog.width` 변형(design-vue 와 같다). default 280 · wide 340(요약 · 필수 동의 체크처럼 내용이 많은 확인만) */
  size?: 'default' | 'wide'
}

const glyphMap = { primary: 'i', success: '✓', warning: '!', error: '!', info: 'i' } as const
const colorMap = {
  primary: { bg: theme.colors.primary[50], fg: theme.colors.primary[600] },
  success: { bg: theme.colors.success[50], fg: theme.colors.success[500] },
  warning: { bg: theme.colors.warning[50], fg: theme.colors.warning[500] },
  error: { bg: theme.colors.error[50], fg: theme.colors.error[500] },
  info: { bg: theme.colors.info[50], fg: theme.colors.info[500] },
}

/** 중앙 모달 다이얼로그 — design-vue NAlertDialog 대응. */
export function NAlertDialog({
  visible,
  title,
  color = 'primary',
  closable = true,
  onClose,
  children,
  actions,
  size = 'default',
}: NAlertDialogProps) {
  const c = colorMap[color]
  const { width: screenWidth } = useWindowDimensions()
  const width = Math.min(theme.dialog.width[size], screenWidth * theme.dialog.viewportRatio)
  const handleBackdrop = () => {
    if (closable) onClose?.()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleBackdrop}>
      <View style={styles.overlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleBackdrop} />
        <View style={[styles.card, { width }]}>
          <View style={[styles.iconCircle, { backgroundColor: c.bg }]}>
            <Text style={[styles.iconGlyph, { color: c.fg }]}>{glyphMap[color]}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          {typeof children === 'string' ? (
            <Text style={styles.body}>{children}</Text>
          ) : (
            children && <View style={styles.bodyWrap}>{children}</View>
          )}
          {actions && <View style={styles.actions}>{actions}</View>}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing[6],
  },
  card: {
    maxWidth: '100%',
    backgroundColor: theme.colors.white,
    borderRadius: theme.radius['3xl'],
    paddingVertical: theme.spacing[6],
    paddingHorizontal: theme.spacing[5],
    alignItems: 'center',
    ...(theme.shadow.lg as object),
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  iconGlyph: {
    fontSize: 20,
    fontWeight: '800',
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: '700',
    color: theme.colors.neutral[900],
    textAlign: 'center',
    marginBottom: 8,
  },
  body: {
    fontSize: theme.fontSize.sm,
    lineHeight: Math.round(theme.fontSize.sm * 1.55),
    color: theme.colors.neutral[500],
    textAlign: 'center',
  },
  bodyWrap: {
    width: '100%',
    alignItems: 'center',
  },
  actions: {
    width: '100%',
    marginTop: theme.spacing[5],
  },
})
