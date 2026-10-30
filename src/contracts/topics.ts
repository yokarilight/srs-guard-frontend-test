import { z } from 'zod'

export const TOPIC_NAME_MAX_LENGTH = 100
export const TOPIC_DESCRIPTION_MAX_LENGTH = 1000

/** 每個版本的狀態：草稿 → 審查中 → 待釐清 → 釐清完成 → 文件產生中 → 已完成；AI 步驟失敗時為 failed */
export const revisionStatuses = [
  'draft',
  'reviewing',
  'clarifying',
  'clarified',
  'generating',
  'completed',
  'failed',
] as const
export type RevisionStatus = (typeof revisionStatuses)[number]

/** status 為 failed 時，失敗的是哪一個 AI 步驟 */
export type FailedStage = 'review' | 'generate'

export interface RevisionSummary {
  id: string
  /** 1, 2, 3... */
  version: number
  status: RevisionStatus
  failedStage: FailedStage | null
  createdAt: string
}

export interface TopicOwner {
  id: string
  name: string
}

export interface TopicSummary {
  id: string
  name: string
  description: string
  owner: TopicOwner
  /** 最新版本；尚未上傳 SRS 時為 null */
  currentRevision: RevisionSummary | null
  createdAt: string
  /** 主題或任一版本有異動時更新 */
  updatedAt: string
}

export interface TopicDetail extends TopicSummary {
  /** 所有版本，新到舊 */
  revisions: RevisionSummary[]
}

/** GET /api/topics?scope=all|mine */
export const topicScopes = ['all', 'mine'] as const
export type TopicScope = (typeof topicScopes)[number]

const name = z
  .string()
  .trim()
  .min(1, '請輸入主題名稱')
  .max(TOPIC_NAME_MAX_LENGTH, `主題名稱最多 ${TOPIC_NAME_MAX_LENGTH} 個字元`)

const description = z
  .string()
  .trim()
  .max(TOPIC_DESCRIPTION_MAX_LENGTH, `描述最多 ${TOPIC_DESCRIPTION_MAX_LENGTH} 個字元`)

/** POST /api/topics */
export const createTopicSchema = z.object({
  name,
  description: description.default(''),
})
export type CreateTopicInput = z.input<typeof createTopicSchema>

/** PATCH /api/topics/:topicId（僅建立者） */
export const updateTopicSchema = z
  .object({
    name: name.optional(),
    description: description.optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: '至少需要一個欄位',
  })
export type UpdateTopicInput = z.input<typeof updateTopicSchema>

export interface TopicsResponse {
  topics: TopicSummary[]
}

export interface TopicResponse {
  topic: TopicDetail
}
