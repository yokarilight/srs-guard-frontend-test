import type { RevisionStatus, RevisionSummary } from '../../contracts/index.ts'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { ApiError } from '../../lib/api.ts'
import { dateTimeFormat } from '../../lib/format.ts'
import { useCurrentUser } from '../auth/hooks.ts'
import { useTopic } from './api.ts'
import { DeleteTopicDialog } from './DeleteTopicDialog.tsx'
import {
  currentStepOf,
  isTopicStep,
  statusBadge,
  stepStateOf,
  topicSteps,
  type StepState,
  type TopicStep,
} from './status.ts'
import { TopicFormDialog } from './TopicFormDialog.tsx'

const stepStateLabels: Record<StepState, string> = {
  done: '已完成',
  current: '進行中',
  failed: '失敗',
  locked: '尚未解鎖',
}

/** 各步驟的內容在 F2–F6 實作，目前先說明此步驟要做什麼 */
const stepDescriptions: Record<TopicStep, { title: string; body: string; feature: string }> = {
  upload: {
    title: '上傳 SRS 與 Figma',
    body: '上傳 SRS PDF（30 頁、20 MB 以內），可附上 Figma 截圖與連結，至少需有 SRS 才能開始審查。',
    feature: 'F2 輸入上傳',
  },
  review: {
    title: 'AI 審查',
    body: 'AI 審查 SRS 內部的缺漏與矛盾，以及 SRS 與 Figma 之間的落差，產出問題清單。',
    feature: 'F3 AI 審查與問題清單',
  },
  clarify: {
    title: '逐項釐清',
    body: '針對每個問題與 AI 對話釐清，或標記為接受現狀、不適用；全部處理完才能產出文件。',
    feature: 'F4 釐清互動',
  },
  generate: {
    title: '產出角色文件',
    body: '勾選要產出的角色，依 SRS、Figma 與釐清結論產生各角色的 markdown 文件。',
    feature: 'F5 角色管理、F6 角色文件產出',
  },
}

const statusMessages: Partial<Record<RevisionStatus, { text: string; className: string }>> = {
  reviewing: { text: 'AI 正在審查此版本，完成後會自動進入釐清步驟。', className: 'alert-info' },
  clarified: { text: '所有問題都已處理，可以選擇角色並產生文件。', className: 'alert-success' },
  generating: { text: 'AI 正在產生角色文件。', className: 'alert-info' },
  completed: { text: '角色文件已產生完成，可檢視或下載。', className: 'alert-success' },
}

function failedMessage(revision: RevisionSummary) {
  return revision.failedStage === 'review' ? 'AI 審查失敗，請重試。' : '角色文件產生失敗，請重試。'
}

/** F1-3：主題頁，依版本狀態顯示目前步驟；F1-4：編輯、刪除 */
export function TopicPage() {
  const { topicId = '' } = useParams()
  const user = useCurrentUser()
  const topic = useTopic(topicId)
  const [searchParams, setSearchParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (topic.isPending) {
    return (
      <section className="page">
        <p className="muted">載入中…</p>
      </section>
    )
  }
  if (topic.isError) {
    const notFound = topic.error instanceof ApiError && topic.error.status === 404
    return (
      <section className="page">
        <h1>{notFound ? '找不到主題' : '無法載入主題'}</h1>
        <p className="muted">{notFound ? '此主題不存在或已被刪除。' : topic.error.message}</p>
        <p>
          <Link to="/">回到主題列表</Link>
        </p>
      </section>
    )
  }

  const { data } = topic
  const isOwner = data.owner.id === user.id

  // ?v= 指定版本，預設為最新版本
  const requestedVersion = Number(searchParams.get('v'))
  const revision = data.revisions.find((r) => r.version === requestedVersion) ?? data.currentRevision
  const isLatest = revision?.id === data.currentRevision?.id

  // ?step= 可檢視已完成的步驟，鎖定的步驟不能進入
  const requestedStep = searchParams.get('step')
  const step =
    isTopicStep(requestedStep) && stepStateOf(requestedStep, revision) !== 'locked'
      ? requestedStep
      : currentStepOf(revision)

  function updateParams(changes: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams)
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key)
      else next.set(key, value)
    }
    setSearchParams(next, { replace: true })
  }

  const badge = statusBadge(revision)
  const statusMessage =
    revision?.status === 'failed'
      ? { text: failedMessage(revision), className: 'alert-error' }
      : revision && statusMessages[revision.status]
  const description = stepDescriptions[step]

  return (
    <section className="page">
      <p className="small">
        <Link to="/">← 主題列表</Link>
      </p>

      <div className="page-header">
        <div className="title-row">
          <h1>{data.name}</h1>
          <span className={`badge ${badge.className}`}>{badge.label}</span>
        </div>
        {isOwner && (
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              編輯
            </button>
            <button type="button" className="btn btn-danger" onClick={() => setDeleting(true)}>
              刪除
            </button>
          </div>
        )}
      </div>

      {data.description && <p className="topic-description">{data.description}</p>}
      <p className="muted small">
        建立者 {data.owner.name}
        {isOwner && '（你）'} · 建立於 {dateTimeFormat.format(new Date(data.createdAt))} · 最後更新{' '}
        {dateTimeFormat.format(new Date(data.updatedAt))}
      </p>

      {!isOwner && (
        <p className="alert alert-info">你不是此主題的建立者，只能檢視與下載，無法上傳或回答問題。</p>
      )}

      {data.revisions.length > 0 && (
        <div className="toolbar">
          <label htmlFor="revision-select">SRS 版本</label>
          <select
            id="revision-select"
            className="select"
            value={revision?.version}
            onChange={(e) => {
              const version = Number(e.target.value)
              updateParams({ v: version === data.currentRevision?.version ? null : String(version), step: null })
            }}
          >
            {data.revisions.map((r) => (
              <option key={r.id} value={r.version}>
                v{r.version}
                {r.id === data.currentRevision?.id ? '（最新）' : ''}
              </option>
            ))}
          </select>
          {!isLatest && <span className="badge badge-muted">舊版本（唯讀）</span>}
        </div>
      )}

      <ol className="steps">
        {topicSteps.map((s, index) => {
          const state = stepStateOf(s.key, revision)
          return (
            <li key={s.key}>
              <button
                type="button"
                className={`step step-${state}`}
                aria-current={step === s.key ? 'step' : undefined}
                disabled={state === 'locked'}
                onClick={() => updateParams({ step: s.key === currentStepOf(revision) ? null : s.key })}
              >
                <span className="step-index">{state === 'done' ? '✓' : state === 'failed' ? '!' : index + 1}</span>
                <span>
                  {s.label}
                  <span className="step-state">{stepStateLabels[state]}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ol>

      {statusMessage && step === currentStepOf(revision) && (
        <p className={`alert ${statusMessage.className}`}>{statusMessage.text}</p>
      )}

      <div className="card card-wide">
        <h2>{description.title}</h2>
        <p>{description.body}</p>
        <p className="muted small">此步驟的功能（{description.feature}）開發中。</p>
      </div>

      <TopicFormDialog open={editing} topic={data} onClose={() => setEditing(false)} />
      <DeleteTopicDialog open={deleting} topic={data} onClose={() => setDeleting(false)} />
    </section>
  )
}
