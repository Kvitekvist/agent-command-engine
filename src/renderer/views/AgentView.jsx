import React, { useState, useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import ModelSelector from '../components/ModelSelector'
import AgentTerminal from '../components/AgentTerminal'
import UsageBar from '../components/UsageBar'
import { generateAgentName } from '../utils/agentNames'

const CLAUDE_MODELS = ['claude-haiku-4-5-20251001','claude-sonnet-4-5','claude-sonnet-5','claude-opus-4-8','claude-fable-5']
// `codex-mini-latest`/`o3`/`o4-mini` are raw OpenAI-platform (API-key) model
// slugs -- Codex CLI rejects all three with "not supported when using Codex
// with a ChatGPT account" for a ChatGPT-subscription login (TICKET-0026).
// These are the ChatGPT-account-compatible slugs instead, cross-checked
// against this machine's own `~/.codex/models_cache.json` (fetched
// 2026-08-09, codex-cli 0.147.0) -- like CLAUDE_MODELS above, expect these
// to go stale as Codex ships new models and need a manual refresh.
const CODEX_MODELS  = ['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5.6-luna']
// TICKET-0039: the Safe/Guarded/Auto selector was removed from the launch
// bar now that auto-answer permission prompts (see AgentTerminal.jsx) works
// live -- Safe's restrictive allowedTools plus a working auto-approve
// covers the same ground without asking the user to pick a tier upfront.
// Fixed at 'safe' rather than 'auto' (--dangerously-skip-permissions)
// deliberately: that would bypass the CLI's own permission system entirely
// instead of relying on this app auto-confirming it.
const PERMISSION_MODE = 'safe'

export default function AgentView() {
  const { activeProject, agents, removeAgent } = useStore()
  const [label, setLabel]         = useState(() => generateAgentName())
  const [provider, setProvider]   = useState('claude')
  const [model, setModel]         = useState('claude-sonnet-5')
  const [launching, setLaunching] = useState(false)

  // `agents` (the store) holds every agent across every project visited
  // this session, not just the active one -- see the render below and
  // useStore.js's setActiveProject (TICKET-0030). Scope UI that should
  // only reflect the active project (the empty state, default label
  // uniqueness) to just its own agents.
  const projectAgents = agents.filter((a) => a.projectId === activeProject?.id)

  async function launchAgent() {
    if (!activeProject) return
    setLaunching(true)
    try {
      await window.cpi.startAgent({ projectId: activeProject.id, projectPath: activeProject.path, label, provider, model, permissionMode: PERMISSION_MODE })
      const existingLabels = useStore.getState().agents
        .filter((a) => a.projectId === activeProject.id)
        .map((a) => a.label)
      setLabel(generateAgentName(existingLabels))
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

  // Restore agent cards the first time a project is selected this session
  // — e.g. right after the app opens, or the first switch to a project not
  // visited yet. Every persisted agent is restored here, running or
  // stopped — a stopped agent still needs its card back so its Delete
  // button shows up. A restored 'running' agent gets a brand-new terminal
  // session (AgentTerminal always starts fresh on mount) since there's no
  // live PTY process to reconnect to yet — see AgentTerminal.jsx.
  //
  // This effect reruns on every activeProject change, including switching
  // back to a project already visited this session — but `agents` (Zustand
  // store state, not component state, and no longer cleared on project
  // switch as of TICKET-0030) still holds whatever this effect already
  // added for it. Skip rows already present in the store, or every return
  // trip would append a duplicate card — and for a 'running' row, mount a
  // second AgentTerminal that spawns a second real PTY/CLI process for the
  // same agent (TICKET-0024). This same guard is what makes a revisited
  // project's already-running agents keep their live session instead of
  // restoring a fresh one (TICKET-0030) — their card was never unmounted,
  // only hidden, so this effect finds them already in the store and skips.
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
        // TICKET-0070: carry forward whether this agent's label was already
        // auto-titled -- a restored agent gets a brand-new terminal session
        // (see the effect comment above), so without this its next typed
        // line would look like a fresh "initial request" and clobber a real
        // title that was already set in a previous session.
        useStore.getState().addAgent({ ...meta, agentId: row.id, status: row.status, titleSet: !!row.title_set })
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
        <button onClick={launchAgent} disabled={launching} className="btn-primary ml-auto text-xs">
          {launching ? 'Launching…' : '+ New Agent'}
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {projectAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-sm">No agents running. Launch one above.</div>
          </div>
        )}
        {/* TICKET-0030: every agent across every project visited this
            session stays mounted here, not just the active project's --
            each running agent owns a real PTY-backed terminal
            (AgentTerminal.jsx) that must keep running while its project
            isn't active. Cards for other projects are hidden with CSS
            instead of being unmounted, mirroring App.jsx's tab-level
            hide-not-unmount pattern (TICKET-0027). A project switch no
            longer tears any session down -- only Stop/Delete/app quit do. */}
        <div className={'grid grid-cols-1 xl:grid-cols-2 gap-4' + (projectAgents.length === 0 ? ' hidden' : '')}>
          {agents.map((agent) => (
            <div key={agent.agentId} className={agent.projectId === activeProject.id ? '' : 'hidden'}>
              <AgentPane agent={agent}
                onStop={() => stopAgent(agent.agentId)}
                onDelete={() => deleteAgent(agent.agentId)} />
            </div>
          ))}
        </div>
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
  const [screenshotMsg, setScreenshotMsg] = useState(null)
  const screenshotMsgTimer = useRef(null)

  function handleDelete() {
    if (window.confirm(`Delete "${agent.label}"? This removes it from the interface.`)) onDelete()
  }

  const [capturing, setCapturing] = useState(false)

  // TICKET-0034 (reworked from TICKET-0032's clipboard-paste model): hides
  // the app, lets the user drag-select a region of the primary display, and
  // saves it into this project's own .cpi/screenshots/ folder. Overwrites
  // the clipboard with the saved file's path (relative to the project
  // root, since that's the agent's own cwd) so the natural next step
  // (pasting into this card's terminal to reference it in a prompt) yields
  // the path instead of nothing.
  async function captureScreenshot() {
    setCapturing(true)
    try {
      const result = await window.cpi.screenshots.captureRegion(agent.projectPath)
      if (result.ok) {
        setScreenshotMsg(`Saved ${result.filename} — path copied, paste into the terminal`)
      } else if (result.reason === 'cancelled') {
        setScreenshotMsg('Screenshot cancelled')
      } else {
        setScreenshotMsg(`Failed to save screenshot: ${result.error || 'unknown error'}`)
      }
    } finally {
      setCapturing(false)
    }
    clearTimeout(screenshotMsgTimer.current)
    screenshotMsgTimer.current = setTimeout(() => setScreenshotMsg(null), 4000)
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
          {agent.status === 'running' && (
            <button onClick={captureScreenshot} disabled={capturing}
              title="Drag-select a screen region to save into this project's .cpi/screenshots/ folder"
              className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors disabled:opacity-50">
              {capturing ? '…' : '📸'}
            </button>
          )}
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

      {screenshotMsg && (
        <div className="text-xs text-muted mb-1.5 shrink-0 truncate select-none" title="Not the path itself -- selecting/copying this line overwrites the clipboard the button just set">{screenshotMsg}</div>
      )}

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
