// Styles
import './styles/base.css'

// Components — re-export everything
export * from './components'

// Composables
export { useId } from './composables'
export { useFormField, useForm, provideFormField, provideForm } from './composables'
export type { FormFieldContext, FormContext } from './composables'
export { useTheme, provideTheme, THEME_KEY } from './composables'
export type { ThemeContext } from './composables'
export { useCopyToClipboard } from './composables'
export type { UseCopyToClipboardOptions } from './composables'
export { usePhoneFormat } from './composables'
export { useConfirm } from './composables'
export type { ConfirmOptions } from './composables'
export { useReducedMotion } from './composables'

// Types
export type { NSize, NColor, NVariant, NOrientation } from './types/common'
