import React, { useState, useRef, useEffect } from 'react'
import useStore from '../store/useStore'
import ModelSelector from '../components/ModelSelector'

const CLAUDE_MODELS = ['claude-haiku-4-5-20251001','claude-sonnet-5','claude-opus-4-8','claude-fable-5']
const CODEX_MODELS  = ['codex-mini-latest', 'o3', 'o4-mini']
const PERMISSION_MODES = [
  { id: 'safe', label: '🔒 Safe',    title: 'Safe — file tools only (Read/Edit/Write/Glob/Grep). No shell access at all.' },
  { id: 'ask',  label: '🛡️ Guarded', title: 'Guarded — shell access allowed, but rm, sudo, and Remove-Item are blocked automatically. Claude CLI can\'t pause to ask a human when run headlessly, so this is a fixed policy, not a live prompt.' },
  { id: 'auto', label: '⚡ Auto',    title: 'Auto — dangerously-skip-permissions, all tools allowed, nothing blocked.' },
]

export default function AgentView() {
  const { activeProject, agents, agentOutputs, agentThinking, removeAgent, setAgentThinking } = useStore()
  const [label, setLabel]                   = useState('Agent 1')
  const [provider, setProvider]             = useState('claude')
  const [model, setModel]                   = useState('claude-sonnet-5')
  const [permissionMode, setPermissionMode] = useState('safe')
  const [launching, setLaunching]           = useState(false)

  async function launchAgent() {
    if (!activeProject) return
    setLaunching(true)
    try {
      await window.cpi.startAgent({ projectId: activeProject.id, projectPath: activeProject.path, label, provider, model, permissionMode })
      const num = parseInt(label.replace(/\D/g, '') || '1', 10)
      setLabel('Agent ' + (num + 1))
    } finally { setLaunching(false) }
  }

  // Backend emits an 'agent:status' event on stop that App.jsx uses to flip
  // this card to 'stopped' in place (keeping history + revealing Delete) —
  // don't also removeAgent() here, or the card vanishes instead of that.
  async function stopAgent(agentId) {
    await window.cpi.stopAgent(agentId)
  }

  async function deleteAgent(agentId) {
    await window.cpi.deleteAgent(agentId)
    removeAgent(agentId)
  }

  // Restore agents + replay their persisted history when a project is
  // (re)selected — e.g. after the app is closed and reopened. Only "Clear
  // Context" should ever wipe this history; switching projects must not.
  // Every persisted agent is restored here, running or stopped — a stopped
  // agent still needs its card back so its history and Delete button show up.
  useEffect(() => {
    if (!activeProject) return
    let cancelled = false
    ;(async () => {
      const rows = await window.cpi.getAgents(activeProject.id)
      for (const row of rows) {
        if (cancelled) return
        let meta
        if (row.status === 'running') {
          // Re-register with AgentService so it can accept new prompts.
          const restored = await window.cpi.restoreAgent({ ...row, projectPath: activeProject.path })
          if (cancelled) return
          meta = restored.meta
        } else {
          meta = {
            agentId: row.id,
            projectId: row.project_id,
            projectPath: activeProject.path,
            label: row.label,
            provider: row.provider,
            model: row.model,
            permissionMode: row.permission_mode,
          }
        }
        useStore.getState().addAgent({ ...meta, agentId: row.id, status: row.status })
        const prompts = await window.cpi.getPrompts({ agentId: row.id, limit: 500 })
        if (cancelled) return
        useStore.getState().restoreAgentThread(row.id, [...prompts].reverse())
      }
    })()
    return () => { cancelled = true }
  }, [activeProject?.id])

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <div className="text-4xl mb-3">📁</div>
        <div className="text-sm">Select a project from the sidebar to get started.</div>
      </div>
    )
  }

  const models = provider === 'claude' ? CLAUDE_MODELS : CODEX_MODELS

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-panel shrink-0 flex-wrap">
        <div className="text-sm font-semibold text-gray-100 mr-2 truncate max-w-xs">{activeProject.name}</div>
        <input className="input w-32 text-xs" placeholder="Agent label" value={label} onChange={(e) => setLabel(e.target.value)} />
        <div className="flex rounded overflow-hidden border border-border text-xs">
          {['claude','codex'].map((p) => (
            <button key={p} onClick={() => { setProvider(p); setModel(p === 'claude' ? CLAUDE_MODELS[1] : CODEX_MODELS[0]) }}
              className={'px-3 py-1.5 transition-colors ' + (provider === p ? 'bg-accent text-white' : 'text-muted hover:bg-border')}>
              {p === 'claude' ? '🟣 Claude' : '🟢 Codex'}
            </button>
          ))}
        </div>
        <ModelSelector models={models} value={model} onChange={setModel} />
        <div className="flex rounded overflow-hidden border border-border text-xs">
          {PERMISSION_MODES.map((m) => (
            <button key={m.id} title={m.title} onClick={() => setPermissionMode(m.id)}
              className={'px-3 py-1.5 transition-colors ' + (permissionMode === m.id ? 'bg-accent text-white' : 'text-muted hover:bg-border')}>
              {m.label}
            </button>
          ))}
        </div>
        <button onClick={launchAgent} disabled={launching} className="btn-primary ml-auto text-xs">
          {launching ? 'Launching…' : '+ New Agent'}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-sm">No agents running. Launch one above.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <AgentPane key={agent.agentId} agent={agent}
                output={agentOutputs[agent.agentId] || []}
                thinking={agentThinking[agent.agentId] || false}
                onStop={() => stopAgent(agent.agentId)}
                onDelete={() => deleteAgent(agent.agentId)}
                onSetThinking={(v) => setAgentThinking(agent.agentId, v)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Inline markdown renderer ──────────────────────────────────────────────────

function inlineFormat(text) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return React.createElement('strong', { key: i, className: 'text-gray-100 font-semibold' }, part.slice(2,-2))
    if (part.startsWith('`') && part.endsWith('`'))
      return React.createElement('code', { key: i, className: 'bg-black/40 text-green-300 px-1 rounded font-mono text-xs' }, part.slice(1,-1))
    return part
  })
}

function MarkdownText({ text }) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++ }
      elements.push(<pre key={'cb'+i} className="bg-black/40 rounded p-2 my-1 overflow-x-auto text-xs text-green-300 font-mono">{lang && <span className="text-muted text-xs block mb-1">{lang}</span>}{code.join('\n')}</pre>)
      i++; continue
    }
    const hm = line.match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      const cls = hm[1].length === 1 ? 'text-base font-bold text-gray-100 mt-2' : hm[1].length === 2 ? 'text-sm font-semibold text-gray-200 mt-2' : 'text-xs font-semibold text-gray-300 mt-1'
      elements.push(<div key={i} className={cls}>{hm[2]}</div>); i++; continue
    }
    const nm = line.match(/^(\d+)\.\s+(.+)/)
    if (nm) {
      elements.push(<div key={i} className="flex gap-2 text-xs text-gray-300 my-0.5"><span className="text-accent font-bold shrink-0">{nm[1]}.</span><span>{inlineFormat(nm[2])}</span></div>)
      i++; continue
    }
    const bm = line.match(/^[-*]\s+(.+)/)
    if (bm) {
      elements.push(<div key={i} className="flex gap-2 text-xs text-gray-300 my-0.5"><span className="text-muted shrink-0">•</span><span>{inlineFormat(bm[1])}</span></div>)
      i++; continue
    }
    if (!line.trim()) { elements.push(<div key={i} className="h-1" />); i++; continue }
    elements.push(<div key={i} className="text-xs text-gray-300 leading-relaxed">{inlineFormat(line)}</div>)
    i++
  }
  return React.createElement(React.Fragment, null, ...elements)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractQuestions(text) {
  const questions = []
  const matches = text.matchAll(/^\d+\.\s+\*\*(.+?)\*\*/gm)
  for (const m of matches) questions.push(m[1])
  return questions
}

// ── AgentPane ─────────────────────────────────────────────────────────────────

function AgentPane({ agent, output, thinking, onStop, onDelete, onSetThinking }) {
  const [prompt, setPrompt]   = useState('')
  const [clearing, setClearing] = useState(false)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)

  function handleDelete() {
    if (window.confirm(`Delete "${agent.label}"? This removes it from the interface.`)) onDelete()
  }

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [output])

  const lastAgentMsg = [...(output || [])].reverse().find((m) => m.role === 'agent' && m.done)
  const quickReplies = lastAgentMsg ? extractQuestions(lastAgentMsg.content) : []

  async function send(text) {
    const trimmed = (text || prompt).trim()
    if (!trimmed || thinking) return
    onSetThinking(true)
    useStore.getState().addUserMessage(agent.agentId, trimmed)
    useStore.getState().startAgentMessage(agent.agentId)
    await window.cpi.sendPrompt(agent.agentId, trimmed)
    setPrompt('')
    inputRef.current?.focus()
  }

  function onSubmit(e) { e.preventDefault(); send() }

  async function clearContext() {
    if (clearing || thinking) return
    setClearing(true)
    try {
      await window.cpi.clearContext(agent.agentId)
      useStore.getState().clearAgentThread(agent.agentId)
    } finally { setClearing(false) }
  }

  const permIcon    = ({ safe: '🔒', ask: '🛡️', auto: '⚡' })[agent.permissionMode] || '🔒'
  const statusBadge = agent.status === 'running'
    ? <span className="badge-green">● Running</span>
    : <span className="badge-gray">○ Stopped</span>

  return (
    <div className="card flex flex-col" style={{ height: '28rem' }}>
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          {statusBadge}
          <span className="text-sm font-medium text-gray-200">{agent.label}</span>
          <span className="text-xs text-muted">{agent.model}</span>
          <span className="text-xs" title={'Permission: ' + agent.permissionMode}>{permIcon}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={clearContext} disabled={clearing || thinking} title="Start a fresh conversation — forgets everything said so far"
            className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border/30 transition-colors disabled:opacity-50">
            {clearing ? '…' : '🧹 Clear Context'}
          </button>
          {agent.status === 'running' ? (
            <button onClick={onStop} className="btn-danger text-xs py-0.5">Stop</button>
          ) : (
            <button onClick={handleDelete} title="Remove this agent from the interface"
              className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/40 transition-colors">
              🗑️ Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {(!output || output.length === 0) && (
          <div className="text-center text-muted text-xs pt-8">Type a prompt below to start.</div>
        )}
        {(output || []).map((item, i) => {
          return (
            <div key={i} className={'flex ' + (item.role === 'user' ? 'justify-end' : 'justify-start')}>
              {item.role === 'user' ? (
                <div className="bg-accent/20 border border-accent/30 rounded-lg px-3 py-2 max-w-[85%] text-xs text-gray-200">{item.content}</div>
              ) : (
                <div className="bg-panel border border-border rounded-lg px-3 py-2 max-w-[95%] w-full">
                  <MarkdownText text={item.content} />
                  {!item.done && <span className="inline-block w-1.5 h-3 bg-accent ml-0.5 animate-pulse align-middle" />}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {quickReplies.length > 0 && !thinking && agent.status === 'running' && (
        <div className="flex flex-wrap gap-1.5 mt-2 shrink-0">
          {quickReplies.map((q, i) => (
            <button key={i} onClick={() => send((i+1) + '. Yes')} className="text-xs px-2 py-1 rounded border border-accent/50 text-accent hover:bg-accent/10 transition-colors">{i+1}. Yes</button>
          ))}
          {quickReplies.map((q, i) => (
            <button key={'no'+i} onClick={() => send((i+1) + '. No')} className="text-xs px-2 py-1 rounded border border-border text-muted hover:bg-border/30 transition-colors">{i+1}. No</button>
          ))}
        </div>
      )}

      {agent.status === 'running' && (
        <form onSubmit={onSubmit} className="flex gap-2 mt-2 shrink-0">
          <input ref={inputRef} className="input text-xs flex-1"
            placeholder={thinking ? 'Waiting for response…' : 'Send a prompt…'}
            value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={thinking} />
          <button type="submit" disabled={thinking} className="btn-primary text-xs px-3">
            {thinking ? '…' : 'Send'}
          </button>
        </form>
      )}

      {agent.tokenSummary && (
        <div className="text-xs text-muted mt-1">
          Tokens — in: {agent.tokenSummary.input.toLocaleString()} / out: {agent.tokenSummary.output.toLocaleString()}
        </div>
      )}
    </div>
  )
}
