import type { QueryClient } from '@tanstack/react-query'

export const meQueryKey = ['auth', 'me'] as const

let expired = false

/** 上一次登出是否因為 Session 逾時（401），用來在登入頁顯示提示 */
export function isSessionExpired() {
  return expired
}

export function handleSessionExpired(queryClient: QueryClient) {
  expired = true
  clearSessionData(queryClient)
}

export function clearSessionData(queryClient: QueryClient) {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== meQueryKey[0] })
  queryClient.setQueryData(meQueryKey, null)
}

export function resetSessionExpired() {
  expired = false
}
