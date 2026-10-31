import {
  createRoleSchema,
  ROLE_DESCRIPTION_MAX_LENGTH,
  ROLE_SECTIONS_MAX_COUNT,
  updateRoleSchema,
  type Role,
} from '../../contracts/index.ts'
import { useState, type FormEvent } from 'react'
import { Dialog } from '../../components/Dialog.tsx'
import { FormField } from '../../components/FormField.tsx'
import { ApiError } from '../../lib/api.ts'
import { validate, type FieldErrors } from '../../lib/formErrors.ts'
import { useCreateRole, useUpdateRole } from './api.ts'

interface RoleFormDialogProps {
  open: boolean
  /** 有值時為編輯，否則為新增自訂角色（F5-2） */
  role?: Role
  onClose: () => void
}

export function RoleFormDialog({ open, role, onClose }: RoleFormDialogProps) {
  return (
    <Dialog open={open} title={role ? '編輯角色' : '新增自訂角色'} onClose={onClose}>
      {/* Dialog 關閉時不渲染內容，每次開啟都會以最新資料重設表單 */}
      <RoleForm role={role} onClose={onClose} />
    </Dialog>
  )
}

interface FormValues {
  name: string
  description: string
  /** 每行一個章節 */
  sections: string
}

/** 每行一個章節，忽略空白行 */
function parseSections(text: string) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function RoleForm({ role, onClose }: Omit<RoleFormDialogProps, 'open'>) {
  const createRole = useCreateRole()
  const updateRole = useUpdateRole(role?.id ?? '')
  const mutation = role ? updateRole : createRole
  const [values, setValues] = useState<FormValues>({
    name: role?.name ?? '',
    description: role?.description ?? '',
    sections: role?.sections.join('\n') ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors<FormValues>>({})

  function update(field: keyof FormValues, value: string) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  function handleError(error: Error) {
    if (error instanceof ApiError && error.status === 409) setErrors({ name: error.message })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const input = { ...values, sections: parseSections(values.sections) }
    const options = { onSuccess: onClose, onError: handleError }
    if (role) {
      const result = validate(updateRoleSchema, input)
      setErrors(result.errors ?? {})
      if (result.data) updateRole.mutate(result.data, options)
    } else {
      const result = validate(createRoleSchema, input)
      setErrors(result.errors ?? {})
      if (result.data) createRole.mutate(result.data, options)
    }
  }

  const sectionCount = parseSections(values.sections).length
  const nameConflict = mutation.error instanceof ApiError && mutation.error.status === 409

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="名稱" error={errors.name} hint="例如設計師、PM、DevOps">
        {(props) => (
          <input {...props} autoFocus value={values.name} onChange={(e) => update('name', e.target.value)} />
        )}
      </FormField>
      <FormField
        label="職責描述"
        error={errors.description}
        hint={`AI 依此描述產生這個角色的文件（${values.description.length} / ${ROLE_DESCRIPTION_MAX_LENGTH}）`}
      >
        {(props) => (
          <textarea
            {...props}
            rows={4}
            value={values.description}
            onChange={(e) => update('description', e.target.value)}
          />
        )}
      </FormField>
      <FormField
        label="希望文件包含的章節（選填）"
        error={errors.sections}
        hint={`每行一個章節（${sectionCount} / ${ROLE_SECTIONS_MAX_COUNT}）`}
      >
        {(props) => (
          <textarea
            {...props}
            rows={5}
            placeholder={'缺少的畫面\n各畫面狀態\n互動與動態說明'}
            value={values.sections}
            onChange={(e) => update('sections', e.target.value)}
          />
        )}
      </FormField>
      {mutation.isError && !nameConflict && <p className="alert alert-error">{mutation.error.message}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>
          取消
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {role ? (mutation.isPending ? '儲存中…' : '儲存') : mutation.isPending ? '新增中…' : '新增'}
        </button>
      </div>
    </form>
  )
}
