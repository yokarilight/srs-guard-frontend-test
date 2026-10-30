import { Navigate, Outlet, useLocation } from 'react-router'
import { FullPageMessage } from '../../components/FullPageMessage.tsx'
import { useMe } from './hooks.ts'
import { isSessionExpired } from './session.ts'

/** F8-3：未登入時導向登入頁，登入後回到原本的頁面 */
export function RequireAuth() {
  const { data: user, isPending, isError, refetch } = useMe()
  const location = useLocation()

  if (isPending) return <FullPageMessage>載入中…</FullPageMessage>
  if (isError) {
    return (
      <FullPageMessage>
        無法連線到伺服器。
        <button type="button" className="btn" onClick={() => refetch()}>
          重試
        </button>
      </FullPageMessage>
    )
  }
  if (!user) {
    const params = new URLSearchParams()
    const from = location.pathname + location.search
    if (from !== '/') params.set('redirect', from)
    if (isSessionExpired()) params.set('expired', '1')
    const query = params.toString()
    return <Navigate to={`/login${query ? `?${query}` : ''}`} replace />
  }
  return <Outlet />
}
