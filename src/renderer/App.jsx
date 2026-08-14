import React, { useEffect, useState } from 'react'
import useStore from './store/useStore'
import Sidebar from './components/Sidebar'
import AgentView from './views/AgentView'
import AuditView from './views/AuditView'
import TokenView from './views/TokenView'
import SettingsView from './views/SettingsView'
import EditorView from './views/EditorView'
import ContextMenu from './components/ContextMenu'

// TICKET-0022/0023: live subscription quota is whole-machine data (not
// scoped to whichever ACE project is active), and both the Agents tab's
// compact UsageBar and the Token Usage tab's full UsageCard pair read the
// same store slice -- polled once here so they never spawn two independent
// tokscale subprocess calls on their own timers.
const LIVE_USAGE_POLL_MS = 60_000

export default function App() {
  const { activeView, addAgent, updateAgentStatus, loadLiveUsage } = useStore()

  // TICKET-0051: app-wide right-click Copy / Paste / Select all, so any text in
  // the UI can be highlighted and copied without hunting for Ctrl+C. Rendered
  // in the renderer (reusing ContextMenu.jsx) rather than as a main-process
  // Menu so the agent terminal can opt out cleanly -- AgentTerminal.jsx's own
  // contextmenu handler stopPropagation()s, keeping its own paste + Ctrl+C copy
  // and stopping this menu from firing over it (a main-process context-menu
  // handler would fire regardless of the renderer's preventDefault).
  const [ctxMenu, setCtxMenu] = useState(null)

  function handleContextMenu(e) {
    const target = e.target
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

  useEffect(() => {
    window.cpi.onAgentStatus((data) => {
      if (data.status === 'running') {
        addAgent({ agentId: data.agentId, ...data.meta, status: 'running' })
      } else {
        updateAgentStatus(data.agentId, data.status, { tokenSummary: data.tokenSummary })
      }
    })
    return () => {
      window.cpi.offAgentStatus()
    }
  }, [])

  return (
    <div
      className="flex h-screen w-screen overflow-hidden bg-surface text-gray-100"
      onContextMenu={handleContextMenu}
    >
      <Sidebar />
      <main className="flex-1 overflow-auto">
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
        {activeView === 'audit'    && <AuditView />}
        {activeView === 'tokens'   && <TokenView />}
        {activeView === 'settings' && <SettingsView />}
        {activeView === 'editor'   && <EditorView />}
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
