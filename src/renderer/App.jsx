import React, { useEffect, useState, lazy, Suspense } from 'react'
import useStore from './store/useStore'
import Sidebar from './components/Sidebar'
import AgentView from './views/AgentView'
import TokenView from './views/TokenView'
import PromptScoreView from './views/PromptScoreView'
import SettingsView from './views/SettingsView'
const EditorView = lazy(() => import('./views/EditorView'))
import ProcessesView from './views/ProcessesView'
import SetupView from './views/SetupView'
import ContextMenu from './components/ContextMenu'
import Modal from './components/Modal'
import NotesPanel from './components/NotesPanel'
import ProjectSkillsPanel from './components/ProjectSkillsPanel'

// TICKET-0022/0023: live subscription quota is whole-machine data (not
// scoped to whichever ACE project is active), and both the Agents tab's
// compact UsageBar and the Token Usage tab's full UsageCard pair read the
// same store slice -- polled once here so they never spawn two independent
// tokscale subprocess calls on their own timers.
const LIVE_USAGE_POLL_MS = 60_000

export default function App() {
  const { activeView, addAgent, updateAgentStatus, loadLiveUsage, setActiveView } = useStore()

  // TICKET-0051: app-wide right-click Copy / Paste / Select all, so any text in
  // the UI can be highlighted and copied without hunting for Ctrl+C. Rendered
  // in the renderer (reusing ContextMenu.jsx) rather than as a main-process
  // Menu so the agent terminal can opt out cleanly -- AgentTerminal.jsx's own
  // contextmenu handler stopPropagation()s, keeping its own paste + Ctrl+C copy
  // and stopping this menu from firing over it (a main-process context-menu
  // handler would fire regardless of the renderer's preventDefault).
  const [ctxMenu, setCtxMenu] = useState(null)
  const [closing, setClosing] = useState(false)
  const [closeSaving, setCloseSaving] = useState(false)
  const [closeError, setCloseError] = useState('')
  const activeProject = useStore(s => s.activeProject)
  useEffect(() => window.ace.onCloseRequested(() => {
    if (!useStore.getState().openFiles.some(file => file.dirty)) window.ace.closeDecision(true)
    else { setClosing(true); setCloseError('') }
  }), [])
  function cancelClose() {
    if (closeSaving) return
    setClosing(false)
    window.ace.closeDecision(false)
  }
  async function saveAndClose() {
    setCloseSaving(true)
    setCloseError('')
    try {
      const state = useStore.getState()
      for (const file of state.openFiles.filter(file => file.dirty)) {
        const result = await window.ace.fs.writeFile(state.activeProject.path, file.path, file.content, file.originalContent)
        if (!result.ok) throw new Error(`${file.name}: ${result.error}`)
        useStore.getState().markFileSaved(file.path, file.content)
      }
      if (useStore.getState().openFiles.some(file => file.dirty)) throw new Error('New edits remain unsaved.')
      window.ace.closeDecision(true)
      setClosing(false)
    } catch (error) { setCloseError(error.message) }
    finally { setCloseSaving(false) }
  }

  function handleContextMenu(e) {
    const target = e.target
    // The Monaco editor (EditorView) ships its own richer context menu; don't
    // stack ACE's generic Copy/Paste/Select all on top of it. Monaco has
    // already preventDefault()ed by the time this bubbles up, so returning
    // early here leaves only its menu, not the native Chromium one.
    if (target?.closest?.('.monaco-editor')) return
    const isEditable = !!target && (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    )
    const selection = window.getSelection?.().toString() ?? ''
    e.preventDefault()
    setCtxMenu({ x: e.clientX, y: e.clientY, selection, isEditable, target })
  }

  function buildCtxItems() {
    if (!ctxMenu) return []
    const items = [
      {
        label: '📋 Copy',
        disabled: !ctxMenu.selection,
        onClick: () => { if (ctxMenu.selection) navigator.clipboard.writeText(ctxMenu.selection) },
      },
    ]
    if (ctxMenu.isEditable) {
      items.push({
        label: '📥 Paste',
        onClick: async () => {
          const text = await navigator.clipboard.readText()
          ctxMenu.target?.focus?.()
          document.execCommand('insertText', false, text)
        },
      })
    }
    items.push({ divider: true })
    items.push({
      label: 'Select all',
      onClick: () => {
        if (ctxMenu.isEditable && ctxMenu.target?.select) {
          ctxMenu.target.select()
          return
        }
        const region = document.querySelector('main') || document.body
        const range = document.createRange()
        range.selectNodeContents(region)
        const sel = window.getSelection()
        sel.removeAllRanges()
        sel.addRange(range)
      },
    })
    return items
  }

  useEffect(() => {
    loadLiveUsage()
    const interval = setInterval(loadLiveUsage, LIVE_USAGE_POLL_MS)
    return () => clearInterval(interval)
  }, [])

  // TICKET-0119: honour the application menu's "Settings…" (Ctrl/Cmd+,) item.
  useEffect(() => window.ace.onMenuNavigate(setActiveView), [])

  useEffect(() => {
    window.ace.onAgentStatus((data) => {
      if (data.status === 'running') {
        // AgentService emits meta with 'label' field; map to agentName for UI.
        const { label, ...rest } = data.meta
        addAgent({
          agentId: data.agentId,
          ...rest,
          agentName: label,
          sessionTitle: null,
          status: 'running',
          hasSessionTitle: false,
        })
      } else {
        updateAgentStatus(data.agentId, data.status, { tokenSummary: data.tokenSummary })
      }
    })
    return () => {
      window.ace.offAgentStatus()
    }
  }, [])

  // TICKET-0055: gate the app behind a one-time (well, every-launch-until-
  // dismissed) setup screen when claude/codex aren't on PATH -- every agent
  // launch would otherwise just silently fail. Checked here rather than
  // inside AgentView so it applies before a project is even selected.
  const [setupChecked, setSetupChecked] = useState(false)
  const [showSetup, setShowSetup] = useState(false)

  useEffect(() => {
    async function checkSetup() {
      try {
        const dismissed = await window.ace.getSetting('prereqs_setup_dismissed')
        if (dismissed === 'true') return
        const result = await window.ace.prereqs.check()
        setShowSetup(!result.claude?.present || !result.codex?.present || !result.git?.present)
      } catch (_) {
        setShowSetup(true)
      } finally {
        setSetupChecked(true)
      }
    }
    checkSetup()
  }, [])

  if (!setupChecked) {
    return <div className="flex h-screen w-screen items-center justify-center bg-surface text-muted text-sm">Loading…</div>
  }
  if (showSetup) {
    return <SetupView onContinue={() => setShowSetup(false)} />
  }

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-surface text-gray-100"
      onContextMenu={handleContextMenu}
    >
      <Sidebar />
      {closing && <Modal title="Save changes before closing?" onClose={cancelClose}>
        <p className="text-sm">{useStore.getState().openFiles.filter(f => f.dirty).map(f => f.name).join(', ')}</p>
        {closeError && <p role="alert" className="text-danger">{closeError}</p>}
        <div className="flex justify-end gap-2 mt-3">
          <button disabled={closeSaving} className="btn-ghost" onClick={cancelClose}>Cancel</button>
          <button disabled={closeSaving} className="btn-danger" onClick={() => window.ace.closeDecision(true)}>Discard</button>
          <button disabled={closeSaving} className="btn-primary" onClick={saveAndClose}>{closeSaving ? 'Saving...' : 'Save all'}</button>
        </div>
      </Modal>}
      {activeProject && activeView === 'notes' && <NotesPanel isOpen projectPath={activeProject.path} onClose={() => setActiveView('agents')} />}
      {activeProject && activeView === 'skills' && <ProjectSkillsPanel isOpen projectPath={activeProject.path} onClose={() => setActiveView('agents')} />}
      <main className="flex-1 overflow-auto">
        {!activeProject && ['notes', 'skills'].includes(activeView) && <p className="p-5 text-muted">Select a project to open {activeView}.</p>}
        {/* TICKET-0027: unlike the other views, AgentView stays mounted at
            all times -- toggled with a CSS class instead of conditional
            rendering -- because each running agent's card owns a real
            PTY-backed shell process (AgentTerminal.jsx). Conditionally
            mounting it here meant every tab switch away and back unmounted
            and remounted every agent's terminal, killing and re-spawning
            its actual CLI process each time (visible console-window
            flashes, lost scrollback). A project switch still correctly
            tears sessions down, since that's driven by the `agents` store
            array being reset, not by this component's own mount lifecycle. */}
        <div className={activeView === 'agents' ? 'h-full' : 'hidden'}>
          <AgentView />
        </div>
        {activeView === 'processes' && <ProcessesView />}
        {activeView === 'tokens'    && <TokenView />}
        {activeView === 'prompt-score' && <PromptScoreView />}
        {activeView === 'settings'  && <SettingsView />}
        {activeView === 'editor'    && <Suspense fallback={<p className="p-4">Loading editor...</p>}><EditorView /></Suspense>}
      </main>
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={buildCtxItems()}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  )
}
