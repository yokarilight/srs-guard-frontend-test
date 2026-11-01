import {
  renameFigmaScreenSchema,
  SCREEN_MAX_BYTES,
  SCREEN_MAX_COUNT,
  type FigmaScreen,
} from '../../../contracts/index.ts'
import { useState, type FormEvent } from 'react'
import { Dialog } from '../../../components/Dialog.tsx'
import { FileDropZone } from '../../../components/FileDropZone.tsx'
import { formatBytes } from '../../../lib/format.ts'
import { useDeleteScreen, useFileUrl, useRefreshRevision, useRenameScreen, useUploadScreen } from '../revisionApi.ts'
import { checkScreenFile, defaultScreenName } from './fileChecks.ts'

interface FigmaScreensSectionProps {
  topicId: string
  revisionId: string
  screens: FigmaScreen[]
  editable: boolean
}

/** F2-2：上傳 Figma 截圖（多張），每張有畫面名稱；F2-4 預覽 */
export function FigmaScreensSection({ topicId, revisionId, screens, editable }: FigmaScreensSectionProps) {
  const upload = useUploadScreen(revisionId)
  const refresh = useRefreshRevision(topicId, revisionId)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [problems, setProblems] = useState<string[]>([])
  const [previewing, setPreviewing] = useState<FigmaScreen | null>(null)
  const remaining = SCREEN_MAX_COUNT - screens.length

  async function handleFiles(files: File[]) {
    if (files.length > remaining) {
      setProblems([
        `每個版本最多 ${SCREEN_MAX_COUNT} 張截圖，目前已有 ${screens.length} 張，最多還能再選 ${remaining} 張。`,
      ])
      return
    }

    const issues: string[] = []
    const valid = files.filter((file) => {
      const message = checkScreenFile(file)
      if (message) issues.push(`${file.name}：${message}`)
      return !message
    })
    setProblems(issues)
    if (valid.length === 0) return

    // 依序上傳，預設畫面名稱為檔名，上傳後可改名
    const taken = new Set(screens.map((s) => s.name))
    setProgress({ done: 0, total: valid.length })
    for (const [index, file] of valid.entries()) {
      const name = defaultScreenName(file.name, taken)
      try {
        await upload.mutateAsync({ file, name })
        taken.add(name)
      } catch (e) {
        issues.push(`${file.name}：${e instanceof Error ? e.message : '上傳失敗'}`)
      }
      setProgress({ done: index + 1, total: valid.length })
    }
    await refresh()
    setProgress(null)
    setProblems([...issues])
  }

  return (
    <section className="card card-wide upload-section">
      <div className="section-header">
        <h2>Figma 截圖（選填）</h2>
        <span className="muted small">
          {screens.length} / {SCREEN_MAX_COUNT} 張
        </span>
      </div>
      <p className="muted small">
        AI 只審查截圖中的畫面，請為每張截圖取一個容易辨識的畫面名稱，問題清單會以此標註來源。沒有截圖時只審查 SRS 本身。
      </p>

      {editable && remaining > 0 && (
        <FileDropZone
          accept="image/png,image/jpeg,.png,.jpg,.jpeg"
          multiple
          disabled={progress !== null}
          onFiles={handleFiles}
          label={progress ? `上傳中 ${progress.done} / ${progress.total}…` : '選擇截圖，或拖曳到這裡（可多選）'}
          hint={`PNG 或 JPG，單張 ${formatBytes(SCREEN_MAX_BYTES)} 以內，還能再上傳 ${remaining} 張`}
        />
      )}
      {problems.length > 0 && (
        <div className="alert alert-error" role="alert">
          {problems.length === 1 ? (
            problems[0]
          ) : (
            <>
              以下檔案未上傳：
              <ul className="problem-list">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {screens.length === 0 ? (
        !editable && <p className="muted">此版本沒有 Figma 截圖。</p>
      ) : (
        <ul className="screen-grid">
          {screens.map((screen) => (
            <ScreenCard
              key={screen.id}
              topicId={topicId}
              revisionId={revisionId}
              screen={screen}
              editable={editable}
              onPreview={() => setPreviewing(screen)}
            />
          ))}
        </ul>
      )}

      <Dialog open={previewing !== null} title={previewing?.name ?? ''} wide onClose={() => setPreviewing(null)}>
        {previewing && <ScreenPreview screen={previewing} onClose={() => setPreviewing(null)} />}
      </Dialog>
    </section>
  )
}

interface ScreenCardProps {
  topicId: string
  revisionId: string
  screen: FigmaScreen
  editable: boolean
  onPreview: () => void
}

function ScreenCard({ topicId, revisionId, screen, editable, onPreview }: ScreenCardProps) {
  const image = useFileUrl(screen.file.id)
  const [renaming, setRenaming] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const remove = useDeleteScreen(topicId, revisionId)

  return (
    <li className="screen-card">
      <button type="button" className="screen-thumb" onClick={onPreview} aria-label={`預覽「${screen.name}」`}>
        {image.url ? (
          <img src={image.url} alt="" />
        ) : (
          <span className="muted small">{image.error ? '無法載入' : '載入中…'}</span>
        )}
      </button>
      {renaming ? (
        <RenameForm topicId={topicId} revisionId={revisionId} screen={screen} onDone={() => setRenaming(false)} />
      ) : (
        <div className="screen-meta">
          <span className="screen-name" title={screen.name}>
            {screen.name}
          </span>
          <span className="muted small" title={screen.file.fileName}>
            {screen.file.fileName} · {formatBytes(screen.file.size)}
          </span>
        </div>
      )}
      {editable && !renaming && (
        <div className="row-actions">
          {confirmingDelete ? (
            <>
              <span className="small">確定刪除？</span>
              <button
                type="button"
                className="btn btn-small btn-danger"
                disabled={remove.isPending}
                onClick={() => remove.mutate(screen.id)}
              >
                {remove.isPending ? '刪除中…' : '刪除'}
              </button>
              <button type="button" className="btn btn-small btn-ghost" onClick={() => setConfirmingDelete(false)}>
                取消
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn btn-small" onClick={() => setRenaming(true)}>
                改名
              </button>
              <button type="button" className="btn btn-small btn-danger" onClick={() => setConfirmingDelete(true)}>
                刪除
              </button>
            </>
          )}
        </div>
      )}
      {remove.isError && <p className="field-error">{remove.error.message}</p>}
    </li>
  )
}

function RenameForm({
  topicId,
  revisionId,
  screen,
  onDone,
}: {
  topicId: string
  revisionId: string
  screen: FigmaScreen
  onDone: () => void
}) {
  const rename = useRenameScreen(topicId, revisionId)
  const [name, setName] = useState(screen.name)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const result = renameFigmaScreenSchema.safeParse({ name })
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? '畫面名稱不正確')
      return
    }
    if (result.data.name === screen.name) {
      onDone()
      return
    }
    rename.mutate({ screenId: screen.id, ...result.data }, { onSuccess: onDone })
  }

  const message = error ?? rename.error?.message
  return (
    <form className="rename-form" onSubmit={handleSubmit} noValidate>
      <input
        autoFocus
        aria-label="畫面名稱"
        aria-invalid={Boolean(message)}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onDone()
          }
        }}
      />
      {message && <p className="field-error">{message}</p>}
      <div className="row-actions">
        <button type="submit" className="btn btn-small btn-primary" disabled={rename.isPending}>
          {rename.isPending ? '儲存中…' : '儲存'}
        </button>
        <button type="button" className="btn btn-small btn-ghost" onClick={onDone}>
          取消
        </button>
      </div>
    </form>
  )
}

function ScreenPreview({ screen, onClose }: { screen: FigmaScreen; onClose: () => void }) {
  const image = useFileUrl(screen.file.id)
  return (
    <>
      <div className="screen-preview">
        {image.url ? (
          <img src={image.url} alt={screen.name} />
        ) : (
          <p className="muted">{image.error ? `無法載入圖片：${image.error.message}` : '載入中…'}</p>
        )}
      </div>
      <p className="muted small">
        {screen.file.fileName} · {formatBytes(screen.file.size)}
      </p>
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>
          關閉
        </button>
      </div>
    </>
  )
}
