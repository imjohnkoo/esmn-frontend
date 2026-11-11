import {
  getCurrentInstance,
  getCurrentScope,
  onMounted,
  onScopeDispose,
  readonly,
  ref,
  type Ref,
} from 'vue'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * OS «동작 줄이기» 설정을 반응형으로 읽는다(matchMedia + change 구독).
 * 서버 · matchMedia 없는 환경은 false. 컴포넌트 안에서는 마운트 뒤에 읽어 SSR 하이드레이션과 어긋나지 않는다.
 */
export function useReducedMotion(): Readonly<Ref<boolean>> {
  const reduced = ref(false)
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function')
    return readonly(reduced)

  const mql = window.matchMedia(QUERY)
  const onChange = (e: MediaQueryListEvent) => {
    reduced.value = e.matches
  }
  const start = () => {
    reduced.value = mql.matches
    mql.addEventListener('change', onChange)
  }
  if (getCurrentInstance()) onMounted(start)
  else start()
  if (getCurrentScope()) onScopeDispose(() => mql.removeEventListener('change', onChange))
  return readonly(reduced)
}
