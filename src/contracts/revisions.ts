import { z } from 'zod'
import type { RevisionSummary } from './topics.ts'

const MB = 1024 * 1024

/** F2-1：SRS PDF 單檔，30 頁、20 MB 以內 */
export const SRS_MAX_BYTES = 20 * MB
export const SRS_MAX_PAGES = 30
export const SRS_CONTENT_TYPE = 'application/pdf'

/** F2-2：Figma 截圖 PNG / JPG，單張 10 MB 以內，每個版本最多 20 張 */
export const SCREEN_MAX_BYTES = 10 * MB
export const SCREEN_MAX_COUNT = 20
export const screenContentTypes = ['image/png', 'image/jpeg'] as const
export type ScreenContentType = (typeof screenContentTypes)[number]
export const SCREEN_NAME_MAX_LENGTH = 100

/** F2-3：Figma 連結，每個版本最多 20 個 */
export const LINK_MAX_COUNT = 20
export const LINK_LABEL_MAX_LENGTH = 100

/** 存在 GridFS 的檔案；內容由 GET /api/files/:fileId 取得 */
export interface StoredFile {
  id: string
  fileName: string
  contentType: string
  /** bytes */
  size: number
  uploadedAt: string
}

export interface SrsFile extends StoredFile {
  pageCount: number
}

export interface FigmaScreen {
  id: string
  /** 畫面名稱，AI 審查時以此標註來源（同一版本內不可重複） */
  name: string
  file: StoredFile
}

/** 只作為參考附在問題清單與角色文件中，AI 不讀取連結內容 */
export interface FigmaLink {
  id: string
  url: string
  /** 選填，空字串表示未命名 */
  label: string
  createdAt: string
}

/** GET /api/revisions/:revisionId */
export interface RevisionDetail extends RevisionSummary {
  topicId: string
  /** 版本由上傳 SRS 建立，一定有 SRS */
  srs: SrsFile
  figmaScreens: FigmaScreen[]
  figmaLinks: FigmaLink[]
}

export interface RevisionDetailResponse {
  revision: RevisionDetail
}

export interface FigmaScreenResponse {
  screen: FigmaScreen
}

export interface FigmaLinkResponse {
  link: FigmaLink
}

export const screenNameSchema = z
  .string()
  .trim()
  .min(1, '請輸入畫面名稱')
  .max(SCREEN_NAME_MAX_LENGTH, `畫面名稱最多 ${SCREEN_NAME_MAX_LENGTH} 個字元`)

/**
 * POST /api/revisions/:revisionId/figma/screens（multipart：file、name）
 * 一次上傳一張；name 的驗證規則同下
 */
export const renameFigmaScreenSchema = z.object({ name: screenNameSchema })
/** PATCH /api/revisions/:revisionId/figma/screens/:screenId */
export type RenameFigmaScreenInput = z.input<typeof renameFigmaScreenSchema>

/** https，網域為 figma.com 或其子網域 */
export function isFigmaUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && /(^|\.)figma\.com$/.test(url.hostname)
  } catch {
    return false
  }
}

/** POST /api/revisions/:revisionId/figma/links */
export const createFigmaLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, '請輸入 Figma 連結')
    .refine(isFigmaUrl, '請輸入 https://www.figma.com/ 開頭的連結'),
  label: z
    .string()
    .trim()
    .max(LINK_LABEL_MAX_LENGTH, `名稱最多 ${LINK_LABEL_MAX_LENGTH} 個字元`)
    .default(''),
})
export type CreateFigmaLinkInput = z.input<typeof createFigmaLinkSchema>
