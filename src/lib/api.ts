import type { ApiErrorBody } from '../contracts/index.ts'

export class ApiError extends Error {
  readonly status: number
  readonly body: ApiErrorBody | null

  constructor(status: number, body: ApiErrorBody | null) {
    const message = Array.isArray(body?.message)
      ? body.message.join('、')
      : (body?.message ?? `請求失敗（${status}）`)
    super(message)
    this.status = status
    this.body = body
  }
}

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler | null = null

/** 登入後的 API 收到 401 時呼叫（Session 逾時或被停用） */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  /** 401 不視為 Session 逾時（登入、取得目前使用者） */
  skipUnauthorizedHandler?: boolean
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipUnauthorizedHandler = false } = options
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as ApiErrorBody | null
    if (res.status === 401 && !skipUnauthorizedHandler) onUnauthorized?.()
    throw new ApiError(res.status, errorBody)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}
