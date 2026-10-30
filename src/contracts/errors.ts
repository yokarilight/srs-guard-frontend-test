/** 與 NestJS 預設例外格式相容 */
export interface ApiErrorBody {
  statusCode: number
  message: string | string[]
  error?: string
}
