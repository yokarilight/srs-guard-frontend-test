import type { AuthResponse, CreateUserInput, UpdateUserInput, UsersResponse } from '../../contracts/index.ts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api.ts'

export const usersQueryKey = ['users'] as const

export function useUsers() {
  return useQuery({
    queryKey: usersQueryKey,
    queryFn: async () => (await api<UsersResponse>('/users')).users,
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateUserInput) =>
      (await api<AuthResponse>('/users', { method: 'POST', body: input })).user,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, input }: { userId: string; input: UpdateUserInput }) =>
      (await api<AuthResponse>(`/users/${userId}`, { method: 'PATCH', body: input })).user,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: usersQueryKey }),
  })
}
