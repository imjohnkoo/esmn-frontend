import { ref, type Ref } from 'vue'

// 회원 화면 대화상자 상태 — 화면마다 MemberDialog 하나를 늘 붙여 두고 열고 닫기만 한다(QA ⑦ 2회차).
// 대화상자를 v-if 로 통째로 떼어 내면 닫히는 중인 Teleport 오버레이가 body 에 고아로 남아 화면 입력을 막는다.
// key 는 닫힐 때도 그대로 둔다 — 닫히는 동안 글자가 사라지지 않게
export function useMemberDialog<K extends string>(initial: K) {
  const key = ref(initial) as Ref<K>
  const open = ref(false)
  function show(k: K) {
    key.value = k
    open.value = true
  }
  return { key, open, show }
}
