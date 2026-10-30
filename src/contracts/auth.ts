import { z } from 'zod'

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 72 // bcrypt 只取前 72 bytes

/** 系統權限：管理者可管理帳號，其餘皆為一般使用者 */
export const userRoles = ['admin', 'user'] as const
export type UserRole = (typeof userRoles)[number]

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  /** 「我的角色」，開啟角色文件時預設顯示 */
  preferredRoleId: string | null
  disabled: boolean
  createdAt: string
}

const email = z.string().trim().toLowerCase().pipe(z.email('Email 格式不正確'))

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `密碼至少 ${PASSWORD_MIN_LENGTH} 個字元`)
  .max(PASSWORD_MAX_LENGTH, `密碼最多 ${PASSWORD_MAX_LENGTH} 個字元`)

const name = z.string().trim().min(1, '請輸入名稱').max(50, '名稱最多 50 個字元')

/** POST /api/auth/login */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, '請輸入密碼'),
})
export type LoginInput = z.infer<typeof loginSchema>

/** PATCH /api/auth/password */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '請輸入目前密碼'),
    newPassword: password,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ['newPassword'],
    message: '新密碼不可與目前密碼相同',
  })
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

/** PATCH /api/me */
export const updateMeSchema = z.object({
  preferredRoleId: z.string().min(1).nullable(),
})
export type UpdateMeInput = z.infer<typeof updateMeSchema>

/** POST /api/users（僅管理者） */
export const createUserSchema = z.object({
  email,
  name,
  password,
  role: z.enum(userRoles),
})
export type CreateUserInput = z.infer<typeof createUserSchema>

/** PATCH /api/users/:userId（僅管理者）：停用／啟用、重設密碼、修改資料 */
export const updateUserSchema = z
  .object({
    name: name.optional(),
    role: z.enum(userRoles).optional(),
    disabled: z.boolean().optional(),
    password: password.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: '至少需要一個欄位',
  })
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export interface AuthResponse {
  user: User
}

export interface UsersResponse {
  users: User[]
}
