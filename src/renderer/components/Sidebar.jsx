import React, { useEffect, useState } from 'react'
import useStore from '../store/useStore'
import FileTree from './FileTree'
import Modal from './Modal'

const NAV = [
  { id: 'agents', icon: '⚡', label: 'Agents' },
  { id: 'editor', icon: '📝', label: 'Files / Editor' },
  { id: 'notes', icon: '🗒️', label: 'Project Notes' },
  { id: 'skills', icon: '🧩', label: 'Project Skills' },
  { id: 'processes', icon: '🔧', label: 'Diagnostics: Processes' },
  { id: 'tokens', icon: '📊', label: 'Usage (whole machine)' },
  { id: 'settings', icon: '⚙️', label: 'Settings' },
]

// TICKET-0104: draggable width, persisted per machine. 224px == the old w-56.
const SIDEBAR_MIN = 180
const SIDEBAR_MAX = 600
const SIDEBAR_DEFAULT = 224
const clampWidth = (n) => Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n))

export default function Sidebar() {
  const { projects, activeProject, setProjects, setActiveProject, activeView, setActiveView, openFiles } = useStore()
  const [adding, setAdding] = useState(false)
  const [query, setQuery] = useState('')
  const [removing, setRemoving] = useState(null)
  const [removeError, setRemoveError] = useState('')
  const [removeBusy, setRemoveBusy] = useState(false)
  const [pinned, setPinned] = useState(() => { try { return JSON.parse(localStorage.getItem('ace:pinned') || '[]') } catch (_) { return [] } })
  const [recent, setRecent] = useState(() => { try { return JSON.parse(localStorage.getItem('ace:recent') || '[]') } catch (_) { return [] } })
  const agents = useStore(s => s.agents)

  const [width, setWidth] = useState(() => {
    try {
      const saved = parseInt(localStorage.getItem('ace:sidebarWidth'), 10)
      return Number.isFinite(saved) ? clampWidth(saved) : SIDEBAR_DEFAULT
    } catch (_) { return SIDEBAR_DEFAULT }
  })

  // The sidebar's left edge sits at viewport x=0, so clientX is the width.
  function startResize(e) {
    e.preventDefault()
    const onMove = (ev) => setWidth(clampWidth(ev.clientX))
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      setWidth((w) => { try { localStorage.setItem('ace:sidebarWidth', String(w)) } catch (_) {} ; return w })
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    document.body.style.cursor = 'col-resize'
  }

  // TICKET-0057: name comes from a real popup (Electron doesn't implement
  // window.prompt()), then the location comes from the native OS folder
  // picker -- two popups, no inline text field in the sidebar itself.
  const [nameModalOpen, setNameModalOpen] = useState(false)
  const [pendingName, setPendingName] = useState('')
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    window.ace.getProjects().then(projects => {
      setProjects(projects)
      if (!useStore.getState().activeProject) {
        const last = projects.find(project => project.id === recent[0])
        if (last) setActiveProject(last)
      }
    }).catch(error => setRemoveError(error.message))
  }, [])

  useEffect(() => {
    let cancelled = false
    window.ace.getProjects().then(projects => { if (!cancelled) setProjects(projects) }).catch(error => { if (!cancelled) setRemoveError(error.message) })
    return () => { cancelled = true }
  }, [agents])

  async function refreshProjects() {
    const updated = await window.ace.getProjects()
    setProjects(updated)
  }

  async function handlePickFolder() {
    const folderPath = await window.ace.pickFolder()
    if (!folderPath) return
    const name = folderPath.split(/[\\/]/).pop()
    await window.ace.addProject(name, folderPath)
    await refreshProjects()
    setAdding(false)
  }

  function openNameModal() {
    setPendingName('')
    setNameError('')
    setNameModalOpen(true)
  }

  // Popup 1 (name) confirmed -> popup 2 is the native OS folder picker,
  // defaulting to ACE's own parent folder but fully navigable -- then the
  // folder is actually created there.
  async function handleNameConfirmed() {
    const name = pendingName.trim()
    if (!name) {
      setNameError('Please enter a project name')
      return
    }
    setNameModalOpen(false)

    const defaultParent = await window.ace.getDefaultParentDir()
    const parentDir = await window.ace.pickFolder(defaultParent)
    if (!parentDir) return // user canceled the location picker

    const result = await window.ace.createNewProject(name, parentDir)
    if (result?.error) {
      alert(`Error: ${result.error}`)
      return
    }
    await window.ace.addProject(name, result.path)
    await refreshProjects()
    setAdding(false)
  }

  async function handleRemove(e, id) {
    e.stopPropagation()
    try {
      const sessions = await window.ace.getAgents(id)
      setRemoving({ id, sessions, project: projects.find(p => p.id === id) })
      setRemoveError('')
    } catch (error) { window.alert(error.message) }
  }

  async function confirmRemove() {
    const id = removing.id
    setRemoveBusy(true)
    try {
    // Stop and drop only the removed project's own agents. Other projects'
    // agents keep their live PTY-backed terminal sessions — AgentView keeps
    // that grid mounted even with no active project selected, so removing a
    // project no longer tears every session down (TICKET-0030).
    const { agents, removeAgent } = useStore.getState()
    await window.ace.removeProject(id)
    for (const a of agents.filter((a) => a.projectId === id)) {
      removeAgent(a.agentId)
    }
    const updated = await window.ace.getProjects()
    setProjects(updated)
    if (activeProject?.id === id) setActiveProject(null)
    setRemoving(null)
    } catch (error) { setRemoveError(error.message) }
    finally { setRemoveBusy(false) }
  }

  // Switching projects closes every open editor tab (TICKET-0021 — they're
  // scoped to whichever project's tree they came from) — confirm first if
  // that would silently discard unsaved edits, same pattern as agent/
  // project delete elsewhere in this Sidebar.
  function handleSelectProject(p) {
    if (activeProject?.id !== p.id && openFiles.some((f) => f.dirty)) {
      if (!window.confirm('Switching projects will close your open files. Discard unsaved changes?')) return
    }
    setActiveProject(p)
    const next = [p.id, ...recent.filter(id => id !== p.id)].slice(0, 20)
    setRecent(next)
    try { localStorage.setItem('ace:recent', JSON.stringify(next)) } catch (_) {}
  }

  return (
    <aside style={{ width }} className="relative flex flex-col bg-panel border-r border-border h-full shrink-0">
      {removing && <Modal title={`Remove ${removing.project.name}?`} onClose={() => { if (!removeBusy) setRemoving(null) }}>
        <p className="text-sm">Remove this project from ACE and stop its {removing.sessions.length} sessions. Project files and usage history are kept.</p>
        <p className="text-sm mt-2">{removing.sessions.map(a => a.agent_name).join(', ')}</p>
        {activeProject?.id === removing.id && openFiles.some(f => f.dirty) && <p className="text-warning mt-2">Unsaved files will be discarded: {openFiles.filter(f => f.dirty).map(f => f.name).join(', ')}</p>}
        {removeError && <p role="alert" className="text-danger">{removeError}</p>}
        <div className="flex justify-end gap-2 mt-3"><button disabled={removeBusy} className="btn-ghost" onClick={() => setRemoving(null)}>Cancel</button><button disabled={removeBusy} className="btn-danger" onClick={confirmRemove}>Remove project</button></div>
      </Modal>}
      {/* App title */}
      <div className="px-4 py-4 border-b border-border shrink-0">
        <div className="text-xs font-semibold tracking-widest text-muted uppercase">ACE</div>
        <div className="text-sm font-semibold text-gray-100 mt-0.5">Agent Command Engine</div>
      </div>

      {/* Project list */}
      <div className="max-h-56 overflow-y-auto shrink-0 border-b border-border">
        <div className="px-3 pt-3 pb-1 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Projects</span>
          <button
            onClick={() => setAdding((v) => !v)}
            className="text-muted hover:text-accent text-lg leading-none"
            title="Add project"
          >+</button>
        </div>

        {adding && (
          <div className="px-3 pb-2 space-y-1.5">
            <div className="flex gap-1.5">
              <button onClick={handlePickFolder} className="btn-primary flex-1 text-xs" title="Connect to an existing folder">
                📁 Existing
              </button>
              <button onClick={openNameModal} className="btn-primary flex-1 text-xs" title="Create a new project folder">
                ✨ New
              </button>
            </div>
          </div>
        )}

        {nameModalOpen && (
          <Modal title="New project" onClose={() => setNameModalOpen(false)}>
            <input
              className="input text-xs"
              placeholder="Project name"
              value={pendingName}
              onChange={(e) => { setPendingName(e.target.value); setNameError('') }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleNameConfirmed() }}
              autoFocus
            />
            {nameError && <p className="text-xs text-danger mt-1.5">{nameError}</p>}
            <div className="flex justify-end gap-1.5 mt-3">
              <button onClick={() => setNameModalOpen(false)} className="btn-ghost text-xs">Cancel</button>
              <button onClick={handleNameConfirmed} className="btn-primary text-xs">OK</button>
            </div>
          </Modal>
        )}

        <input className="input" type="search" aria-label="Search projects" placeholder="Search projects" value={query} onChange={e => setQuery(e.target.value)} />
        <ul className="space-y-0.5 px-2 pb-2">
          {[...projects].filter(p => p.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => Number(pinned.includes(b.id)) - Number(pinned.includes(a.id)) || (recent.indexOf(a.id) < 0 ? 999 : recent.indexOf(a.id)) - (recent.indexOf(b.id) < 0 ? 999 : recent.indexOf(b.id))).map((p) => (
            <li key={p.id} className="flex items-center group">
              <button
                onClick={() => handleSelectProject(p)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between group transition-colors
                  ${activeProject?.id === p.id
                    ? 'bg-accent/20 text-accent'
                    : 'text-gray-300 hover:bg-border'}`}
              >
                <span className="truncate">📁 {p.name}</span>
                <span className="text-xs ml-1" aria-label={`${p.activeSessions || 0} active sessions`}>{p.activeSessions || ''}</span>
              </button>
              <button aria-label={`${pinned.includes(p.id) ? 'Unpin' : 'Pin'} ${p.name}`} onClick={() => {
                const next = pinned.includes(p.id) ? pinned.filter(id => id !== p.id) : [...pinned, p.id]
                setPinned(next)
                try { localStorage.setItem('ace:pinned', JSON.stringify(next)) } catch (_) {}
              }} className="text-xs px-1">{pinned.includes(p.id) ? '★' : '☆'}</button>
                <button
                  aria-label={`Remove ${p.name}`}
                  onClick={(e) => handleRemove(e, p.id)}
                  className="text-muted hover:text-danger text-xs ml-1 px-1"
                  title="Remove"
                >✕</button>
            </li>
          ))}
          {projects.length === 0 && (
            <li className="text-xs text-muted px-2 py-2">No projects yet. Click + to add one.</li>
          )}
        </ul>
      </div>

      {/* Files (TICKET-0021) */}
      <div className="flex-1 min-h-0 flex flex-col">
        <div className="px-3 pt-3 pb-1 shrink-0">
          <span className="text-xs font-semibold text-muted uppercase tracking-wider">Files</span>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeProject
            ? <FileTree project={activeProject} />
            : <div className="px-3 py-2 text-xs text-muted">Select a project.</div>}
        </div>
      </div>

      {/* Nav */}
      <nav className="border-t border-border px-2 py-2 space-y-0.5 shrink-0">
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors
              ${activeView === item.id
                ? 'bg-accent/20 text-accent'
                : 'text-gray-300 hover:bg-border'}`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* TICKET-0104: drag the right edge to resize; double-click to reset. */}
      <div
        onMouseDown={startResize}
        onDoubleClick={() => { setWidth(SIDEBAR_DEFAULT); try { localStorage.setItem('ace:sidebarWidth', String(SIDEBAR_DEFAULT)) } catch (_) {} }}
        title="Drag to resize · double-click to reset"
        className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-accent/40 active:bg-accent/60"
      />
    </aside>
  )
}
