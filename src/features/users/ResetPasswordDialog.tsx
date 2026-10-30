import { PASSWORD_MIN_LENGTH, updateUserSchema, type User } from '../../contracts/index.ts'
import { useState, type FormEvent } from 'react'
import { Dialog } from '../../components/Dialog.tsx'
import { FormField } from '../../components/FormField.tsx'
import { validate } from '../../lib/formErrors.ts'
import { useUpdateUser } from './api.ts'

export function ResetPasswordDialog({ user, onClose }: { user: User | null; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const updateUser = useUpdateUser()

  function close() {
    setPassword('')
    setError(undefined)
    updateUser.reset()
    onClose()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user) return
    const result = validate(updateUserSchema, { password })
    setError(result.errors?.password)
    if (!result.data) return
    updateUser.mutate({ userId: user.id, input: result.data }, { onSuccess: close })
  }

  return (
    <Dialog open={user !== null} title="重設密碼" onClose={close}>
      <form onSubmit={handleSubmit} noValidate>
        <p className="muted">
          為「{user?.name}」（{user?.email}）設定新密碼，完成後請另行告知使用者。
        </p>
        <FormField label="新密碼" error={error} hint={`至少 ${PASSWORD_MIN_LENGTH} 個字元`}>
          {(props) => (
            <input
              {...props}
              type="text"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </FormField>
        {updateUser.isError && <p className="alert alert-error">{updateUser.error.message}</p>}
        <div className="actions">
          <button type="button" className="btn" onClick={close}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={updateUser.isPending}>
            {updateUser.isPending ? '更新中…' : '重設密碼'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
