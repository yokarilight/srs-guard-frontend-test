import type {
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  UpdateMeInput,
  User,
} from '../../contracts/index.ts'
import { api, ApiError } from '../../lib/api.ts'

export async function fetchMe(): Promise<User | null> {
  try {
    const { user } = await api<AuthResponse>('/auth/me', { skipUnauthorizedHandler: true })
    return user
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export async function login(input: LoginInput): Promise<User> {
  const { user } = await api<AuthResponse>('/auth/login', {
    method: 'POST',
    body: input,
    skipUnauthorizedHandler: true,
  })
  return user
}

export function logout(): Promise<void> {
  return api<void>('/auth/logout', { method: 'POST', skipUnauthorizedHandler: true })
}

export function changePassword(input: ChangePasswordInput): Promise<void> {
  return api<void>('/auth/password', { method: 'PATCH', body: input })
}

export async function updateMe(input: UpdateMeInput): Promise<User> {
  const { user } = await api<AuthResponse>('/me', { method: 'PATCH', body: input })
  return user
}
