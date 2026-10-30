import { QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { handleSessionExpired } from './features/auth/session.ts'
import './index.css'
import { setUnauthorizedHandler } from './lib/api.ts'
import { queryClient } from './lib/queryClient.ts'
import { router } from './router.tsx'

// 任何已登入的 API 回 401：清掉快取，RequireAuth 會導向登入頁並提示逾時
setUnauthorizedHandler(() => handleSessionExpired(queryClient))

async function enableMocking() {
  if (import.meta.env.MODE !== 'mock') return
  const { worker } = await import('./mocks/browser.ts')
  await worker.start({ onUnhandledFrame: 'bypass' })
}

await enableMocking()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
