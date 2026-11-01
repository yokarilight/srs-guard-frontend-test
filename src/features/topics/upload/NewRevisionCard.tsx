import type { RevisionDetail, RevisionStatus } from '../../../contracts/index.ts'
import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { formatBytes } from '../../../lib/format.ts'
import { NEW_REVISION_PARAM, revisionStatusLabels } from '../status.ts'
import { useCreateRevision } from '../revisionApi.ts'
import { SrsUploader } from './SrsSection.tsx'

const statusNotes: Partial<Record<RevisionStatus, string>> = {
  clarifying: '尚未釐清完的問題會停在目前狀態',
  clarified: '已釐清完成但尚未產生的角色文件不會產生',
  failed: '失敗的 AI 步驟不會再重試',
}

type SrsSource = 'upload' | 'reuse'

/** F7-1：最新版本已開始審查後，建立新版本重新上傳 SRS 與 Figma；舊版本保留為唯讀 */
export function NewRevisionCard({ topicId, revision }: { topicId: string; revision: RevisionDetail }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [expanded, setExpanded] = useState(false)
  const open = expanded || searchParams.get(NEW_REVISION_PARAM) === '1'
  const next = revision.version + 1

  function close() {
    setExpanded(false)
    if (searchParams.has(NEW_REVISION_PARAM)) {
      const params = new URLSearchParams(searchParams)
      params.delete(NEW_REVISION_PARAM)
      setSearchParams(params, { replace: true })
    }
  }

  if (!open) {
    return (
      <section className="card card-wide new-revision new-revision-collapsed">
        <div>
          <h2>需要修改 SRS 或 Figma？</h2>
          <p className="muted small">v{revision.version} 已開始審查，無法再修改。可以建立 v{next}，重新上傳後再審查一次。</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setExpanded(true)}>
          建立 v{next}
        </button>
      </section>
    )
  }

  return <NewRevisionForm topicId={topicId} revision={revision} onClose={close} />
}

function NewRevisionForm({ topicId, revision, onClose }: { topicId: string; revision: RevisionDetail; onClose: () => void }) {
  const [, setSearchParams] = useSearchParams()
  const create = useCreateRevision(topicId)
  const [source, setSource] = useState<SrsSource>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const next = revision.version + 1
  const statusNote = statusNotes[revision.status]

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (source === 'upload' && !file) {
      setError('請選擇新的 SRS PDF，或改為沿用上一版的 SRS')
      return
    }
    create.mutate(source === 'upload' ? file : null, {
      // 回到最新版本的上傳步驟（新版本為草稿）
      onSuccess: () => setSearchParams(new URLSearchParams(), { replace: true }),
    })
  }

  return (
    <form className="card card-wide new-revision" onSubmit={handleSubmit} noValidate>
      <h2>建立 v{next}</h2>

      <fieldset className="srs-source">
        <legend>SRS</legend>
        <label className="role-option">
          <input
            type="radio"
            name="srs-source"
            checked={source === 'upload'}
            onChange={() => {
              setSource('upload')
              setError(null)
            }}
          />
          <span>
            <span className="role-option-name">上傳新的 SRS PDF</span>
          </span>
        </label>
        {source === 'upload' &&
          (file ? (
            <div className="file-row staged-file">
              <span className="file-icon" aria-hidden>
                PDF
              </span>
              <div className="file-info">
                <span className="file-name">{file.name}</span>
                <span className="muted small">{formatBytes(file.size)} · 已通過檢查，建立版本時上傳</span>
              </div>
              <button type="button" className="btn btn-small" onClick={() => setFile(null)} disabled={create.isPending}>
                重新選擇
              </button>
            </div>
          ) : (
            <SrsUploader
              pending={false}
              serverError={null}
              onUpload={(selected) => {
                setFile(selected)
                setError(null)
              }}
            />
          ))}
        <label className="role-option">
          <input
            type="radio"
            name="srs-source"
            checked={source === 'reuse'}
            onChange={() => {
              setSource('reuse')
              setError(null)
            }}
          />
          <span>
            <span className="role-option-name">沿用 v{revision.version} 的 SRS</span>
            <span className="role-option-description">
              {revision.srs.fileName}（{revision.srs.pageCount} 頁）；只修改 Figma 時選這個
            </span>
          </span>
        </label>
      </fieldset>

      <ul className="confirm-list">
        <li>
          會複製 v{revision.version} 的 Figma 截圖 {revision.figmaScreens.length} 張、連結 {revision.figmaLinks.length}{' '}
          個，建立後在草稿階段可以再新增、改名或刪除。
        </li>
        <li>
          v{revision.version}（{revisionStatusLabels[revision.status]}）的問題清單、釐清紀錄與角色文件全部保留為唯讀
          {statusNote ? `，${statusNote}` : ''}；可用版本選單切換檢視。
        </li>
        <li>建立後需要再按一次「開始審查」。</li>
      </ul>

      {(error ?? create.error) && <p className="alert alert-error">{error ?? create.error?.message}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose} disabled={create.isPending}>
          取消
        </button>
        <button type="submit" className="btn btn-primary" disabled={create.isPending}>
          {create.isPending ? '建立中…' : `建立 v${next}`}
        </button>
      </div>
    </form>
  )
}
