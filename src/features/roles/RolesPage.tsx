import type { Role } from '../../contracts/index.ts'
import { useState, type ReactNode } from 'react'
import { useCurrentUser } from '../auth/hooks.ts'
import { useRoles } from './api.ts'
import { DeleteRoleDialog } from './DeleteRoleDialog.tsx'
import { RoleFormDialog } from './RoleFormDialog.tsx'

/** F5-1、F5-2、F5-4：角色管理。預設角色唯讀；自訂角色全域共用，僅管理者可新增、編輯、刪除 */
export function RolesPage() {
  const user = useCurrentUser()
  const isAdmin = user.role === 'admin'
  const roles = useRoles()
  const [creating, setCreating] = useState(false)
  const [editTarget, setEditTarget] = useState<Role | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null)

  const builtIn = roles.data?.filter((r) => r.isBuiltIn) ?? []
  const custom = roles.data?.filter((r) => !r.isBuiltIn) ?? []

  return (
    <section className="page">
      <div className="page-header">
        <h1>角色管理</h1>
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            新增自訂角色
          </button>
        )}
      </div>
      <p className="muted">
        角色決定產出哪些文件。自訂角色為全域設定，所有主題共用，產出文件時可在主題的「產出」步驟勾選。
      </p>
      {!isAdmin && <p className="alert alert-info">自訂角色由管理者維護，如需新增或修改請洽管理者。</p>}

      {roles.isPending ? (
        <p className="muted">載入中…</p>
      ) : roles.isError ? (
        <p className="alert alert-error">無法載入角色清單：{roles.error.message}</p>
      ) : (
        <>
          <h2 className="section-title">預設角色</h2>
          <div className="role-grid">
            {builtIn.map((role) => (
              <RoleCard key={role.id} role={role} />
            ))}
          </div>

          <h2 className="section-title">自訂角色</h2>
          {custom.length === 0 ? (
            <div className="empty-state">
              <p>目前沒有自訂角色。</p>
              {isAdmin && (
                <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                  新增第一個自訂角色
                </button>
              )}
            </div>
          ) : (
            <div className="role-grid">
              {custom.map((role) => (
                <RoleCard
                  key={role.id}
                  role={role}
                  actions={
                    isAdmin && (
                      <>
                        <button type="button" className="btn btn-small" onClick={() => setEditTarget(role)}>
                          編輯
                        </button>
                        <button
                          type="button"
                          className="btn btn-small btn-danger"
                          onClick={() => setDeleteTarget(role)}
                        >
                          刪除
                        </button>
                      </>
                    )
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      <RoleFormDialog open={creating} onClose={() => setCreating(false)} />
      <RoleFormDialog open={editTarget !== null} role={editTarget ?? undefined} onClose={() => setEditTarget(null)} />
      <DeleteRoleDialog role={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </section>
  )
}

function RoleCard({ role, actions }: { role: Role; actions?: ReactNode }) {
  return (
    <article className="role-card">
      <header className="role-card-header">
        <h3>{role.name}</h3>
        {role.isBuiltIn && <span className="badge badge-muted">預設</span>}
        {actions && <div className="row-actions">{actions}</div>}
      </header>
      <p className="role-description">{role.description || <span className="muted">（無職責描述）</span>}</p>
      {role.sections.length > 0 ? (
        <div>
          <p className="muted small">文件章節</p>
          <ul className="chip-list">
            {role.sections.map((section) => (
              <li key={section} className="chip">
                {section}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted small">未指定章節，由 AI 依職責描述決定。</p>
      )}
    </article>
  )
}
