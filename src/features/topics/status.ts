import type { RevisionStatus, RevisionSummary } from '../../contracts/index.ts'

export const revisionStatusLabels: Record<RevisionStatus, string> = {
  draft: '草稿',
  reviewing: '審查中',
  clarifying: '待釐清',
  clarified: '釐清完成',
  generating: '文件產生中',
  completed: '已完成',
  failed: '失敗',
}

const revisionStatusBadges: Record<RevisionStatus, string> = {
  draft: 'badge-muted',
  reviewing: 'badge-info',
  clarifying: 'badge-warning',
  clarified: 'badge-success',
  generating: 'badge-info',
  completed: 'badge-success',
  failed: 'badge-danger',
}

/** 狀態標籤；尚未上傳 SRS 時 revision 為 null */
export function statusBadge(revision: RevisionSummary | null) {
  if (!revision) return { label: '尚未上傳', className: 'badge-muted' }
  return { label: revisionStatusLabels[revision.status], className: revisionStatusBadges[revision.status] }
}

/** 主題頁步驟條：上傳 → 審查 → 釐清 → 產出 */
export const topicSteps = [
  { key: 'upload', label: '上傳' },
  { key: 'review', label: '審查' },
  { key: 'clarify', label: '釐清' },
  { key: 'generate', label: '產出' },
] as const
export type TopicStep = (typeof topicSteps)[number]['key']

export function isTopicStep(value: string | null): value is TopicStep {
  return topicSteps.some((s) => s.key === value)
}

/** F1-3：依版本狀態決定目前所在的步驟 */
export function currentStepOf(revision: RevisionSummary | null): TopicStep {
  switch (revision?.status) {
    case undefined:
    case 'draft':
      return 'upload'
    case 'reviewing':
      return 'review'
    case 'clarifying':
      return 'clarify'
    case 'clarified':
    case 'generating':
    case 'completed':
      return 'generate'
    case 'failed':
      return revision.failedStage === 'review' ? 'review' : 'generate'
  }
}

export type StepState = 'done' | 'current' | 'failed' | 'locked'

/** 目前步驟之前為完成、之後為鎖定；全部完成時產出步驟也算完成 */
export function stepStateOf(step: TopicStep, revision: RevisionSummary | null): StepState {
  const index = topicSteps.findIndex((s) => s.key === step)
  const currentIndex = topicSteps.findIndex((s) => s.key === currentStepOf(revision))
  if (index < currentIndex) return 'done'
  if (index > currentIndex) return 'locked'
  if (revision?.status === 'failed') return 'failed'
  if (revision?.status === 'completed') return 'done'
  return 'current'
}

/** 主題頁網址帶 ?new=1 時直接展開建立新版本的表單（頁首「建立新版本」按鈕） */
export const NEW_REVISION_PARAM = 'new'

/** AI 背景任務進行中，不能建立新版本 */
export function isRevisionBusy(status: RevisionStatus) {
  return status === 'reviewing' || status === 'generating'
}
