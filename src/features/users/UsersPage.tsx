import type { User } from '../../contracts/index.ts'
import { useState } from 'react'
import { useCurrentUser } from '../auth/hooks.ts'
import { useUpdateUser, useUsers } from './api.ts'
import { CreateUserDialog } from './CreateUserDialog.tsx'
import { ResetPasswordDialog } from './ResetPasswordDialog.tsx'

const dateFormat = new Intl.DateTimeFormat('zh-TW', { dateStyle: 'medium' })

/** F8-2：使用者管理（僅管理者） */
export function UsersPage() {
  const me = useCurrentUser()
  const users = useUsers()
  const updateUser = useUpdateUser()
  const [creating, setCreating] = useState(false)
  const [resetTarget, setResetTarget] = useState<User | null>(null)

  function toggleDisabled(user: User) {
    const action = user.disabled ? '啟用' : '停用'
    if (!window.confirm(`確定要${action}「${user.name}」（${user.email}）？`)) return
    updateUser.mutate({ userId: user.id, input: { disabled: !user.disabled } })
  }

  return (
    <section className="page">
      <div className="page-header">
        <h1>使用者管理</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          建立帳號
        </button>
      </div>

      {updateUser.isError && <p className="alert alert-error">{updateUser.error.message}</p>}

      {users.isPending ? (
        <p className="muted">載入中…</p>
      ) : users.isError ? (
        <p className="alert alert-error">無法載入使用者清單：{users.error.message}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>名稱</th>
                <th>Email</th>
                <th>權限</th>
                <th>狀態</th>
                <th>建立時間</th>
                <th aria-label="操作" />
              </tr>
            </thead>
            <tbody>
              {users.data.map((user) => {
                const isMe = user.id === me.id
                const busy = updateUser.isPending && updateUser.variables.userId === user.id
                return (
                  <tr key={user.id} className={user.disabled ? 'row-disabled' : undefined}>
                    <td>
                      {user.name}
                      {isMe && <span className="muted">（你）</span>}
                    </td>
                    <td>{user.email}</td>
                    <td>{user.role === 'admin' ? '管理者' : '一般使用者'}</td>
                    <td>
                      <span className={`badge ${user.disabled ? 'badge-muted' : 'badge-success'}`}>
                        {user.disabled ? '已停用' : '啟用中'}
                      </span>
                    </td>
                    <td>{dateFormat.format(new Date(user.createdAt))}</td>
                    <td className="row-actions">
                      <button type="button" className="btn btn-small" onClick={() => setResetTarget(user)}>
                        重設密碼
                      </button>
                      <button
                        type="button"
                        className={`btn btn-small ${user.disabled ? '' : 'btn-danger'}`}
                        disabled={isMe || busy}
                        title={isMe ? '無法停用自己的帳號' : undefined}
                        onClick={() => toggleDisabled(user)}
                      >
                        {user.disabled ? '啟用' : '停用'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserDialog open={creating} onClose={() => setCreating(false)} />
      <ResetPasswordDialog user={resetTarget} onClose={() => setResetTarget(null)} />
    </section>
  )
}
