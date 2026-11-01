import {
  createFigmaLinkSchema,
  LINK_MAX_COUNT,
  type CreateFigmaLinkInput,
  type FigmaLink,
} from '../../../contracts/index.ts'
import { useState, type FormEvent } from 'react'
import { FormField } from '../../../components/FormField.tsx'
import { validate, type FieldErrors } from '../../../lib/formErrors.ts'
import { useAddLink, useDeleteLink } from '../revisionApi.ts'

interface FigmaLinksSectionProps {
  topicId: string
  revisionId: string
  links: FigmaLink[]
  editable: boolean
}

/** F2-3：Figma 連結只作為參考附在文件中，AI 不讀取連結內容 */
export function FigmaLinksSection({ topicId, revisionId, links, editable }: FigmaLinksSectionProps) {
  return (
    <section className="card card-wide upload-section">
      <div className="section-header">
        <h2>Figma 連結（選填）</h2>
        <span className="muted small">
          {links.length} / {LINK_MAX_COUNT} 個
        </span>
      </div>
      <p className="muted small">AI 不會讀取連結內容，連結只附在問題清單與角色文件中供參考；設計稿審查以上方截圖為準。</p>

      {links.length === 0 ? (
        !editable && <p className="muted">此版本沒有 Figma 連結。</p>
      ) : (
        <ul className="link-list">
          {links.map((link) => (
            <LinkItem key={link.id} topicId={topicId} revisionId={revisionId} link={link} editable={editable} />
          ))}
        </ul>
      )}

      {editable && links.length < LINK_MAX_COUNT && <AddLinkForm topicId={topicId} revisionId={revisionId} />}
    </section>
  )
}

function LinkItem({ topicId, revisionId, link, editable }: { topicId: string; revisionId: string; link: FigmaLink; editable: boolean }) {
  const remove = useDeleteLink(topicId, revisionId)
  const [confirming, setConfirming] = useState(false)

  return (
    <li className="link-item">
      <div className="link-info">
        <a href={link.url} target="_blank" rel="noopener noreferrer">
          {link.label || link.url}
        </a>
        {link.label && <span className="muted small link-url">{link.url}</span>}
        {remove.isError && <span className="field-error">{remove.error.message}</span>}
      </div>
      {editable && (
        <div className="row-actions">
          {confirming ? (
            <>
              <span className="small">確定刪除？</span>
              <button
                type="button"
                className="btn btn-small btn-danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(link.id)}
              >
                {remove.isPending ? '刪除中…' : '刪除'}
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirming(false)}>
                取消
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-small btn-danger" onClick={() => setConfirming(true)}>
              刪除
            </button>
          )}
        </div>
      )}
    </li>
  )
}

type LinkFormValues = Required<CreateFigmaLinkInput>

function AddLinkForm({ topicId, revisionId }: { topicId: string; revisionId: string }) {
  const add = useAddLink(topicId, revisionId)
  const [values, setValues] = useState<LinkFormValues>({ url: '', label: '' })
  const [errors, setErrors] = useState<FieldErrors<LinkFormValues>>({})

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = validate(createFigmaLinkSchema, values)
    setErrors(result.errors ?? {})
    if (result.data) add.mutate(result.data, { onSuccess: () => setValues({ url: '', label: '' }) })
  }

  return (
    <form className="link-form" onSubmit={handleSubmit} noValidate>
      <div className="link-form-fields">
        <FormField label="連結" error={errors.url}>
          {(props) => (
            <input
              {...props}
              type="url"
              inputMode="url"
              placeholder="https://www.figma.com/design/…"
              value={values.url}
              onChange={(e) => setValues({ ...values, url: e.target.value })}
            />
          )}
        </FormField>
        <FormField label="名稱（選填）" error={errors.label}>
          {(props) => (
            <input
              {...props}
              placeholder="例如：會員中心 v2 設計稿"
              value={values.label}
              onChange={(e) => setValues({ ...values, label: e.target.value })}
            />
          )}
        </FormField>
      </div>
      {add.isError && <p className="alert alert-error">{add.error.message}</p>}
      <div className="actions">
        <button type="submit" className="btn" disabled={add.isPending}>
          {add.isPending ? '新增中…' : '新增連結'}
        </button>
      </div>
    </form>
  )
}
