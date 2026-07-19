import React, { useEffect, useState } from 'react'
import useStore from '../store/useStore'

export default function AuditView() {
  const { activeProject, auditPrompts, setAuditPrompts } = useStore()
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(null)
  const [loading, setLoading]   = useState(false)

  async function load() {
    setLoading(true)
    const filters = activeProject ? { projectId: activeProject.id, limit: 200 } : { limit: 200 }
    const rows = await window.cpi.getPrompts(filters)
    setAuditPrompts(rows)
    setLoading(false)
  }

  useEffect(() => { load() }, [activeProject])

  const filtered = auditPrompts.filter((p) => {
    const q = search.toLowerCase()
    return (
      !q ||
      p.prompt_text?.toLowerCase().includes(q) ||
      p.response_text?.toLowerCase().includes(q) ||
      p.model?.toLowerCase().includes(q) ||
      p.task_label?.toLowerCase().includes(q)
    )
  })

  return (
    <div className="flex h-full">
      {/* List panel */}
      <div className="w-1/2 flex flex-col border-r border-border">
        <div className="px-4 py-3 border-b border-border flex items-center gap-3 shrink-0">
          <h2 className="text-sm font-semibold">Audit Log</h2>
          <input
            className="input text-xs flex-1"
            placeholder="Search prompts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button onClick={load} className="btn-ghost text-xs">↻</button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {loading && <div className="p-4 text-xs text-muted">Loading…</div>}
          {!loading && filtered.length === 0 && (
            <div className="p-4 text-xs text-muted">No entries found.</div>
          )}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p)}
              className={`w-full text-left px-4 py-3 hover:bg-border/50 transition-colors
                ${selected?.id === p.id ? 'bg-accent/10 border-l-2 border-accent' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`badge ${p.provider === 'codex' ? 'badge-green' : 'badge-purple'}`}>
                  {p.provider || 'claude'}
                </span>
                <span className="text-xs text-muted truncate">{p.model}</span>
                <span className="text-xs text-muted ml-auto">{fmtDate(p.created_at)}</span>
              </div>
              <div className="text-xs text-gray-300 truncate">{p.prompt_text}</div>
              <div className="text-xs text-muted mt-0.5">
                {p.input_tokens}↑ {p.output_tokens}↓ tokens
                {p.task_label && ` · ${p.task_label}`}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto p-5">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            Select an entry to view details.
          </div>
        ) : (
          <div className="space-y-4 max-w-2xl">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`badge ${selected.provider === 'codex' ? 'badge-green' : 'badge-purple'}`}>
                {selected.provider || 'claude'}
              </span>
              <span className="text-xs text-muted">{selected.model}</span>
              <span className="text-xs text-muted">{fmtDate(selected.created_at)}</span>
              {selected.task_label && (
                <span className="badge-yellow">{selected.task_label}</span>
              )}
            </div>

            <div className="flex gap-4 text-xs text-muted">
              <span>↑ {selected.input_tokens?.toLocaleString()} input tokens</span>
              <span>↓ {selected.output_tokens?.toLocaleString()} output tokens</span>
              {selected.duration_ms > 0 && <span>⏱ {(selected.duration_ms / 1000).toFixed(1)}s</span>}
            </div>

            <Section title="Prompt">
              <pre className="whitespace-pre-wrap text-xs text-gray-300 font-mono bg-surface rounded p-3 leading-relaxed">
                {selected.prompt_text || '—'}
              </pre>
            </Section>

            <Section title="Response">
              <pre className="whitespace-pre-wrap text-xs text-gray-300 font-mono bg-surface rounded p-3 leading-relaxed">
                {selected.response_text || '(streamed — see agent output)'}
              </pre>
            </Section>
          </div>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">{title}</div>
      {children}
    </div>
  )
}

function fmtDate(str) {
  if (!str) return ''
  try { return new Date(str).toLocaleString() } catch (_) { return str }
}
