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
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** 一般物件以 JSON 送出；FormData 以 multipart 送出（由瀏覽器設定 boundary） */
  body?: unknown
  /** 401 不視為 Session 逾時（登入、取得目前使用者） */
  skipUnauthorizedHandler?: boolean
}

async function request(path: string, options: RequestOptions): Promise<Response> {
  const { method = 'GET', body, skipUnauthorizedHandler = false } = options
  const isForm = body instanceof FormData
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'same-origin',
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })

  if (!res.ok) {
    const errorBody = (await res.json().catch(() => null)) as ApiErrorBody | null
    if (res.status === 401 && !skipUnauthorizedHandler) onUnauthorized?.()
    throw new ApiError(res.status, errorBody)
  }
  return res
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await request(path, options)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** 取得二進位內容（PDF、截圖） */
export async function apiBlob(path: string): Promise<Blob> {
  return (await request(path, {})).blob()
}
