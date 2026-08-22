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
    // TICKET-0033: the custom menu only applies to files -- directories
    // keep the default browser menu suppressed but no custom actions.
    e.preventDefault()
    if (!entry.isDirectory) onContextMenu(e, entry)
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

export default function FileTree({ project }) {
  const { openFile, setActiveView } = useStore()
  const [rootEntries, setRootEntries] = useState(null)
  const [error, setError] = useState(null)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, entry }

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
  }, [project.path])

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
    const result = await window.ace.fs.openInExplorer(project.path, entry.path)
    if (!result.ok) window.alert(`Couldn't reveal "${entry.name}": ${result.error}`)
  }

  async function handleRun(entry) {
    const result = await window.ace.fs.runFile(project.path, entry.path)
    if (!result.ok) window.alert(`Couldn't run "${entry.name}": ${result.error}`)
  }

  if (error) return <div className="px-3 py-2 text-xs text-danger">Couldn't load files: {error}</div>
  if (!rootEntries) return <div className="px-3 py-2 text-xs text-muted">Loading…</div>
  if (rootEntries.length === 0) return <div className="px-3 py-2 text-xs text-muted">Empty folder.</div>

  return (
    <div className="overflow-y-auto">
      {rootEntries.map((entry) => (
        <FileTreeNode
          key={entry.path}
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
            { label: 'Open', onClick: () => handleOpenFile(contextMenu.entry) },
            { label: 'Open in Explorer', onClick: () => handleOpenInExplorer(contextMenu.entry) },
            ...(isRunnable(contextMenu.entry.name)
              ? [{ divider: true }, { label: 'Run', onClick: () => handleRun(contextMenu.entry) }]
              : []),
          ]}
        />
      )}
    </div>
  )
}
