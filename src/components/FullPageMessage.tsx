import type { ReactNode } from 'react'

export function FullPageMessage({ children }: { children: ReactNode }) {
  return <main className="full-page-message">{children}</main>
}
