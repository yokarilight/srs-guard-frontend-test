export const builtInRoleKeys = ['frontend', 'backend', 'qa', 'manager'] as const
export type BuiltInRoleKey = (typeof builtInRoleKeys)[number]

export interface Role {
  id: string
  key: string
  name: string
  description: string
  /** 希望文件包含的章節 */
  sections: string[]
  isBuiltIn: boolean
}

export interface RolesResponse {
  roles: Role[]
}
