import React, { useEffect, useState } from 'react'
import useStore from '../store/useStore'
import FileTree from './FileTree'

const NAV = [
  { id: 'agents',   icon: '⚡', label: 'Agents' },
  { id: 'audit',    icon: '📋', label: 'Audit Log' },
  { id: 'tokens',   icon: '📊', label: 'Token Usage' },
  { id: 'settings', icon: '⚙️',  label: 'Settings' },
]

export default function Sidebar() {
  const { projects, activeProject, setProjects, setActiveProject, activeView, setActiveView, openFiles } = useStore()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    window.cpi.getProjects().then(setProjects)
  }, [])

  async function handlePickFolder() {
    const folderPath = await window.cpi.pickFolder()
    if (!folderPath) return
    const name = newName.trim() || folderPath.split(/[\\/]/).pop()
    await window.cpi.addProject(name, folderPath)
    const updated = await window.cpi.getProjects()
    setProjects(updated)
    setAdding(false)
    setNewName('')
  }

  async function handleRemove(e, id) {
    e.stopPropagation()
    await window.cpi.removeProject(id)
    const updated = await window.cpi.getProjects()
    setProjects(updated)
    if (activeProject?.id === id) setActiveProject(null)
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
  }

  return (
    <aside className="w-56 flex flex-col bg-panel border-r border-border h-full shrink-0">
      {/* App title */}
      <div className="px-4 py-4 border-b border-border shrink-0">
        <div className="text-xs font-semibold tracking-widest text-muted uppercase">CPI</div>
        <div className="text-sm font-semibold text-gray-100 mt-0.5">Claude Projects</div>
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
          <div className="px-3 pb-2 space-y-1">
            <input
              className="input text-xs"
              placeholder="Project name (optional)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button onClick={handlePickFolder} className="btn-primary w-full text-xs">
              Pick Folder
            </button>
          </div>
        )}

        <ul className="space-y-0.5 px-2 pb-2">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => handleSelectProject(p)}
                className={`w-full text-left px-2 py-1.5 rounded text-sm flex items-center justify-between group transition-colors
                  ${activeProject?.id === p.id
                    ? 'bg-accent/20 text-accent'
                    : 'text-gray-300 hover:bg-border'}`}
              >
                <span className="truncate">📁 {p.name}</span>
                <span
                  onClick={(e) => handleRemove(e, p.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted hover:text-danger text-xs ml-1"
                  title="Remove"
                >✕</span>
              </button>
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
        {openFiles.length > 0 && (
          <button
            onClick={() => setActiveView('editor')}
            className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors
              ${activeView === 'editor'
                ? 'bg-accent/20 text-accent'
                : 'text-gray-300 hover:bg-border'}`}
          >
            <span>📝</span>
            <span>Editor</span>
            <span className="ml-auto text-xs text-muted">{openFiles.length}</span>
          </button>
        )}
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
    </aside>
  )
}
