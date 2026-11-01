import type { RevisionDetail, RevisionSummary } from '../../../contracts/index.ts'
import { useState } from 'react'
import { Dialog } from '../../../components/Dialog.tsx'
import { useCreateRevision, useRevision, useStartReview } from '../revisionApi.ts'
import { FigmaLinksSection } from './FigmaLinksSection.tsx'
import { FigmaScreensSection } from './FigmaScreensSection.tsx'
import { isRevisionBusy } from '../status.ts'
import { NewRevisionCard } from './NewRevisionCard.tsx'
import { SrsSection, SrsUploader } from './SrsSection.tsx'

interface UploadStepProps {
  topicId: string
  /** 尚未上傳 SRS 時為 null */
  revision: RevisionSummary | null
  /** 建立者且為最新版本才能操作 */
  canOperate: boolean
}

/** 步驟 1：F2 上傳 SRS 與 Figma；開始審查（F3-1）；開始審查後可建立新版本（F7-1） */
export function UploadStep({ topicId, revision, canOperate }: UploadStepProps) {
  if (!revision) return <FirstUpload topicId={topicId} canOperate={canOperate} />
  return <RevisionInputs key={revision.id} topicId={topicId} revision={revision} canOperate={canOperate} />
}

function FirstUpload({ topicId, canOperate }: { topicId: string; canOperate: boolean }) {
  const create = useCreateRevision(topicId)

  if (!canOperate) {
    return (
      <div className="card card-wide">
        <h2>上傳 SRS 與 Figma</h2>
        <p className="muted">建立者尚未上傳 SRS。</p>
      </div>
    )
  }

  return (
    <section className="card card-wide upload-section">
      <h2>上傳 SRS</h2>
      <p>先上傳 SRS PDF 建立第 1 版，接著可以附上 Figma 截圖與連結，再開始 AI 審查。</p>
      <SrsUploader
        pending={create.isPending}
        serverError={create.error?.message ?? null}
        onUpload={(file) => create.mutate(file)}
      />
    </section>
  )
}

function RevisionInputs({ topicId, revision, canOperate }: { topicId: string; revision: RevisionSummary; canOperate: boolean }) {
  const detail = useRevision(revision.id)
  // 狀態以主題頁的版本摘要為準（主題頁會輪詢），版本詳情只用來顯示檔案
  const editable = canOperate && revision.status === 'draft'
  const busy = isRevisionBusy(revision.status)

  if (detail.isPending) return <p className="muted">載入版本內容中…</p>
  if (detail.isError) return <p className="alert alert-error">無法載入版本內容：{detail.error.message}</p>

  const { data } = detail
  return (
    <>
      {canOperate && !editable && busy && (
        <p className="alert alert-info">
          AI 正在{revision.status === 'reviewing' ? '審查' : '產生文件'}，完成後才能建立新版本修改 SRS 與 Figma。
        </p>
      )}
      {canOperate && !editable && !busy && <NewRevisionCard topicId={topicId} revision={data} />}
      <SrsSection topicId={topicId} revisionId={data.id} srs={data.srs} editable={editable} />
      <FigmaScreensSection topicId={topicId} revisionId={data.id} screens={data.figmaScreens} editable={editable} />
      <FigmaLinksSection topicId={topicId} revisionId={data.id} links={data.figmaLinks} editable={editable} />
      {editable && <StartReview topicId={topicId} revision={data} />}
    </>
  )
}

function StartReview({ topicId, revision }: { topicId: string; revision: RevisionDetail }) {
  const [confirming, setConfirming] = useState(false)

  return (
    <section className="card card-wide start-review">
      <div>
        <h2>開始審查</h2>
        <p className="muted small">
          AI 會審查 SRS（{revision.srs.pageCount} 頁）
          {revision.figmaScreens.length > 0 ? `與 ${revision.figmaScreens.length} 張 Figma 截圖` : ''}
          ，列出缺漏、矛盾與模糊之處。
        </p>
      </div>
      <button type="button" className="btn btn-primary" onClick={() => setConfirming(true)}>
        開始審查
      </button>
      <Dialog open={confirming} title="開始審查？" onClose={() => setConfirming(false)}>
        <StartReviewConfirm topicId={topicId} revision={revision} onClose={() => setConfirming(false)} />
      </Dialog>
    </section>
  )
}

function StartReviewConfirm({
  topicId,
  revision,
  onClose,
}: {
  topicId: string
  revision: RevisionDetail
  onClose: () => void
}) {
  const start = useStartReview(topicId, revision.id)

  return (
    <>
      <ul className="confirm-list">
        <li>SRS：{revision.srs.fileName}（{revision.srs.pageCount} 頁）</li>
        <li>Figma 截圖：{revision.figmaScreens.length} 張</li>
        <li>Figma 連結：{revision.figmaLinks.length} 個</li>
      </ul>
      {revision.figmaScreens.length === 0 && (
        <p className="alert alert-info">沒有 Figma 截圖，AI 只會審查 SRS 內部的缺漏與矛盾，不會檢查設計稿落差。</p>
      )}
      <p>開始後此版本的 SRS 與 Figma 截圖、連結都無法再修改；之後要調整需上傳新版 SRS。</p>
      {start.isError && <p className="alert alert-error">{start.error.message}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>
          取消
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={start.isPending}
          onClick={() => start.mutate(undefined, { onSuccess: onClose })}
        >
          {start.isPending ? '送出中…' : '開始審查'}
        </button>
      </div>
    </>
  )
}
