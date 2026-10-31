import { generateDocumentsSchema, type RevisionSummary, type Role } from '../../contracts/index.ts'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useCurrentUser } from '../auth/hooks.ts'
import { useRoles } from '../roles/api.ts'
import { useGenerateDocuments } from './api.ts'

interface GenerateStepProps {
  topicId: string
  revision: RevisionSummary
  /** 建立者且為最新版本才能操作 */
  canOperate: boolean
}

/** 步驟 4：F5-3 勾選要產出的角色並產生文件；文件檢視與下載在 F6 實作 */
export function GenerateStep({ topicId, revision, canOperate }: GenerateStepProps) {
  const roles = useRoles()
  const canGenerate =
    revision.status === 'clarified' || (revision.status === 'failed' && revision.failedStage === 'generate')

  return (
    <div className="card card-wide">
      <h2>產出角色文件</h2>
      {roles.isPending ? (
        <p className="muted">載入角色中…</p>
      ) : roles.isError ? (
        <p className="alert alert-error">無法載入角色清單：{roles.error.message}</p>
      ) : canOperate && canGenerate ? (
        <RoleSelectForm topicId={topicId} revision={revision} roles={roles.data} />
      ) : (
        <SelectedRoles revision={revision} roles={roles.data} />
      )}
    </div>
  )
}

/** 預設勾選上次選過的角色（產出失敗重試時），沒有則勾選所有預設角色 */
function initialSelection(revision: RevisionSummary, roles: Role[]) {
  const previous = revision.selectedRoleIds.filter((id) => roles.some((r) => r.id === id))
  return new Set(previous.length > 0 ? previous : roles.filter((r) => r.isBuiltIn).map((r) => r.id))
}

function RoleSelectForm({ topicId, revision, roles }: { topicId: string; revision: RevisionSummary; roles: Role[] }) {
  const user = useCurrentUser()
  const generate = useGenerateDocuments(topicId, revision.id)
  const [selected, setSelected] = useState(() => initialSelection(revision, roles))
  const [error, setError] = useState<string | null>(null)

  function toggle(roleId: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(roleId)
      else next.delete(roleId)
      return next
    })
    setError(null)
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    // 依角色清單的順序送出
    const result = generateDocumentsSchema.safeParse({ roleIds: roles.filter((r) => selected.has(r.id)).map((r) => r.id) })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '請至少選擇一個角色')
      return
    }
    generate.mutate(result.data)
  }

  const allSelected = selected.size === roles.length

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p>勾選這次要產出文件的角色，每個角色會各產生一份 markdown。</p>
      <fieldset className="role-options">
        <legend className="sr-only">要產出的角色</legend>
        <div className="role-options-toolbar">
          <span className="muted small">已選擇 {selected.size} / {roles.length} 個角色</span>
          <button
            type="button"
            className="btn btn-small btn-ghost"
            onClick={() => {
              setSelected(new Set(allSelected ? [] : roles.map((r) => r.id)))
              setError(null)
            }}
          >
            {allSelected ? '全部取消' : '全選'}
          </button>
        </div>
        {roles.map((role) => (
          <label key={role.id} className="role-option">
            <input
              type="checkbox"
              checked={selected.has(role.id)}
              onChange={(e) => toggle(role.id, e.target.checked)}
            />
            <span>
              <span className="role-option-name">
                {role.name}
                {!role.isBuiltIn && <span className="badge badge-muted">自訂</span>}
              </span>
              {role.description && <span className="role-option-description">{role.description}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      <p className="muted small">
        需要其他角色？
        {user.role === 'admin' ? <Link to="/roles">到角色管理新增自訂角色</Link> : '請管理者在角色管理新增自訂角色。'}
      </p>
      {error && <p className="alert alert-error">{error}</p>}
      {generate.isError && <p className="alert alert-error">{generate.error.message}</p>}
      <div className="actions">
        <button type="submit" className="btn btn-primary" disabled={generate.isPending}>
          {generate.isPending
            ? '送出中…'
            : revision.status === 'failed'
              ? `重新產生 ${selected.size} 份文件`
              : `產生 ${selected.size} 份文件`}
        </button>
      </div>
    </form>
  )
}

/** 唯讀：已選擇的角色（非建立者、舊版本、產生中或已完成） */
function SelectedRoles({ revision, roles }: { revision: RevisionSummary; roles: Role[] }) {
  const selected = revision.selectedRoleIds
    .map((id) => roles.find((r) => r.id === id))
    .filter((r): r is Role => r !== undefined)

  if (selected.length === 0) {
    return <p className="muted">此版本尚未選擇要產出的角色。</p>
  }

  return (
    <>
      <p className="muted small">{revision.status === 'generating' ? '正在產出以下角色的文件：' : '此版本產出的角色：'}</p>
      <ul className="chip-list">
        {selected.map((role) => (
          <li key={role.id} className="chip">
            {role.name}
          </li>
        ))}
      </ul>
      {(revision.status === 'generating' || revision.status === 'completed') && (
        <p className="muted small">文件檢視與下載（F6 角色文件產出）開發中。</p>
      )}
    </>
  )
}
