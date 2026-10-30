import type {
  CreateTopicInput,
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

export function useTopic(topicId: string) {
  return useQuery({
    queryKey: topicDetailKey(topicId),
    queryFn: async () => (await api<TopicResponse>(`/topics/${topicId}`)).topic,
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

