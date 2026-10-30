import { changePasswordSchema, type ChangePasswordInput } from '../../contracts/index.ts'
import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { FormField } from '../../components/FormField.tsx'
import { ApiError } from '../../lib/api.ts'
import { validate, type FieldErrors } from '../../lib/formErrors.ts'
import { changePassword } from '../auth/api.ts'
import { useCurrentUser, useUpdateMe } from '../auth/hooks.ts'
import { useRoles } from '../roles/api.ts'

export function SettingsPage() {
  const user = useCurrentUser()
  return (
    <section className="page">
      <h1>個人設定</h1>
      <dl className="profile">
        <dt>名稱</dt>
        <dd>{user.name}</dd>
        <dt>Email</dt>
        <dd>{user.email}</dd>
        <dt>權限</dt>
        <dd>{user.role === 'admin' ? '管理者' : '一般使用者'}</dd>
      </dl>
      <PreferredRoleForm />
      <ChangePasswordForm />
    </section>
  )
}

/** F8-6：我的角色 */
function PreferredRoleForm() {
  const user = useCurrentUser()
  const roles = useRoles()
  const updateMe = useUpdateMe()
  const [selected, setSelected] = useState(user.preferredRoleId ?? '')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    updateMe.mutate({ preferredRoleId: selected || null })
  }

  const unchanged = selected === (user.preferredRoleId ?? '')

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>我的角色</h2>
      <p className="muted">開啟角色文件時，預設顯示這個角色的文件。</p>
      {roles.isError ? (
        <p className="alert alert-error">無法載入角色清單。</p>
      ) : (
        <FormField label="角色">
          {(props) => (
            <select
              {...props}
              value={selected}
              disabled={roles.isPending}
              onChange={(e) => {
                setSelected(e.target.value)
                updateMe.reset()
              }}
            >
              <option value="">未設定</option>
              {roles.data?.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                  {role.isBuiltIn ? '' : '（自訂）'}
                </option>
              ))}
            </select>
          )}
        </FormField>
      )}
      {updateMe.isSuccess && <p className="alert alert-success">已儲存。</p>}
      {updateMe.isError && <p className="alert alert-error">{updateMe.error.message}</p>}
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={unchanged || updateMe.isPending}>
          {updateMe.isPending ? '儲存中…' : '儲存'}
        </button>
      </div>
    </form>
  )
}

type PasswordForm = ChangePasswordInput & { confirmPassword: string }
const emptyPasswordForm: PasswordForm = { currentPassword: '', newPassword: '', confirmPassword: '' }

/** F8-7：修改密碼 */
function ChangePasswordForm() {
  const [values, setValues] = useState<PasswordForm>(emptyPasswordForm)
  const [errors, setErrors] = useState<FieldErrors<PasswordForm>>({})
  const mutation = useMutation({ mutationFn: changePassword })

  function update(field: keyof PasswordForm, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
    mutation.reset()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = validate(changePasswordSchema, values)
    const nextErrors: FieldErrors<PasswordForm> = { ...result.errors }
    if (values.confirmPassword !== values.newPassword) nextErrors.confirmPassword = '兩次輸入的新密碼不一致'
    setErrors(nextErrors)
    if (!result.data || nextErrors.confirmPassword) return

    mutation.mutate(result.data, {
      onSuccess: () => setValues(emptyPasswordForm),
      onError: (error) => {
        if (error instanceof ApiError && error.status === 400) {
          setErrors({ currentPassword: '目前密碼不正確' })
        }
      },
    })
  }

  return (
    <form className="card" onSubmit={handleSubmit} noValidate>
      <h2>修改密碼</h2>
      <FormField label="目前密碼" error={errors.currentPassword}>
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="current-password"
            value={values.currentPassword}
            onChange={(e) => update('currentPassword', e.target.value)}
          />
        )}
      </FormField>
      <FormField label="新密碼" error={errors.newPassword} hint="至少 8 個字元">
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="new-password"
            value={values.newPassword}
            onChange={(e) => update('newPassword', e.target.value)}
          />
        )}
      </FormField>
      <FormField label="確認新密碼" error={errors.confirmPassword}>
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="new-password"
            value={values.confirmPassword}
            onChange={(e) => update('confirmPassword', e.target.value)}
          />
        )}
      </FormField>
      {mutation.isSuccess && <p className="alert alert-success">密碼已更新。</p>}
      {mutation.isError && !(mutation.error instanceof ApiError && mutation.error.status === 400) && (
        <p className="alert alert-error">{mutation.error.message}</p>
      )}
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? '更新中…' : '更新密碼'}
        </button>
      </div>
    </form>
  )
}
