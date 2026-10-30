import type { User } from '../../contracts/index.ts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchMe, login, logout, updateMe } from './api.ts'
import { clearSessionData, meQueryKey, resetSessionExpired } from './session.ts'

export function useMe() {
  return useQuery({
    queryKey: meQueryKey,
    queryFn: fetchMe,
    staleTime: 60_000,
    // 回到分頁時重新確認 Session 是否仍有效
    refetchOnWindowFocus: true,
  })
}

/** 只能在 RequireAuth 底下使用 */
export function useCurrentUser(): User {
  const { data } = useMe()
  if (!data) throw new Error('useCurrentUser 必須在 RequireAuth 內使用')
  return data
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      resetSessionExpired()
      queryClient.setQueryData(meQueryKey, user)
    },
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: logout,
    // 不論後端是否成功都清掉前端狀態
    onSettled: () => clearSessionData(queryClient),
  })
}

export function useUpdateMe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: updateMe,
    onSuccess: (user) => queryClient.setQueryData(meQueryKey, user),
  })
}
