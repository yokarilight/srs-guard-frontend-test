import type {
  CreateTopicInput,
  GenerateDocumentsInput,
  RevisionResponse,
  TopicResponse,
  TopicScope,
  TopicsResponse,
  UpdateTopicInput,
} from '../../contracts/index.ts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api.ts'

export const topicsQueryKey = ['topics'] as const
const topicListKey = (scope: TopicScope) => [...topicsQueryKey, 'list', scope] as const
export const topicDetailKey = (topicId: string) => [...topicsQueryKey, 'detail', topicId] as const

export function useTopics(scope: TopicScope) {
  return useQuery({
    queryKey: topicListKey(scope),
    queryFn: async () => (await api<TopicsResponse>(`/topics?scope=${scope}`)).topics,
  })
}

/** 背景任務進行中時輪詢狀態（之後改為 SSE） */
const POLL_INTERVAL_MS = 2000

export function useTopic(topicId: string) {
  return useQuery({
    queryKey: topicDetailKey(topicId),
    queryFn: async () => (await api<TopicResponse>(`/topics/${topicId}`)).topic,
    refetchInterval: (query) => {
      const status = query.state.data?.currentRevision?.status
      return status === 'reviewing' || status === 'generating' ? POLL_INTERVAL_MS : false
    },
  })
}

export function useCreateTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateTopicInput) =>
      (await api<TopicResponse>('/topics', { method: 'POST', body: input })).topic,
    onSuccess: (topic) => {
      queryClient.setQueryData(topicDetailKey(topic.id), topic)
      return queryClient.invalidateQueries({ queryKey: [...topicsQueryKey, 'list'] })
    },
  })
}

export function useUpdateTopic(topicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateTopicInput) =>
      (await api<TopicResponse>(`/topics/${topicId}`, { method: 'PATCH', body: input })).topic,
    onSuccess: (topic) => {
      queryClient.setQueryData(topicDetailKey(topic.id), topic)
      return queryClient.invalidateQueries({ queryKey: [...topicsQueryKey, 'list'] })
    },
  })
}

export function useDeleteTopic(topicId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api<void>(`/topics/${topicId}`, { method: 'DELETE' }),
    // 主題詳情的快取由呼叫端在離開主題頁後移除，避免頁面重新抓取已刪除的主題
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...topicsQueryKey, 'list'] }),
  })
}


/** F5-3：勾選角色並開始產生文件 */
export function useGenerateDocuments(topicId: string, revisionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: GenerateDocumentsInput) =>
      (await api<RevisionResponse>(`/revisions/${revisionId}/generate`, { method: 'POST', body: input })).revision,
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: topicDetailKey(topicId) }),
        queryClient.invalidateQueries({ queryKey: [...topicsQueryKey, 'list'] }),
      ]),
  })
}
