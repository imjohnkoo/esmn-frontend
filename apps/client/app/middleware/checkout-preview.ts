import {
  CHECKOUT_ITEM_ROUTE,
  CHECKOUT_ITEM_STATE,
  checkoutEntryRedirect,
  type PreviewItem,
  type PreviewLookup,
} from '#shared/catalog/preview'

// 결제 페이지 진입 판정(client-shell spec D-60) — 상품 값을 서버 카탈로그에서 받고, 키가 test_ 가 아니면 결제를 시작하지 않는다.
// 이 페이지는 프리렌더가 아니라 SSR 의 runtimeConfig 가 실제 키다. 하이드레이션 때는 서버가 끝낸 판정을 다시 하지 않는다.
export default defineNuxtRouteMiddleware(async (to) => {
  const nuxtApp = useNuxtApp()
  if (import.meta.client && nuxtApp.isHydrating && nuxtApp.payload.serverRendered) return
  const clientKey = useRuntimeConfig().public.toss.clientKey
  const item = useState<PreviewItem>(CHECKOUT_ITEM_STATE)
  const hasOption = to.query.option !== undefined
  const lookup = await $fetch<PreviewLookup>(CHECKOUT_ITEM_ROUTE, {
    query: hasOption ? { option: to.query.option } : {},
  }).catch((error: { statusCode?: number }) => {
    if (error.statusCode === 404) return null
    throw error
  })
  const target = checkoutEntryRedirect(lookup, clientKey, hasOption)
  if (target) return navigateTo(target, { replace: true })
  item.value = lookup!.item
})
