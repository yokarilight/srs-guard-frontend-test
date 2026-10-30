import { z } from 'zod'

export type FieldErrors<T> = Partial<Record<keyof T, string>>

/** 以 zod schema 驗證表單，回傳資料或每個欄位的第一個錯誤訊息 */
export function validate<S extends z.ZodType>(
  schema: S,
  values: unknown,
): { data: z.output<S>; errors: null } | { data: null; errors: FieldErrors<z.input<S>> } {
  const result = schema.safeParse(values)
  if (result.success) return { data: result.data, errors: null }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? '_form')
    errors[key] ??= issue.message
  }
  return { data: null, errors: errors as FieldErrors<z.input<S>> }
}
