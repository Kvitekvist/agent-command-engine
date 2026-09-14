import React, { useState, useEffect, useRef } from 'react'
import useStore from '../store/useStore'
import ModelSelector from '../components/ModelSelector'
import AgentTerminal from '../components/AgentTerminal'
import UsageBar from '../components/UsageBar'
import ProjectSkillsPanel from '../components/ProjectSkillsPanel'
import { runOperation } from '../utils/runOperation'
import OperationFeedback from '../components/OperationFeedback'
import { generateAgentName } from '../utils/agentNames'
import {
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_GROUPS_BY_PROVIDER,
  getAllModelIds,
  filterGroupsByEnabled,
} from '../utils/modelCatalog'

// TICKET-0039: the Safe/Guarded/Auto selector was removed from the launch
// bar now that auto-answer permission prompts (see AgentTerminal.jsx) works
// live -- Safe's restrictive allowedTools plus a working auto-approve
// covers the same ground without asking the user to pick a tier upfront.
// Fixed at 'safe' rather than 'auto' (--dangerously-skip-permissions)
// deliberately: that would bypass the CLI's own permission system entirely
// instead of relying on this app auto-confirming it.
const PERMISSION_MODE = 'safe'

export default function AgentView() {
  const { activeProject, agents, removeAgent, soundsMuted, loadSoundsMuted, toggleSoundsMuted } = useStore()
  const [label, setLabel]         = useState(() => generateAgentName())
  const [provider, setProvider]   = useState('claude')
  const [model, setModel]         = useState(DEFAULT_MODEL_BY_PROVIDER.claude)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState(null)
  const [showSkills, setShowSkills] = useState(false)
  const [buildCapability, setBuildCapability] = useState(null)
  const [projectOperation, setProjectOperation] = useState(null)
  useEffect(() => {
    let cancelled = false
    setBuildCapability(null)
    setProjectOperation(null)
    if (activeProject) window.ace.project.capabilities(activeProject.path)
      .then(result => { if (!cancelled) setBuildCapability(result) })
      .catch(error => { if (!cancelled) setBuildCapability({ ok: false, error: error.message }) })
    return () => { cancelled = true }
  }, [activeProject?.id])
  const [focusedAgent, setFocusedAgent] = useState(null)
  useEffect(() => { setFocusedAgent(null) }, [activeProject?.id])
  const settingsRevision = useStore(s => s.settingsRevision)
  const launchSelectionEdited = useRef(false)
  const [enabledClaude, setEnabledClaude] = useState(() => new Set(getAllModelIds('claude')))
  const [enabledCodex, setEnabledCodex]   = useState(() => new Set(getAllModelIds('codex')))

  // Agent card layout: '2' is the default responsive grid (1 col, 2 cols at
  // xl); '1' forces a single full-width column so one card gets the whole
  // pane. Persisted per machine, same pattern as the sidebar width.
  const [gridCols, setGridCols] = useState(() => {
    try { return localStorage.getItem('ace:agentGridCols') === '1' ? '1' : '2' } catch (_) { return '2' }
  })
  function toggleGridCols() {
    setGridCols((c) => {
      const next = c === '1' ? '2' : '1'
      try { localStorage.setItem('ace:agentGridCols', next) } catch (_) {}
      return next
    })
  }

  // Saved defaults refresh untouched launch selections; manual choices stay selected.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [savedProvider, savedModel, ec, ex] = await Promise.all([
        window.ace.getSetting('default_provider'),
        window.ace.getSetting('default_model'),
        window.ace.getSetting('enabled_models_claude'),
        window.ace.getSetting('enabled_models_codex'),
        loadSoundsMuted(),
      ])
      if (cancelled) return
      if (ec) setEnabledClaude(new Set(JSON.parse(ec)))
      if (ex) setEnabledCodex(new Set(JSON.parse(ex)))
      let nextProvider = ['claude', 'codex'].includes(savedProvider)
        ? savedProvider
        : 'claude'
      if (savedProvider === 'auto') {
        const available = await window.ace.prereqs.check()
        if (cancelled) return
        if (!available.claude?.present && available.codex?.present) nextProvider = 'codex'
      }
      if (!launchSelectionEdited.current) setProvider(nextProvider)
      if (!launchSelectionEdited.current) {
        setModel(savedProvider === 'auto' ? DEFAULT_MODEL_BY_PROVIDER[nextProvider] : savedModel || DEFAULT_MODEL_BY_PROVIDER[nextProvider])
      }
    })().catch((error) => {
      if (!cancelled) setLaunchError(`Couldn't load launch defaults: ${error.message}`)
    })
    return () => { cancelled = true }
  }, [settingsRevision])

  // `agents` (the store) holds every agent across every project visited
  // this session, not just the active one -- see the render below and
  // useStore.js's setActiveProject (TICKET-0030). Scope UI that should
  // only reflect the active project (the empty state, default label
  // uniqueness) to just its own agents.
  const projectAgents = agents.filter((a) => a.projectId === activeProject?.id)

  async function launchAgent() {
    if (!activeProject) return
    setLaunching(true)
    setLaunchError(null)
    try {
      // Pre-check CLI availability before spawning terminal
      const resolvedProvider = provider
      const prereqs = await window.ace.prereqs.check()
      if (!prereqs[resolvedProvider]?.present) {
        const cliName = resolvedProvider === 'claude' ? 'Claude Code CLI' : 'Codex CLI'
        setLaunchError(prereqs[resolvedProvider]?.error || `${cliName} is not installed. Go to Settings → General → Prerequisites to install it.`)
        setLaunching(false)
        return
      }
      await window.ace.startAgent({
        projectId: activeProject.id,
        projectPath: activeProject.path,
        label,
        provider,
        model,
        permissionMode: PERMISSION_MODE,
      })
      const existingNames = useStore.getState().agents
        .filter((a) => a.projectId === activeProject.id)
        .map((a) => a.agentName)
      setLabel(generateAgentName(existingNames))
    } catch (error) {
      setLaunchError(error.message || 'Agent launch failed')
    } finally { setLaunching(false) }
  }

  async function closeAgent(agentId) {
    await window.ace.stopAgent(agentId)
    await window.ace.deleteAgent(agentId)
    removeAgent(agentId)
  }

  // Restore agent cards the first time a project is selected this session
  // — e.g. right after the app opens, or the first switch to a project not
  // visited yet. Every persisted agent is restored here, running or
  // stopped. A restored 'running' agent gets a brand-new terminal
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
      const rows = await window.ace.getAgents(activeProject.id)
      for (const row of rows) {
        if (cancelled) return
        if (useStore.getState().agents.some((a) => a.agentId === row.id)) continue
        let meta
        if (row.status === 'running') {
          // Re-register with AgentService so it can accept new prompts.
          const restored = await window.ace.restoreAgent({ ...row, projectPath: activeProject.path })
          if (cancelled) return
          // AgentService.restore() returns meta with 'label' field; map it to
          // agentName/sessionTitle for consistency with the rest of the UI.
          meta = {
            ...restored.meta,
            agentName: row.agent_name,
            sessionTitle: row.session_title,
          }
          delete meta.label
        } else {
          meta = {
            agentId: row.id,
            projectId: row.project_id,
            projectPath: activeProject.path,
            agentName: row.agent_name,
            sessionTitle: row.session_title,
            provider: row.provider,
            model: row.model,
            permissionMode: row.permission_mode,
          }
        }
        // Restored agents: if they already have a session_title set, don't
        // re-capture from the next line.
        useStore.getState().addAgent({ ...meta, agentId: row.id, status: row.status, hasSessionTitle: !!row.session_title })
      }
    })().catch(error => { if (!cancelled) setLaunchError(`Could not restore agents: ${error.message}`) })
    return () => { cancelled = true }
  }, [activeProject?.id])

  const modelGroups = filterGroupsByEnabled(
        MODEL_GROUPS_BY_PROVIDER[provider],
        provider === 'claude' ? enabledClaude : enabledCodex
      )
  useEffect(() => {
    const options = (modelGroups || []).flatMap(group => group.options)
    if (!options.some(option => option.id === model)) setModel(options[0]?.id || '')
  }, [provider, enabledClaude, enabledCodex, model])

  // One return, one tree shape, always. Removing a project (active or not)
  // used to flip AgentView between two structurally different `return`s;
  // React reconciles children by position, so the agent grid landed at a
  // different spot and got unmounted — killing every running agent's
  // PTY-backed CLI process (AgentTerminal.jsx) across every project, not
  // just the removed one's. Keeping the grid at a fixed position, toggling
  // only the launch bar / empty-state around it, keeps those sessions
  // mounted. Cards for non-active projects stay hidden with CSS
  // (TICKET-0030); `activeProject?.id` so it still renders with none active.
  return (
    <div className="flex flex-col h-full">
      <UsageBar />
      {activeProject && (
        <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-panel shrink-0 flex-wrap">
          <div className="text-sm font-semibold text-gray-100 mr-2 truncate max-w-xs">{activeProject.name}</div>
          <button className="btn-ghost text-xs" disabled={projectOperation?.type === 'loading'} onClick={() => runOperation(projectOperation, setProjectOperation, 'Pull', () => window.ace.git.pull(activeProject.path))}>⬇️ Pull</button>
          {buildCapability?.ok && <button className="btn-ghost text-xs" disabled={projectOperation?.type === 'loading'} onClick={() => runOperation(projectOperation, setProjectOperation, 'Build', () => window.ace.project.build(activeProject.path))}>🔨 Build</button>}
          <input className="input w-32 text-xs" placeholder="Agent label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div className="flex rounded overflow-hidden border border-border text-xs">
            {['claude','codex'].map((p) => (
              <button key={p} onClick={() => {
                launchSelectionEdited.current = true
                setProvider(p)
                setModel(DEFAULT_MODEL_BY_PROVIDER[p])
              }}
                className={'px-3 py-1.5 transition-colors ' + (provider === p ? 'bg-accent text-white' : 'text-muted hover:bg-border')}>
                {p === 'claude' ? '🟣 Claude' : '🟢 Codex'}
              </button>
            ))}
          </div>
          <ModelSelector groups={modelGroups} value={model} onChange={value => { launchSelectionEdited.current = true; setModel(value) }} className="w-72" />
          <button
            onClick={toggleSoundsMuted}
            className="px-2 py-1.5 text-xs rounded border border-border hover:bg-border transition-colors"
            title={soundsMuted ? 'Notification sounds muted' : 'Notification sounds enabled'}
          >
            {soundsMuted ? '🔇' : '🔔'}
          </button>
          <button
            onClick={() => setShowSkills(true)}
            className="px-2 py-1.5 text-xs rounded border border-border hover:bg-border transition-colors"
            title="See the skills available to agents in this project"
          >
            🧩 Skills
          </button>
          <button
            onClick={toggleGridCols}
            className="px-2 py-1.5 text-xs rounded border border-border hover:bg-border transition-colors"
            title={gridCols === '1' ? 'Single wide column — click for two columns' : 'Two columns — click for one wide column'}
          >
            {gridCols === '1' ? '▤' : '▦'}
          </button>
          <button onClick={launchAgent} disabled={launching || !model} title={!model ? 'Enable a model in Settings before launching' : 'Launch selected model'} className="btn-primary ml-auto text-xs">
            {launching ? 'Launching…' : '+ New Agent'}
          </button>
        </div>
      )}

      {activeProject && launchError && (
        <div className="px-5 py-2 text-xs text-danger border-b border-border bg-red-500/10">
          {launchError}
        </div>
      )}
      {activeProject && <OperationFeedback label="Project" status={projectOperation} />}

      <div className="flex-1 overflow-auto p-4">
        {!activeProject && (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <div className="text-4xl mb-3">📁</div>
            <div className="text-sm">Select a project from the sidebar to get started.</div>
          </div>
        )}
        {activeProject && projectAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-sm">No agents running. Launch one above.</div>
          </div>
        )}
        <div className={'grid gap-4 ' + (gridCols === '1' || focusedAgent ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2') + (projectAgents.length === 0 ? ' hidden' : '')}>
          {agents.map((agent) => (
            <div key={agent.agentId} className={agent.projectId === activeProject?.id && (!focusedAgent || focusedAgent === agent.agentId) ? 'min-w-0' : 'hidden'}>
              <AgentPane agent={agent}
                focused={focusedAgent === agent.agentId}
                onFocus={() => setFocusedAgent(focusedAgent === agent.agentId ? null : agent.agentId)}
                onClose={() => closeAgent(agent.agentId)} />
            </div>
          ))}
        </div>
      </div>
      <ProjectSkillsPanel
        isOpen={showSkills}
        onClose={() => setShowSkills(false)}
        projectPath={activeProject?.path}
      />
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

function AgentPane({ agent, onClose, focused, onFocus }) {
  const [screenshotMsg, setScreenshotMsg] = useState(null)
  const screenshotMsgTimer = useRef(null)

  const [capturing, setCapturing] = useState(false)
  const [terminalStatus, setTerminalStatus] = useState('connecting')
  // 'working' | 'waiting' | null -- pushed from Claude's lifecycle hooks via
  // the main process (HookService.js). null until the first hook fires.
  const [activity, setActivity] = useState(null)

  useEffect(() => {
    return window.ace.onAgentActivity(({ agentId, state }) => {
      if (agentId === agent.agentId) setActivity(state)
    })
  }, [agent.agentId])

  // TICKET-0034 (reworked from TICKET-0032's clipboard-paste model): hides
  // the app, lets the user drag-select a region of the primary display, and
  // saves it into this project's own assets/images/screenshots/ folder. Overwrites
  // the clipboard with the saved file's path (relative to the project
  // root, since that's the agent's own cwd) so the natural next step
  // (pasting into this card's terminal to reference it in a prompt) yields
  // the path instead of nothing.
  async function captureScreenshot() {
    setCapturing(true)
    try {
      const result = await window.ace.screenshots.captureRegion(agent.projectPath)
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

  // PTY lifecycle (error/exited) wins; otherwise the Claude-hook activity
  // signal decides Running vs Waiting. Codex agents get no hooks, so they
  // sit at Waiting while running -- they never had a finer signal anyway.
  let statusBadge
  if (agent.status !== 'running') {
    statusBadge = <span className="badge-gray">○ {agent.status === 'lost' ? 'Lost' : agent.status === 'exited' ? 'Done' : agent.status === 'error' ? 'Failed' : 'Stopped'}</span>
  } else if (terminalStatus === 'error') {
    statusBadge = <span className="badge-red">● Error</span>
  } else if (terminalStatus === 'exited') {
    statusBadge = <span className="badge-blue">● Done</span>
  } else if (terminalStatus === 'connecting') {
    statusBadge = <span className="badge-blue">● Starting</span>
  } else if (activity === 'working') {
    statusBadge = <span className="badge-green">● Running</span>
  } else if (activity === 'waiting') {
    statusBadge = <span className="badge-yellow">● Waiting</span>
  } else {
    statusBadge = <span className="badge-blue" title="Detailed activity is unavailable">● Active</span>
  }

  return (
    <div className="card flex flex-col min-w-0" style={{ height: focused ? 'calc(100vh - 13rem)' : '32rem', minHeight: '20rem' }}>
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          {statusBadge}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-accent/20 text-accent border border-accent/30">
            {agent.agentName}
          </span>
          {agent.sessionTitle && (
            <span title={agent.sessionTitle} className="text-sm font-medium text-gray-200 truncate min-w-0">{agent.sessionTitle}</span>
          )}
          <span title={agent.model} className="text-xs text-muted truncate min-w-0">{agent.model}</span>
          <span className="text-xs" title={'Permission: ' + agent.permissionMode}>{permIcon}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={onFocus} className="btn-ghost text-xs">{focused ? 'Restore' : 'Focus'}</button>
          {agent.status === 'running' && (
            <button onClick={captureScreenshot} disabled={capturing}
              title="Drag-select a screen region to save into this project's assets/images/screenshots/ folder"
              className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors disabled:opacity-50">
              {capturing ? '…' : '📸'}
            </button>
          )}
          <button onClick={onClose} className="btn-danger text-xs py-0.5">Close</button>
        </div>
      </div>

      {screenshotMsg && (
        <div className="text-xs text-muted mb-1.5 shrink-0 truncate select-none" title="Not the path itself -- selecting/copying this line overwrites the clipboard the button just set">{screenshotMsg}</div>
      )}

      {agent.status === 'running' && (
        <AgentTerminal agent={agent} onStatusChange={setTerminalStatus} />
      )}
    </div>
  )
}
