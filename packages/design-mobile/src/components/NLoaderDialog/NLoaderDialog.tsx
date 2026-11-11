import React from 'react'
import { View, Text, Modal, ActivityIndicator, StyleSheet, useWindowDimensions } from 'react-native'
import { theme } from '../../theme'

export interface NLoaderDialogProps {
  visible: boolean
  title?: string
  description?: string
}

/** 백드롭 + 흰 카드 + 브랜드 스피너. 닫기 인터랙션 없음 (진행 중 표시 전용). */
export function NLoaderDialog({ visible, title, description }: NLoaderDialogProps) {
  const { width: screenWidth } = useWindowDimensions()
  const width = Math.min(theme.dialog.width.default, screenWidth * theme.dialog.viewportRatio)
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { width }]}>
          <ActivityIndicator size="large" color={theme.colors.primary[500]} />
          {title && <Text style={styles.title}>{title}</Text>}
          {description && <Text style={styles.description}>{description}</Text>}
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
    paddingVertical: theme.spacing[8],
    paddingHorizontal: theme.spacing[6],
    alignItems: 'center',
    ...(theme.shadow.lg as object),
  },
  title: {
    marginTop: 14,
    fontSize: theme.fontSize.base,
    fontWeight: '700',
    color: theme.colors.neutral[900],
    textAlign: 'center',
  },
  description: {
    marginTop: 6,
    fontSize: theme.fontSize.sm,
    color: theme.colors.neutral[500],
    textAlign: 'center',
  },
})
