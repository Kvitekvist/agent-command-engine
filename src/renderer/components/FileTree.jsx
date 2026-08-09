import React, { useEffect, useState } from 'react'
import useStore from '../store/useStore'

// TICKET-0021: one node is one directory entry. Directories lazy-load their
// children only on first expand (not an eager whole-project walk, which
// would choke on a real node_modules tree) via window.cpi.fs.readDir.
function FileTreeNode({ root, entry, depth, onOpenFile }) {
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
      const result = await window.cpi.fs.readDir(root, entry.path)
      setLoading(false)
      setChildren(result.ok ? result.entries : [])
    }
    setExpanded((v) => !v)
  }

  return (
    <div>
      <div
        onClick={toggle}
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
        <FileTreeNode key={child.path} root={root} entry={child} depth={depth + 1} onOpenFile={onOpenFile} />
      ))}
    </div>
  )
}

export default function FileTree({ project }) {
  const { openFile, setActiveView } = useStore()
  const [rootEntries, setRootEntries] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setRootEntries(null)
    setError(null)
    window.cpi.fs.readDir(project.path, project.path).then((result) => {
      if (cancelled) return
      if (result.ok) setRootEntries(result.entries)
      else setError(result.error)
    })
    return () => { cancelled = true }
  }, [project.path])

  async function handleOpenFile(entry) {
    const result = await window.cpi.fs.readFile(project.path, entry.path)
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

  if (error) return <div className="px-3 py-2 text-xs text-danger">Couldn't load files: {error}</div>
  if (!rootEntries) return <div className="px-3 py-2 text-xs text-muted">Loading…</div>
  if (rootEntries.length === 0) return <div className="px-3 py-2 text-xs text-muted">Empty folder.</div>

  return (
    <div className="overflow-y-auto">
      {rootEntries.map((entry) => (
        <FileTreeNode key={entry.path} root={project.path} entry={entry} depth={0} onOpenFile={handleOpenFile} />
      ))}
    </div>
  )
}
