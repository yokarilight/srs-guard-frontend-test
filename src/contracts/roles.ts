import { z } from 'zod'

export const builtInRoleKeys = ['frontend', 'backend', 'qa', 'manager'] as const
export type BuiltInRoleKey = (typeof builtInRoleKeys)[number]

export const ROLE_NAME_MAX_LENGTH = 30
export const ROLE_DESCRIPTION_MAX_LENGTH = 1000
export const ROLE_SECTION_MAX_LENGTH = 50
export const ROLE_SECTIONS_MAX_COUNT = 20

export interface Role {
  id: string
  /** 預設角色為 builtInRoleKeys 之一；自訂角色由後端產生 */
  key: string
  name: string
  /** 職責描述，自訂角色的文件依此產生（F6-3） */
  description: string
  /** 希望文件包含的章節 */
  sections: string[]
  isBuiltIn: boolean
}

const name = z
  .string()
  .trim()
  .min(1, '請輸入角色名稱')
  .max(ROLE_NAME_MAX_LENGTH, `角色名稱最多 ${ROLE_NAME_MAX_LENGTH} 個字元`)

const description = z
  .string()
  .trim()
  .min(1, '請輸入職責描述')
  .max(ROLE_DESCRIPTION_MAX_LENGTH, `職責描述最多 ${ROLE_DESCRIPTION_MAX_LENGTH} 個字元`)

const sections = z
  .array(
    z
      .string()
      .trim()
      .min(1, '章節名稱不可空白')
      .max(ROLE_SECTION_MAX_LENGTH, `每個章節名稱最多 ${ROLE_SECTION_MAX_LENGTH} 個字元`),
  )
  .max(ROLE_SECTIONS_MAX_COUNT, `章節最多 ${ROLE_SECTIONS_MAX_COUNT} 個`)
  .refine((list) => new Set(list).size === list.length, { message: '章節名稱不可重複' })

/** POST /api/roles（僅管理者）：新增自訂角色 */
export const createRoleSchema = z.object({
  name,
  description,
  sections: sections.default([]),
})
export type CreateRoleInput = z.input<typeof createRoleSchema>

/** PATCH /api/roles/:roleId（僅管理者，預設角色不可修改） */
export const updateRoleSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
    sections: sections.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: '至少需要一個欄位',
  })
export type UpdateRoleInput = z.input<typeof updateRoleSchema>

export interface RolesResponse {
  /** 預設角色在前，自訂角色依建立時間排序 */
  roles: Role[]
}

export interface RoleResponse {
  role: Role
}
