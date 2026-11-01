import type {
  CreateFigmaLinkInput,
  FigmaLinkResponse,
  FigmaScreenResponse,
  RenameFigmaScreenInput,
  RevisionDetailResponse,
  RevisionResponse,
} from '../../contracts/index.ts'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { api, apiBlob } from '../../lib/api.ts'
import { queryClient } from '../../lib/queryClient.ts'
import { topicDetailKey, topicsQueryKey } from './api.ts'

export const revisionDetailKey = (revisionId: string) => ['revisions', revisionId] as const
const fileKey = (fileId: string) => ['files', fileId] as const

/** 版本內容有變：重新取得版本詳情，並更新主題頁與列表的最後更新時間、狀態 */
function invalidateRevision(queryClient: QueryClient, topicId: string, revisionId: string) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: revisionDetailKey(revisionId) }),
    queryClient.invalidateQueries({ queryKey: topicDetailKey(topicId) }),
    queryClient.invalidateQueries({ queryKey: [...topicsQueryKey, 'list'] }),
  ])
}

export function useRevision(revisionId: string) {
  return useQuery({
    queryKey: revisionDetailKey(revisionId),
    queryFn: async () => (await api<RevisionDetailResponse>(`/revisions/${revisionId}`)).revision,
  })
}

function srsForm(file: File | null) {
  const form = new FormData()
  if (file) form.append('file', file)
  return form
}

/**
 * F2-1、F7-1：建立新版本。file 為 null 時沿用上一版的 SRS；
 * 上一版的 Figma 截圖與連結由後端自動複製
 */
export function useCreateRevision(topicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File | null) =>
      (await api<RevisionDetailResponse>(`/topics/${topicId}/revisions`, { method: 'POST', body: srsForm(file) }))
        .revision,
    onSuccess: (revision) => {
      queryClient.setQueryData(revisionDetailKey(revision.id), revision)
      return invalidateRevision(queryClient, topicId, revision.id)
    },
  })
}

/** 草稿階段更換 SRS，覆蓋目前版本 */
export function useReplaceSrs(topicId: string, revisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (file: File) =>
      (await api<RevisionDetailResponse>(`/revisions/${revisionId}/srs`, { method: 'PUT', body: srsForm(file) }))
        .revision,
    onSuccess: (revision) => {
      queryClient.setQueryData(revisionDetailKey(revision.id), revision)
      return invalidateRevision(queryClient, topicId, revision.id)
    },
  })
}

/** F2-2：一次上傳一張截圖；多張由呼叫端依序上傳，完成後再呼叫 refresh */
export function useUploadScreen(revisionId: string) {
  return useMutation({
    mutationFn: async ({ file, name }: { file: File; name: string }) => {
      const form = new FormData()
      form.append('file', file)
      form.append('name', name)
      return (await api<FigmaScreenResponse>(`/revisions/${revisionId}/figma/screens`, { method: 'POST', body: form }))
        .screen
    },
  })
}

export function useRefreshRevision(topicId: string, revisionId: string) {
  const queryClient = useQueryClient()
  return () => invalidateRevision(queryClient, topicId, revisionId)
}

export function useRenameScreen(topicId: string, revisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ screenId, ...input }: RenameFigmaScreenInput & { screenId: string }) =>
      (
        await api<FigmaScreenResponse>(`/revisions/${revisionId}/figma/screens/${screenId}`, {
          method: 'PATCH',
          body: input,
        })
      ).screen,
    onSuccess: () => invalidateRevision(queryClient, topicId, revisionId),
  })
}

export function useDeleteScreen(topicId: string, revisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (screenId: string) =>
      api<void>(`/revisions/${revisionId}/figma/screens/${screenId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateRevision(queryClient, topicId, revisionId),
  })
}

/** F2-3 */
export function useAddLink(topicId: string, revisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateFigmaLinkInput) =>
      (await api<FigmaLinkResponse>(`/revisions/${revisionId}/figma/links`, { method: 'POST', body: input })).link,
    onSuccess: () => invalidateRevision(queryClient, topicId, revisionId),
  })
}

export function useDeleteLink(topicId: string, revisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (linkId: string) => api<void>(`/revisions/${revisionId}/figma/links/${linkId}`, { method: 'DELETE' }),
    onSuccess: () => invalidateRevision(queryClient, topicId, revisionId),
  })
}

/** F3-1：開始審查（草稿或審查失敗時） */
export function useStartReview(topicId: string, revisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      (await api<RevisionResponse>(`/revisions/${revisionId}/review`, { method: 'POST' })).revision,
    onSuccess: () => invalidateRevision(queryClient, topicId, revisionId),
  })
}

interface LoadedFile {
  blob: Blob
  /** object URL，供 iframe / img 使用；快取移除時釋放 */
  url: string
}

/** 檔案內容不會變（更換 SRS 會產生新的 fileId），快取不過期 */
function fileQuery(fileId: string) {
  return {
    queryKey: fileKey(fileId),
    queryFn: async (): Promise<LoadedFile> => {
      const blob = await apiBlob(`/files/${fileId}`)
      return { blob, url: URL.createObjectURL(blob) }
    },
    staleTime: Infinity,
  }
}

// 檔案快取被移除（閒置超過 gcTime、登出清空快取）時釋放 object URL
queryClient.getQueryCache().subscribe((event) => {
  if (event.type !== 'removed' || event.query.queryKey[0] !== 'files') return
  const data = event.query.state.data as LoadedFile | undefined
  if (data) URL.revokeObjectURL(data.url)
})

/** F2-4：取得檔案的 object URL 供 iframe / img 預覽 */
export function useFileUrl(fileId: string) {
  const file = useQuery(fileQuery(fileId))
  return { url: file.data?.url ?? null, error: file.error }
}

/** 下載檔案（沿用預覽時的快取） */
export function useDownloadFile() {
  const client = useQueryClient()
  return async (fileId: string, fileName: string) => {
    const { url } = await client.fetchQuery(fileQuery(fileId))
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    a.click()
  }
}
