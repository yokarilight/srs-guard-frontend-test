import { createUserSchema, type CreateUserInput } from '../../contracts/index.ts'
import { useState, type FormEvent } from 'react'
import { Dialog } from '../../components/Dialog.tsx'
import { FormField } from '../../components/FormField.tsx'
import { ApiError } from '../../lib/api.ts'
import { validate, type FieldErrors } from '../../lib/formErrors.ts'
import { useCreateUser } from './api.ts'

const emptyForm: CreateUserInput = { email: '', name: '', password: '', role: 'user' }

export function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [values, setValues] = useState<CreateUserInput>(emptyForm)
  const [errors, setErrors] = useState<FieldErrors<CreateUserInput>>({})
  const createUser = useCreateUser()

  function close() {
    setValues(emptyForm)
    setErrors({})
    createUser.reset()
    onClose()
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = validate(createUserSchema, values)
    setErrors(result.errors ?? {})
    if (!result.data) return
    createUser.mutate(result.data, {
      onSuccess: close,
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409) setErrors({ email: '此 Email 已被使用' })
      },
    })
  }

  return (
    <Dialog open={open} title="建立帳號" onClose={close}>
      <form onSubmit={handleSubmit} noValidate>
        <FormField label="Email" error={errors.email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="off"
              value={values.email}
              onChange={(e) => setValues({ ...values, email: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="名稱" error={errors.name}>
          {(props) => (
            <input {...props} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} />
          )}
        </FormField>
        <FormField label="初始密碼" error={errors.password} hint="至少 8 個字元，請另行告知使用者">
          {(props) => (
            <input
              {...props}
              type="text"
              autoComplete="new-password"
              value={values.password}
              onChange={(e) => setValues({ ...values, password: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="權限" error={errors.role}>
          {(props) => (
            <select
              {...props}
              value={values.role}
              onChange={(e) => setValues({ ...values, role: e.target.value as CreateUserInput['role'] })}
            >
              <option value="user">一般使用者</option>
              <option value="admin">管理者</option>
            </select>
          )}
        </FormField>
        {createUser.isError && !(createUser.error instanceof ApiError && createUser.error.status === 409) && (
          <p className="alert alert-error">{createUser.error.message}</p>
        )}
        <div className="actions">
          <button type="button" className="btn" onClick={close}>
            取消
          </button>
          <button type="submit" className="btn btn-primary" disabled={createUser.isPending}>
            {createUser.isPending ? '建立中…' : '建立'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
