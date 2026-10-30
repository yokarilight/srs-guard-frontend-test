import type { TopicDetail } from '../../contracts/index.ts'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Dialog } from '../../components/Dialog.tsx'
import { FormField } from '../../components/FormField.tsx'
import { topicDetailKey, useDeleteTopic } from './api.ts'

interface DeleteTopicDialogProps {
  open: boolean
  topic: TopicDetail
  onClose: () => void
}

/** F1-4：刪除主題，需輸入主題名稱做二次確認 */
export function DeleteTopicDialog({ open, topic, onClose }: DeleteTopicDialogProps) {
  return (
    <Dialog open={open} title="刪除主題" onClose={onClose}>
      <DeleteTopicForm topic={topic} onClose={onClose} />
    </Dialog>
  )
}

function DeleteTopicForm({ topic, onClose }: Omit<DeleteTopicDialogProps, 'open'>) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const deleteTopic = useDeleteTopic(topic.id)
  const [confirmName, setConfirmName] = useState('')
  const confirmed = confirmName.trim() === topic.name

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!confirmed) return
    deleteTopic.mutate(undefined, {
      onSuccess: () => {
        navigate('/', { replace: true })
        queryClient.removeQueries({ queryKey: topicDetailKey(topic.id) })
      },
    })
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="alert alert-error">
        將刪除「{topic.name}」的所有版本（共 {topic.revisions.length} 個）、問題清單、釐清紀錄、角色文件與上傳的檔案，
        刪除後無法復原。
      </p>
      <FormField label="請輸入主題名稱以確認">
        {(props) => (
          <input
            {...props}
            autoFocus
            autoComplete="off"
            placeholder={topic.name}
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
          />
        )}
      </FormField>
      {deleteTopic.isError && <p className="alert alert-error">{deleteTopic.error.message}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>
          取消
        </button>
        <button type="submit" className="btn btn-danger" disabled={!confirmed || deleteTopic.isPending}>
          {deleteTopic.isPending ? '刪除中…' : '永久刪除'}
        </button>
      </div>
    </form>
  )
}
