import type { CreateRoleInput, RoleResponse, RolesResponse, UpdateRoleInput } from '../../contracts/index.ts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api.ts'

export const rolesQueryKey = ['roles'] as const

export function useRoles() {
  return useQuery({
    queryKey: rolesQueryKey,
    queryFn: async () => (await api<RolesResponse>('/roles')).roles,
  })
}

export function useCreateRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateRoleInput) =>
      (await api<RoleResponse>('/roles', { method: 'POST', body: input })).role,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
  })
}

export function useUpdateRole(roleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateRoleInput) =>
      (await api<RoleResponse>(`/roles/${roleId}`, { method: 'PATCH', body: input })).role,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
  })
}

export function useDeleteRole(roleId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/roles/${roleId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
  })
}
