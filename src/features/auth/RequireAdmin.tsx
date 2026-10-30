import { Link, Outlet } from 'react-router'
import { useCurrentUser } from './hooks.ts'

export function RequireAdmin() {
  const user = useCurrentUser()
  if (user.role !== 'admin') {
    return (
      <section className="page">
        <h1>權限不足</h1>
        <p className="muted">此頁面僅限管理者使用。</p>
        <p>
          <Link to="/">回到主題列表</Link>
        </p>
      </section>
    )
  }
  return <Outlet />
}
