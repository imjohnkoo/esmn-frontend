/**
 * Nuxt auto-import 대상 컴포넌트 목록.
 *
 * `nuxt.ts` 와 분리한 이유: Nuxt 모듈 엔트리는 default export 하나만 갖는 게 규약이다.
 * 같은 파일에서 named export 를 함께 내보내면 번들러가 CJS 소비자에게
 * `chunk.default` 접근을 강요하는 형태로 내보내며 경고한다.
 *
 * ⚠️ 이 목록은 손으로 관리한다. 실제 export 와 어긋나면
 * `__tests__/nuxt-registration.spec.ts` 가 실패한다 — 목록을 지어내지 말고
 * 테스트가 알려주는 대로 맞출 것.
 */
export const NUXT_COMPONENTS = [
  // Layout
  'NApp',
  'NContainer',
  'NFooter',
  'NHeader',
  'NMain',
  'NThemeNew',
  'NDashboardLayout',
  'NMobileLayout',

  // Elements
  'NAlert',
  'NBadge',
  'NBanner',
  'NButton',
  'NCard',
  'NChip',
  'NIcon',
  'NKbd',
  'NLogo',
  'NAvatar',
  'NAvatarGroup',
  'NCollapsible',
  'NProgress',
  'NSeparator',
  'NSpinner',
  'NLottie',

  // Form
  'NFieldGroup',
  'NForm',
  'NFormField',
  'NInput',
  'NTextarea',
  'NCheckbox',
  'NCheckboxGroup',
  'NInputNumber',
  'NInputTags',
  'NPinInput',
  'NRadioGroup',
  'NSelect',
  'NSelectMenu',
  'NInputMenu',
  'NSlider',
  'NSwitch',
  'NInputTime',
  'NInputDate',
  'NCalendar',
  'NDurationCalendar',
  'NColorPicker',
  'NFileUpload',

  // Data
  'NAccordion',
  'NScrollArea',
  'NTree',
  'NTable',
  'NTimeline',
  'NUser',
  'NMarquee',
  'NCarousel',
  'NEmpty',
  'NError',
  'NStat',
  'NSkeleton',
  'NTableSkeleton',
  'NDetailSkeleton',

  // Overlay
  'NTooltip',
  'NPopover',
  'NModal',
  'NDrawer',
  'NSlideover',
  'NDropdownMenu',
  'NContextMenu',
  'NBottomSheet',
  'NToast',
  'NToastProvider',
  'NAlertDialog',
  'NConfirmDialog',
  'NLoaderDialog',
  'NGlobalLoader',

  // Navigation
  'NLink',
  'NBreadcrumb',
  'NTabs',
  'NPagination',
  'NStepper',
  'NStepProgress',
  'NNavigationMenu',
  'NCommandPalette',
  'NFooterColumns',
  'NPageHeader',
  'NPageHeading',
  'NSidebar',
  'NSidebarItem',
  'NSidebarSeparator',

  // Admin 패턴
  'NAsyncSection',
  'NDataTable',
  'NSearchFilter',
  'NDateRangeFilter',
  'NFormModal',
  'NSegmentedControl',
  'NFilterPill',
  'NEditableField',
  'NDetailHeader',
  'NDescriptionList',
  'NKpi',
  'NKpiStrip',

  // eSIM client
  'NCopyButton',
  'NQRCode',
  'NCodeRow',
  'NInfoChip',
  'NStatusPill',
  'NTrustNote',
  'NFieldCard',
  'NHighlightCard',
  'NLinkCard',
] as const
