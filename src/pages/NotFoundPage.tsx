import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <section className="page">
      <h1>找不到頁面</h1>
      <p>
        <Link to="/">回到主題列表</Link>
      </p>
    </section>
  )
}
