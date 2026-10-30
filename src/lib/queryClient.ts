import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './api.ts'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status < 500) && failureCount < 2,
    },
  },
})
