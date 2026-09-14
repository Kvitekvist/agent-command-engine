import React, { useEffect, useState, useRef } from 'react'

function formatMem(kb) {
  if (kb == null) return '—'
  if (kb < 1024) return `${kb} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

export default function ProcessesView() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const timer = useRef(null)

  function refresh() {
    window.ace.getProcesses().then(data => { setData(data); setError('') }).catch(error => setError(error.message))
  }

  useEffect(() => {
    refresh()
    timer.current = setInterval(refresh, 3000)
    return () => clearInterval(timer.current)
  }, [])

  if (!data) return <div className="p-6 text-muted text-sm">{error || 'Loading...'}{error && <button onClick={refresh}>Retry</button>}</div>

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {error && <p role="alert" className="text-danger">{error}. Displayed data is stale. <button onClick={refresh}>Retry</button></p>}
      <h2 className="text-lg font-semibold text-gray-100">Processes</h2>

      {/* ACE internal */}
      <section>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">ACE Internal</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-muted border-b border-border">
              <th className="py-1.5 pr-4">Process</th>
              <th className="py-1.5 pr-4 text-right">PID</th>
              <th className="py-1.5 pr-4 text-right">Memory</th>
              <th className="py-1.5 text-right">CPU %</th>
            </tr>
          </thead>
          <tbody>
            {data.internal.map((p) => (
              <tr key={p.pid} className="border-b border-border/50">
                <td className="py-1.5 pr-4 text-gray-200">{p.label}</td>
                <td className="py-1.5 pr-4 text-right text-muted tabular-nums">{p.pid}</td>
                <td className="py-1.5 pr-4 text-right text-muted tabular-nums">{formatMem(p.memoryKB)}</td>
                <td className="py-1.5 text-right text-muted tabular-nums">{p.cpu}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Agent processes */}
      <section>
        <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Agent Processes</h3>
        {data.agents.length === 0 ? (
          <div className="text-sm text-muted">No agents running.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted border-b border-border">
                <th className="py-1.5 pr-4">Agent</th>
                <th className="py-1.5 pr-4">Model</th>
                <th className="py-1.5 pr-4 text-right">PID</th>
              </tr>
            </thead>
            <tbody>
              {data.agents.map((a) => (
                <tr key={a.pid || a.label} className="border-b border-border/50">
                  <td className="py-1.5 pr-4 text-gray-200">{a.label}</td>
                  <td className="py-1.5 pr-4 text-muted">{a.model}</td>
                  <td className="py-1.5 pr-4 text-right text-muted tabular-nums">{a.pid ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
