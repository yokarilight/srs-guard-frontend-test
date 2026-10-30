import type { TopicScope } from '../../contracts/index.ts'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { dateTimeFormat } from '../../lib/format.ts'
import { useTopics } from './api.ts'
import { statusBadge } from './status.ts'
import { TopicFormDialog } from './TopicFormDialog.tsx'

const scopeTabs: { scope: TopicScope; label: string }[] = [
  { scope: 'all', label: '全部主題' },
  { scope: 'mine', label: '我的主題' },
]

/** F1-1、F1-2：主題列表與建立主題 */
export function TopicsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const scope: TopicScope = searchParams.get('scope') === 'mine' ? 'mine' : 'all'
  const topics = useTopics(scope)
  const [creating, setCreating] = useState(false)

  function changeScope(next: TopicScope) {
    setSearchParams(next === 'all' ? {} : { scope: next }, { replace: true })
  }

  return (
    <section className="page">
      <div className="page-header">
        <h1>主題列表</h1>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          建立主題
        </button>
      </div>

      <div className="segmented" role="group" aria-label="篩選主題">
        {scopeTabs.map((tab) => (
          <button
            key={tab.scope}
            type="button"
            aria-pressed={scope === tab.scope}
            onClick={() => changeScope(tab.scope)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {topics.isPending ? (
        <p className="muted">載入中…</p>
      ) : topics.isError ? (
        <p className="alert alert-error">無法載入主題列表：{topics.error.message}</p>
      ) : topics.data.length === 0 ? (
        <div className="empty-state">
          <p>{scope === 'mine' ? '你還沒有建立任何主題。' : '目前還沒有任何主題。'}</p>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            建立第一個主題
          </button>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>名稱</th>
                <th>建立者</th>
                <th>狀態</th>
                <th>SRS 版本</th>
                <th>最後更新</th>
              </tr>
            </thead>
            <tbody>
              {topics.data.map((topic) => {
                const badge = statusBadge(topic.currentRevision)
                return (
                  <tr key={topic.id}>
                    <td className="cell-title">
                      <Link to={`/topics/${topic.id}`}>{topic.name}</Link>
                    </td>
                    <td>{topic.owner.name}</td>
                    <td>
                      <span className={`badge ${badge.className}`}>{badge.label}</span>
                    </td>
                    <td>{topic.currentRevision ? `v${topic.currentRevision.version}` : '—'}</td>
                    <td>{dateTimeFormat.format(new Date(topic.updatedAt))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <TopicFormDialog open={creating} onClose={() => setCreating(false)} />
    </section>
  )
}
