import React, { useEffect, useRef, useState } from 'react'
import Modal from './Modal'
import useStore from '../store/useStore'

// Lists and edits the project's own memory files (.claude/memory/*.md --
// project_memory.md, ticket_memory.md, architecture.md, etc., per the
// project-template scaffold). Plain textarea, same pattern as NotesPanel --
// no need for a Monaco instance just to edit a handful of markdown files.
const MEMORY_DIR = '.claude/memory'

export default function MemoriesPanel({ isOpen, onClose, projectPath }) {
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState(null)
  const [content, setContent] = useState('')
  const [savedContent, setSavedContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [opening, setOpening] = useState(null)
  // TICKET-0167: bumped by every open, project change and unmount, so an
  // async read or save only lands if nothing superseded it meanwhile.
  const generation = useRef(0)

  const dirty = content !== savedContent
  const setPanelDirty = useStore((s) => s.setPanelDirty)
  useEffect(() => { setPanelDirty(dirty) }, [dirty])
  useEffect(() => () => setPanelDirty(false), [])

  useEffect(() => {
    generation.current += 1
    setSelected(null)
    setContent('')
    setSavedContent('')
    setOpening(null)
    return () => { generation.current += 1 }
  }, [projectPath])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const dir = await window.ace.fs.readDir(projectPath, MEMORY_DIR)
      if (!dir.ok && dir.code !== 'ENOENT') throw new Error(dir.error || 'Could not read memory files')
      const names = dir?.ok ? dir.entries.filter((e) => !e.isDirectory && e.name.endsWith('.md')).map((e) => e.name).sort() : []
      if (cancelled) return
      setFiles(names)
      setError('')
    })().catch((error) => { if (!cancelled) setError(error.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, projectPath, retry])

  async function openFile(name) {
    if (content !== savedContent && !window.confirm('Discard unsaved changes?')) return
    const current = ++generation.current
    setError('')
    setOpening(name)
    const file = await window.ace.fs.readFile(projectPath, `${MEMORY_DIR}/${name}`)
    if (current !== generation.current) return
    setOpening(null)
    if (!file?.ok) { setError(file?.error || `Could not read ${name}`); return }
    setSelected(name)
    setContent(file.content)
    setSavedContent(file.content)
  }

  async function save() {
    if (!selected || saving || opening) return
    const current = generation.current
    setSaving(true)
    setError('')
    try {
      const result = await window.ace.fs.writeFile(projectPath, `${MEMORY_DIR}/${selected}`, content, savedContent)
      if (current !== generation.current) return
      if (!result.ok) throw new Error(result.error || 'Save failed')
      setSavedContent(content)
    } catch (error) { if (current === generation.current) setError(error.message) }
    finally { setSaving(false) }
  }

  function close() {
    if (content !== savedContent && !window.confirm('Discard unsaved changes?')) return
    onClose()
  }

  if (!isOpen) return null

  return (
    <Modal title="🧠 Memories" onClose={close} wide className="h-[32rem] flex flex-col">
      <p className="text-sm text-muted shrink-0">Memory files in {MEMORY_DIR}.</p>
      {error && <p role="alert" className="text-danger">{error} <button onClick={() => setRetry((n) => n + 1)}>Retry</button></p>}
      <div className="flex-1 min-h-0 flex gap-3 mt-2">
        <div className="w-40 shrink-0 overflow-y-auto border-r border-border pr-2">
          {loading && <p className="text-xs text-muted">Loading…</p>}
          {!loading && files.length === 0 && <p className="text-xs text-muted">No memory files found.</p>}
          {!loading && files.map((name) => (
            <button
              key={name}
              onClick={() => openFile(name)}
              className={`w-full text-left px-2 py-1.5 rounded text-xs truncate transition-colors
                ${selected === name ? 'bg-accent/20 text-accent' : 'text-gray-300 hover:bg-border'}`}
            >
              {name}{selected === name && content !== savedContent ? ' •' : ''}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          {opening && <p className="text-xs text-muted shrink-0">Opening {opening}…</p>}
          {!selected && !opening && <p className="text-xs text-muted">Select a memory file to view or edit it.</p>}
          {selected && (
            <>
              <textarea
                aria-label={`Edit ${selected}`}
                className="input text-xs font-mono flex-1 min-h-0 resize-none"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                disabled={saving || !!opening}
              />
              <div className="flex justify-end mt-1.5 shrink-0">
                <button
                  onClick={save}
                  disabled={saving || !!opening || content === savedContent}
                  className="btn-primary text-xs"
                >{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
