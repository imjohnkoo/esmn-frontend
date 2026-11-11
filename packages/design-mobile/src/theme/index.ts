import colors from '@imjohnkoo/design-tokens/src/colors.json'
import typography from '@imjohnkoo/design-tokens/src/typography.json'
import spacing from '@imjohnkoo/design-tokens/src/spacing.json'
import shadows from '@imjohnkoo/design-tokens/src/shadows.json'
import base from '@imjohnkoo/design-tokens/src/base.json'
import components from '@imjohnkoo/design-tokens/src/components.json'
import motion from '@imjohnkoo/design-tokens/src/motion.json'

function remToNumber(rem: string): number {
  const match = rem.match(/^([\d.]+)rem$/)
  return match ? parseFloat(match[1]) * 16 : parseFloat(rem)
}

function pxToNumber(px: string): number {
  const match = px.match(/^([\d.]+)px$/)
  return match ? parseFloat(match[1]) : parseFloat(px)
}

interface ShadowLayer {
  x: string
  y: string
  blur: string
  spread: string
  color: string
}

const typedSpacing = spacing as Record<string, string>
// Shadows are layer arrays (CSS composes them; RN supports a single shadow, so
// we take the first layer). `none` is an empty array.
const typedShadows = shadows as Record<string, ShadowLayer[]>
const typedRadius = base.radius as Record<string, string>

const ELEVATION: Record<string, number> = { xs: 1, sm: 2, md: 4, lg: 8, xl: 12 }

export const theme = {
  colors: {
    primary: colors.primary,
    neutral: colors.neutral,
    success: colors.success,
    warning: colors.warning,
    error: colors.error,
    info: colors.info,
    white: '#ffffff',
    black: '#000000',
    transparent: 'transparent',
  },

  fontSize: Object.fromEntries(
    Object.entries(typography.size).map(([key, val]) => [key, remToNumber(val)]),
  ) as Record<string, number>,

  lineHeight: Object.fromEntries(
    Object.entries(typography['line-height']).map(([key, val]) => [key, parseFloat(val)]),
  ) as Record<string, number>,

  fontWeight: typography.weight as Record<string, string>,

  fontFamily: typography.family,

  spacing: Object.fromEntries(
    Object.entries(typedSpacing).map(([key, val]) => [key, remToNumber(val)]),
  ) as Record<string, number>,

  radius: Object.fromEntries(
    Object.entries(typedRadius).map(([key, val]) => {
      if (val === '9999px') return [key, 9999]
      return [key, remToNumber(val)]
    }),
  ) as Record<string, number>,

  shadow: Object.fromEntries(
    Object.entries(typedShadows).map(([key, layers]) => {
      const layer = layers[0]
      if (!layer) {
        return [key, { shadowOpacity: 0, elevation: 0 }]
      }
      return [
        key,
        {
          shadowOffset: { width: pxToNumber(layer.x), height: pxToNumber(layer.y) },
          shadowRadius: pxToNumber(layer.blur),
          shadowColor: layer.color,
          shadowOpacity: 1,
          elevation: ELEVATION[key] ?? 12,
        },
      ]
    }),
  ),

  /** 대화상자 폭 — design-vue 와 같은 토큰(`dialog.width` · `dialog.viewport-ratio`). 화면 폭 × 비율이 상한 */
  dialog: {
    width: {
      default: remToNumber(components.dialog.width.default),
      wide: remToNumber(components.dialog.width.wide),
    },
    viewportRatio: parseFloat(components.dialog['viewport-ratio']) / 100,
  },

  /**
   * 모션 — design-vue `--n-motion-*` 와 같은 토큰(`motion.json`), 숫자 그대로.
   * `withTiming(v, { duration: theme.motion.duration.fast, easing: Easing.bezier(...theme.motion.easing.out) })`
   * · `withSpring(v, theme.motion.spring.sheet)`
   */
  motion: motion as {
    duration: Record<keyof typeof motion.duration, number>
    easing: Record<keyof typeof motion.easing, [number, number, number, number]>
    spring: Record<keyof typeof motion.spring, { duration: number; dampingRatio: number }>
    stagger: Record<keyof typeof motion.stagger, number>
  },
} as const

export type Theme = typeof theme
