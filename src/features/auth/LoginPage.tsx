import { loginSchema, type LoginInput } from '../../contracts/index.ts'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { FormField } from '../../components/FormField.tsx'
import { ApiError } from '../../lib/api.ts'
import { validate, type FieldErrors } from '../../lib/formErrors.ts'
import { useLogin, useMe } from './hooks.ts'

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Email 或密碼錯誤'
    if (error.status === 403) return '此帳號已停用，請聯絡管理者'
    if (error.status === 429) return '嘗試次數過多，請稍後再試'
  }
  return '登入失敗，請稍後再試'
}

/** 只允許站內路徑，避免 open redirect */
function safeRedirect(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') ? value : '/'
}

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { data: me } = useMe()
  const loginMutation = useLogin()
  const [values, setValues] = useState<LoginInput>({ email: '', password: '' })
  const [errors, setErrors] = useState<FieldErrors<LoginInput>>({})

  const redirectTo = safeRedirect(searchParams.get('redirect'))
  const expired = searchParams.get('expired') === '1'

  if (me && !loginMutation.isPending) return <Navigate to={redirectTo} replace />

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = validate(loginSchema, values)
    setErrors(result.errors ?? {})
    if (!result.data) return
    loginMutation.mutate(result.data, {
      onSuccess: () => navigate(redirectTo, { replace: true }),
      onError: () => setValues((v) => ({ ...v, password: '' })),
    })
  }

  return (
    <main className="auth-page">
      <form className="card auth-card" onSubmit={handleSubmit} noValidate>
        <h1>需求開發工廠</h1>
        <p className="muted">請使用管理者建立的帳號登入</p>

        {expired && !loginMutation.isError && (
          <p className="alert alert-info" role="status">
            登入狀態已逾時，請重新登入。
          </p>
        )}
        {loginMutation.isError && (
          <p className="alert alert-error" role="alert">
            {loginErrorMessage(loginMutation.error)}
          </p>
        )}

        <FormField label="Email" error={errors.email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="username"
              autoFocus
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="密碼" error={errors.password}>
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="current-password"
              value={values.password}
              onChange={(e) => setValues({ ...values, password: e.target.value })}
            />
          )}
        </FormField>

        <button type="submit" className="btn btn-primary btn-block" disabled={loginMutation.isPending}>
          {loginMutation.isPending ? '登入中…' : '登入'}
        </button>
        <p className="muted small">沒有帳號或忘記密碼？請聯絡管理者。</p>
      </form>
    </main>
  )
}
