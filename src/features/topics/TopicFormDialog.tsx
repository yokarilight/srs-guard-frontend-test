import {
  createTopicSchema,
  TOPIC_DESCRIPTION_MAX_LENGTH,
  updateTopicSchema,
  type CreateTopicInput,
  type TopicDetail,
} from '../../contracts/index.ts'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Dialog } from '../../components/Dialog.tsx'
import { FormField } from '../../components/FormField.tsx'
import { validate, type FieldErrors } from '../../lib/formErrors.ts'
import { useCreateTopic, useUpdateTopic } from './api.ts'

interface TopicFormDialogProps {
  open: boolean
  /** 有值時為編輯（F1-4），否則為建立（F1-1） */
  topic?: TopicDetail
  onClose: () => void
}

export function TopicFormDialog({ open, topic, onClose }: TopicFormDialogProps) {
  return (
    <Dialog open={open} title={topic ? '編輯主題' : '建立主題'} onClose={onClose}>
      {/* Dialog 關閉時不渲染內容，每次開啟都會以最新資料重設表單 */}
      <TopicForm topic={topic} onClose={onClose} />
    </Dialog>
  )
}

type FormValues = Required<CreateTopicInput>

function TopicForm({ topic, onClose }: Omit<TopicFormDialogProps, 'open'>) {
  const navigate = useNavigate()
  const createTopic = useCreateTopic()
  const updateTopic = useUpdateTopic(topic?.id ?? '')
  const mutation = topic ? updateTopic : createTopic
  const [values, setValues] = useState<FormValues>({
    name: topic?.name ?? '',
    description: topic?.description ?? '',
  })
  const [errors, setErrors] = useState<FieldErrors<FormValues>>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (topic) {
      const result = validate(updateTopicSchema, values)
      setErrors(result.errors ?? {})
      if (result.data) updateTopic.mutate(result.data, { onSuccess: onClose })
    } else {
      const result = validate(createTopicSchema, values)
      setErrors(result.errors ?? {})
      if (result.data) {
        createTopic.mutate(result.data, {
          // 建立後直接進入主題頁開始上傳
          onSuccess: (created) => navigate(`/topics/${created.id}`),
        })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FormField label="名稱" error={errors.name}>
        {(props) => (
          <input
            {...props}
            autoFocus
            value={values.name}
            onChange={(e) => setValues({ ...values, name: e.target.value })}
          />
        )}
      </FormField>
      <FormField
        label="描述（選填）"
        error={errors.description}
        hint={`${values.description.length} / ${TOPIC_DESCRIPTION_MAX_LENGTH}`}
      >
        {(props) => (
          <textarea
            {...props}
            rows={4}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
          />
        )}
      </FormField>
      {mutation.isError && <p className="alert alert-error">{mutation.error.message}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>
          取消
        </button>
        <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
          {topic ? (mutation.isPending ? '儲存中…' : '儲存') : mutation.isPending ? '建立中…' : '建立'}
        </button>
      </div>
    </form>
  )
}
