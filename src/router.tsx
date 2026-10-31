import { createBrowserRouter } from 'react-router'
import { AppLayout } from './components/AppLayout.tsx'
import { LoginPage } from './features/auth/LoginPage.tsx'
import { RequireAdmin } from './features/auth/RequireAdmin.tsx'
import { RequireAuth } from './features/auth/RequireAuth.tsx'
import { RolesPage } from './features/roles/RolesPage.tsx'
import { SettingsPage } from './features/settings/SettingsPage.tsx'
import { TopicPage } from './features/topics/TopicPage.tsx'
import { TopicsPage } from './features/topics/TopicsPage.tsx'
import { UsersPage } from './features/users/UsersPage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <TopicsPage /> },
          { path: 'topics/:topicId', element: <TopicPage /> },
          { path: 'roles', element: <RolesPage /> },
          { path: 'settings', element: <SettingsPage /> },
          {
            path: 'admin',
            element: <RequireAdmin />,
            children: [{ path: 'users', element: <UsersPage /> }],
          },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
])
