import { NavLink, Outlet, useMatch, useNavigate } from 'react-router'
import { useCurrentUser, useLogout } from '../features/auth/hooks.ts'

export function AppLayout() {
  const user = useCurrentUser()
  const logoutMutation = useLogout()
  const navigate = useNavigate()
  const inTopic = useMatch('/topics/*') !== null

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSettled: () => navigate('/login', { replace: true }),
    })
  }

  return (
    <div className="app">
      <header className="app-header">
        <NavLink to="/" className="brand">
          需求開發工廠
        </NavLink>
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive || inTopic ? 'active' : undefined)}>
            主題
          </NavLink>
          {user.role === 'admin' && <NavLink to="/admin/users">使用者管理</NavLink>}
        </nav>
        <div className="app-user">
          <NavLink to="/settings" title="個人設定">
            {user.name}
          </NavLink>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            登出
          </button>
        </div>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
