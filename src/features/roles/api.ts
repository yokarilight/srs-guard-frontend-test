import type { RolesResponse } from '../../contracts/index.ts'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api.ts'

export const rolesQueryKey = ['roles'] as const

export function useRoles() {
  return useQuery({
    queryKey: rolesQueryKey,
    queryFn: async () => (await api<RolesResponse>('/roles')).roles,
  })
}
