import type { Role } from '../../contracts/index.ts'
import { Dialog } from '../../components/Dialog.tsx'
import { ApiError } from '../../lib/api.ts'
import { useDeleteRole } from './api.ts'

interface DeleteRoleDialogProps {
  role: Role | null
  onClose: () => void
}

/** 刪除自訂角色；使用中的角色後端回 409，在對話框內顯示原因 */
export function DeleteRoleDialog({ role, onClose }: DeleteRoleDialogProps) {
  return (
    <Dialog open={role !== null} title="刪除角色" onClose={onClose}>
      {role && <DeleteRoleConfirm role={role} onClose={onClose} />}
    </Dialog>
  )
}

function DeleteRoleConfirm({ role, onClose }: { role: Role; onClose: () => void }) {
  const deleteRole = useDeleteRole(role.id)
  const inUse = deleteRole.error instanceof ApiError && deleteRole.error.status === 409

  return (
    <div>
      <p>確定要刪除自訂角色「{role.name}」？</p>
      <p className="muted small">
        已有使用者設為「我的角色」，或已有版本選擇產出此角色時無法刪除，只能編輯。
      </p>
      {deleteRole.isError && <p className="alert alert-error">{deleteRole.error.message}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>
          {inUse ? '關閉' : '取消'}
        </button>
        <button
          type="button"
          className="btn btn-danger"
          disabled={deleteRole.isPending || inUse}
          onClick={() => deleteRole.mutate(undefined, { onSuccess: onClose })}
        >
          {deleteRole.isPending ? '刪除中…' : '刪除'}
        </button>
      </div>
    </div>
  )
}
