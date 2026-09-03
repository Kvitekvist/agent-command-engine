import React, { useEffect, useState } from 'react'
import useStore from '../store/useStore'
import ContextMenu from './ContextMenu'

// TICKET-0033/0037: kept in sync by hand with FileService's
// RUNNABLE_EXTENSIONS (main process) -- this copy only gates which files
// show a "Run" item; the main process is the real authority and
// re-checks it independently. Platform-aware via ace.platform.
const RUNNABLE_EXTENSIONS = window.ace?.platform === 'win32'
  ? new Set(['.exe', '.bat', '.cmd', '.ps1', '.vbs', '.com', '.msi'])
  : new Set(['.sh', '.command', '.app'])

function isRunnable(name) {
  const dot = name.lastIndexOf('.')
  return dot !== -1 && RUNNABLE_EXTENSIONS.has(name.slice(dot).toLowerCase())
}

// TICKET-0021: one node is one directory entry. Directories lazy-load their
// children only on first expand (not an eager whole-project walk, which
// would choke on a real node_modules tree) via window.ace.fs.readDir.
function FileTreeNode({ root, entry, depth, onOpenFile, onContextMenu }) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState(null)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (!entry.isDirectory) {
      onOpenFile(entry)
      return
    }
    if (!expanded && children === null) {
      setLoading(true)
      const result = await window.ace.fs.readDir(root, entry.path)
      setLoading(false)
      setChildren(result.ok ? result.entries : [])
    }
    setExpanded((v) => !v)
  }

  function handleContextMenu(e) {
    e.preventDefault()
    // Stop App.jsx's app-wide Copy/Paste context menu from also firing over
    // this one (same reason AgentTerminal.jsx stopPropagation()s its own).
    e.stopPropagation()
    onContextMenu(e, entry)
  }

  return (
    <div>
      <div
        onClick={toggle}
        onContextMenu={handleContextMenu}
        title={entry.name}
        className="flex items-center gap-1 py-0.5 rounded text-xs text-gray-300 hover:bg-border cursor-pointer truncate"
        style={{ paddingLeft: depth * 14 + 8 }}
      >
        <span className="w-3 shrink-0 text-muted">{entry.isDirectory ? (expanded ? '▾' : '▸') : ''}</span>
        <span className="shrink-0">{entry.isDirectory ? '📁' : '📄'}</span>
        <span className="truncate">{entry.name}</span>
        {loading && <span className="text-muted shrink-0">…</span>}
      </div>
      {expanded && children?.map((child) => (
        <FileTreeNode key={child.path} root={root} entry={child} depth={depth + 1} onOpenFile={onOpenFile} onContextMenu={onContextMenu} />
      ))}
    </div>
  )
}

// Electron doesn't implement window.prompt, so rename needs its own tiny input.
function RenamePrompt({ entry, onCancel, onSubmit }) {
  const [value, setValue] = useState(entry.name)
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-32" onMouseDown={onCancel}>
      <form
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={(e) => { e.preventDefault(); onSubmit(value.trim()) }}
        className="w-72 rounded border border-border bg-panel p-3 shadow-lg"
      >
        <label className="mb-1 block text-xs text-muted">Rename “{entry.name}” to</label>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onCancel() }}
          className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-gray-200 outline-none focus:border-accent"
        />
        <div className="mt-3 flex justify-end gap-2 text-xs">
          <button type="button" onClick={onCancel} className="px-2 py-1 text-muted hover:text-gray-200">Cancel</button>
          <button type="submit" className="rounded bg-accent px-2 py-1 text-white hover:bg-accent-hover">Rename</button>
        </div>
      </form>
    </div>
  )
}

export default function FileTree({ project }) {
  const { openFile, setActiveView } = useStore()
  const [rootEntries, setRootEntries] = useState(null)
  const [error, setError] = useState(null)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, entry }
  const [renaming, setRenaming] = useState(null) // { entry }
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let cancelled = false
    setRootEntries(null)
    setError(null)
    window.ace.fs.readDir(project.path, project.path).then((result) => {
      if (cancelled) return
      if (result.ok) setRootEntries(result.entries)
      else setError(result.error)
    })
    return () => { cancelled = true }
  }, [project.path, refreshVersion])

  async function handleOpenFile(entry) {
    const result = await window.ace.fs.readFile(project.path, entry.path)
    if (!result.ok) {
      const reason = result.reason === 'too-large' ? 'is too large to edit here'
        : result.reason === 'binary' ? 'looks like a binary file'
        : (result.error || 'unknown error')
      window.alert(`Couldn't open "${entry.name}": ${reason}`)
      return
    }
    openFile(entry.path, entry.name, result.content)
    setActiveView('editor')
  }

  async function handleOpenInExplorer(entry) {
    try {
      const result = await window.ace.fs.openInExplorer(project.path, entry.path)
      if (!result.ok) window.alert(`Couldn't reveal "${entry.name}": ${result.error}`)
    } catch (err) {
      window.alert(`Couldn't reveal "${entry.name}": ${err.message}`)
    }
  }

  async function handleRun(entry) {
    const result = await window.ace.fs.runFile(project.path, entry.path)
    if (!result.ok) window.alert(`Couldn't run "${entry.name}": ${result.error}`)
  }

  async function handleRename(entry, newName) {
    setRenaming(null)
    if (!newName || newName === entry.name) return
    const result = await window.ace.fs.rename(project.path, entry.path, newName)
    if (!result.ok) window.alert(`Couldn't rename "${entry.name}": ${result.error}`)
    else setRefreshVersion((version) => version + 1)
  }

  async function handleDelete(entry) {
    const kind = entry.isDirectory ? 'folder' : 'file'
    if (!window.confirm(`Move ${kind} "${entry.name}" to the Recycle Bin?`)) return
    const result = await window.ace.fs.trash(project.path, entry.path)
    if (!result.ok) window.alert(`Couldn't delete "${entry.name}": ${result.error}`)
    else setRefreshVersion((version) => version + 1)
  }

  if (error) return <div className="px-3 py-2 text-xs text-danger">Couldn't load files: {error}</div>
  if (!rootEntries) return <div className="px-3 py-2 text-xs text-muted">Loading…</div>
  if (rootEntries.length === 0) return <div className="px-3 py-2 text-xs text-muted">Empty folder.</div>

  return (
    <div className="overflow-y-auto">
      {rootEntries.map((entry) => (
        <FileTreeNode
          key={`${refreshVersion}:${entry.path}`}
          root={project.path}
          entry={entry}
          depth={0}
          onOpenFile={handleOpenFile}
          onContextMenu={(e, clickedEntry) => setContextMenu({ x: e.clientX, y: e.clientY, entry: clickedEntry })}
        />
      ))}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            ...(!contextMenu.entry.isDirectory
              ? [{ label: 'Open', onClick: () => handleOpenFile(contextMenu.entry) }]
              : []),
            { label: 'Open in Explorer', onClick: () => handleOpenInExplorer(contextMenu.entry) },
            ...(!contextMenu.entry.isDirectory && isRunnable(contextMenu.entry.name)
              ? [{ label: 'Run', onClick: () => handleRun(contextMenu.entry) }]
              : []),
            { divider: true },
            { label: contextMenu.entry.isDirectory ? 'Copy Folder Name' : 'Copy File Name', onClick: () => navigator.clipboard.writeText(contextMenu.entry.name) },
            { label: 'Copy Full Path', onClick: () => navigator.clipboard.writeText(contextMenu.entry.path) },
            { label: 'Copy Relative Path', onClick: () => navigator.clipboard.writeText(contextMenu.entry.path.slice(project.path.length).replace(/^[\\/]/, '')) },
            { divider: true },
            { label: 'Rename…', onClick: () => setRenaming({ entry: contextMenu.entry }) },
            { label: 'Delete', onClick: () => handleDelete(contextMenu.entry) },
            { divider: true },
            // ponytail: whole-tree refresh collapses folders; preserve expansion state if users need it.
            { label: 'Refresh Explorer', onClick: () => setRefreshVersion((version) => version + 1) },
          ]}
        />
      )}
      {renaming && (
        <RenamePrompt
          entry={renaming.entry}
          onCancel={() => setRenaming(null)}
          onSubmit={(name) => handleRename(renaming.entry, name)}
        />
      )}
    </div>
  )
}
