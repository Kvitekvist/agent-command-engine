import React, { useState, useEffect } from 'react'
import useStore from '../store/useStore'
import ModelSelector from '../components/ModelSelector'
import AgentTerminal from '../components/AgentTerminal'
import UsageBar from '../components/UsageBar'
import { generateAgentName } from '../utils/agentNames'

const CLAUDE_MODELS = ['claude-haiku-4-5-20251001','claude-sonnet-5','claude-opus-4-8','claude-fable-5']
const CODEX_MODELS  = ['codex-mini-latest', 'o3', 'o4-mini']
const PERMISSION_MODES = [
  { id: 'safe', label: '🔒 Safe',    title: 'Safe — file tools only (Read/Edit/Write/Glob/Grep). No shell access at all.' },
  { id: 'ask',  label: '🛡️ Guarded', title: 'Guarded — shell access allowed, but rm, sudo, and Remove-Item are blocked automatically. Claude CLI can\'t pause to ask a human when run headlessly, so this is a fixed policy, not a live prompt.' },
  { id: 'auto', label: '⚡ Auto',    title: 'Auto — dangerously-skip-permissions, all tools allowed, nothing blocked.' },
]

export default function AgentView() {
  const { activeProject, agents, removeAgent } = useStore()
  const [label, setLabel]                   = useState(() => generateAgentName())
  const [provider, setProvider]             = useState('claude')
  const [model, setModel]                   = useState('claude-sonnet-5')
  const [permissionMode, setPermissionMode] = useState('safe')
  const [launching, setLaunching]           = useState(false)

  async function launchAgent() {
    if (!activeProject) return
    setLaunching(true)
    try {
      await window.cpi.startAgent({ projectId: activeProject.id, projectPath: activeProject.path, label, provider, model, permissionMode })
      setLabel(generateAgentName(useStore.getState().agents.map((a) => a.label)))
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

  // Restore agent cards when a project is (re)selected — e.g. after the app
  // is closed and reopened, or after switching away and back. Every
  // persisted agent is restored here, running or stopped — a stopped agent
  // still needs its card back so its Delete button shows up. A restored
  // 'running' agent gets a brand-new terminal session (AgentTerminal always
  // starts fresh on mount); its previous interactive session does not
  // survive the switch — see AgentTerminal.jsx.
  //
  // This effect reruns on every AgentView mount, not just a real project
  // switch — App.jsx renders AgentView conditionally, so leaving and
  // returning to the Agents tab remounts it while `agents` (Zustand store
  // state, not component state) still holds whatever this effect already
  // added. Skip rows already present in the store, or every return trip
  // to the tab would append a duplicate card — and for a 'running' row,
  // mount a second AgentTerminal that spawns a second real PTY/CLI process
  // for the same agent (TICKET-0024).
  useEffect(() => {
    if (!activeProject) return
    let cancelled = false
    ;(async () => {
      const rows = await window.cpi.getAgents(activeProject.id)
      for (const row of rows) {
        if (cancelled) return
        if (useStore.getState().agents.some((a) => a.agentId === row.id)) continue
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
      }
    })()
    return () => { cancelled = true }
  }, [activeProject?.id])

  if (!activeProject) {
    return (
      <div className="flex flex-col h-full">
        <UsageBar />
        <div className="flex-1 flex flex-col items-center justify-center text-muted">
          <div className="text-4xl mb-3">📁</div>
          <div className="text-sm">Select a project from the sidebar to get started.</div>
        </div>
      </div>
    )
  }

  const models = provider === 'claude' ? CLAUDE_MODELS : CODEX_MODELS

  return (
    <div className="flex flex-col h-full">
      <UsageBar />
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
                onStop={() => stopAgent(agent.agentId)}
                onDelete={() => deleteAgent(agent.agentId)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── AgentPane ─────────────────────────────────────────────────────────────────
// Each running agent's card embeds a real interactive terminal (see
// AgentTerminal.jsx) running the actual `claude`/`codex` CLI, rather than a
// headless chat thread -- the terminal itself takes keystrokes when
// focused, so there's no separate prompt input/quick-reply/clear-context UI
// here anymore; Claude Code's own interactive UI (visible inside the
// terminal) handles all of that.

function AgentPane({ agent, onStop, onDelete }) {
  function handleDelete() {
    if (window.confirm(`Delete "${agent.label}"? This removes it from the interface.`)) onDelete()
  }

  const permIcon    = ({ safe: '🔒', ask: '🛡️', auto: '⚡' })[agent.permissionMode] || '🔒'
  const statusBadge = agent.status === 'running'
    ? <span className="badge-green">● Running</span>
    : <span className="badge-gray">○ Stopped</span>

  return (
    <div className="card flex flex-col" style={{ height: '32rem' }}>
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          {statusBadge}
          <span className="text-sm font-medium text-gray-200">{agent.label}</span>
          <span className="text-xs text-muted">{agent.model}</span>
          <span className="text-xs" title={'Permission: ' + agent.permissionMode}>{permIcon}</span>
        </div>
        <div className="flex items-center gap-1.5">
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

      {agent.status === 'running' ? (
        <AgentTerminal agent={agent} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted text-xs">
          Stopped — Delete to remove, or launch a new agent above.
        </div>
      )}
    </div>
  )
}
