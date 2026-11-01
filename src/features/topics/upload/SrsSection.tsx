import { SRS_MAX_BYTES, SRS_MAX_PAGES, type SrsFile } from '../../../contracts/index.ts'
import { useState } from 'react'
import { FileDropZone } from '../../../components/FileDropZone.tsx'
import { dateTimeFormat, formatBytes } from '../../../lib/format.ts'
import { useDownloadFile, useFileUrl, useReplaceSrs } from '../revisionApi.ts'
import { checkSrsFile } from './fileChecks.ts'

interface SrsUploaderProps {
  onUpload: (file: File) => void
  pending: boolean
  /** 後端回傳的錯誤 */
  serverError: string | null
  onCancel?: () => void
}

/** F2-1：選擇或拖曳 PDF，前端先檢查類型、大小、頁數再上傳 */
export function SrsUploader({ onUpload, pending, serverError, onCancel }: SrsUploaderProps) {
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleFiles([file]: File[]) {
    if (!file) return
    setError(null)
    setChecking(true)
    const message = await checkSrsFile(file)
    setChecking(false)
    if (message) setError(message)
    else onUpload(file)
  }

  const busy = checking || pending
  return (
    <div className="uploader">
      <FileDropZone
        accept="application/pdf,.pdf"
        disabled={busy}
        onFiles={handleFiles}
        label={checking ? '檢查檔案中…' : pending ? '上傳中…' : '選擇 SRS PDF，或拖曳到這裡'}
        hint={`PDF 單檔，${SRS_MAX_PAGES} 頁、${formatBytes(SRS_MAX_BYTES)} 以內`}
      />
      {(error ?? serverError) && <p className="alert alert-error">{error ?? serverError}</p>}
      {onCancel && (
        <div className="actions">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            取消更換
          </button>
        </div>
      )}
    </div>
  )
}

interface SrsSectionProps {
  topicId: string
  revisionId: string
  srs: SrsFile
  /** 建立者、最新版本且為草稿 */
  editable: boolean
}

/** SRS 檔案資訊、預覽（F2-4）、下載；草稿階段可更換（覆蓋目前版本） */
export function SrsSection({ topicId, revisionId, srs, editable }: SrsSectionProps) {
  const replace = useReplaceSrs(topicId, revisionId)
  const download = useDownloadFile()
  const [previewing, setPreviewing] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  async function handleDownload() {
    setDownloadError(null)
    try {
      await download(srs.id, srs.fileName)
    } catch (e) {
      setDownloadError(e instanceof Error ? e.message : '下載失敗')
    }
  }

  return (
    <section className="card card-wide upload-section">
      <h2>SRS 文件</h2>
      <div className="file-row">
        <span className="file-icon" aria-hidden>
          PDF
        </span>
        <div className="file-info">
          <span className="file-name">{srs.fileName}</span>
          <span className="muted small">
            {srs.pageCount} 頁 · {formatBytes(srs.size)} · 上傳於 {dateTimeFormat.format(new Date(srs.uploadedAt))}
          </span>
        </div>
        <div className="row-actions">
          <button type="button" className="btn btn-small" aria-expanded={previewing} onClick={() => setPreviewing(!previewing)}>
            {previewing ? '收合預覽' : '預覽'}
          </button>
          <button type="button" className="btn btn-small" onClick={handleDownload}>
            下載
          </button>
          {editable && !replacing && (
            <button type="button" className="btn btn-small" onClick={() => setReplacing(true)}>
              更換 PDF
            </button>
          )}
        </div>
      </div>
      {downloadError && <p className="alert alert-error">{downloadError}</p>}

      {editable && replacing && (
        <>
          <p className="muted small">更換後會覆蓋目前的 SRS（尚未審查，不會產生新版本）。</p>
          <SrsUploader
            pending={replace.isPending}
            serverError={replace.error?.message ?? null}
            onUpload={(file) =>
              replace.mutate(file, {
                onSuccess: () => {
                  setReplacing(false)
                  replace.reset()
                },
              })
            }
            onCancel={() => {
              setReplacing(false)
              replace.reset()
            }}
          />
        </>
      )}

      {previewing && <PdfPreview fileId={srs.id} title={srs.fileName} />}
    </section>
  )
}

function PdfPreview({ fileId, title }: { fileId: string; title: string }) {
  const file = useFileUrl(fileId)
  if (file.error) return <p className="alert alert-error">無法載入 PDF：{file.error.message}</p>
  if (!file.url) return <p className="muted">載入 PDF 中…</p>
  return <iframe className="pdf-preview" src={file.url} title={`${title} 預覽`} />
}
