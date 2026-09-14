import React, { useEffect, useState } from 'react'
import Modal from './Modal'

// Main owns mutations of the shared .ace/notes.txt JSON Lines file.

export default function NotesPanel({ isOpen, onClose, projectPath, onSend }) {
  const [notes, setNotes] = useState([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [retry, setRetry] = useState(0)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState(null)
  const [deleted, setDeleted] = useState(null)
  const [confirmClose, setConfirmClose] = useState(false)

  function close() {
    if (saving) return
    if (draft.trim()) setConfirmClose(true)
    else onClose()
  }

  async function insert(note) {
    try { await onSend(note.text); close() }
    catch (error) { setError(error.message) }
  }

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    setLoaded(false)
    window.ace.notes.read(projectPath)
      .then((res) => {
        if (cancelled) return
        if (!res?.ok) throw new Error(res?.error || 'Could not load notes')
        setNotes(res.notes)
        setLoaded(true)
        setError('')
      })
      .catch(error => { if (!cancelled) setError(error.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, projectPath, retry])

  async function persist(mutation, onSuccess) {
    if (saving || !loaded) return
    setSaving(true)
    setError('')
    try {
      const result = await window.ace.notes.mutate(projectPath, mutation)
      if (!result.ok) throw new Error(result.error)
      setNotes(result.notes)
      onSuccess?.()
    } catch (error) { setError(error.message) }
    finally { setSaving(false) }
  }

  function addNote() {
    if (!draft.trim()) return
    persist(editing ? { type: 'edit', id: editing.id, expectedText: editing.text, text: draft } : { type: 'add', text: draft }, () => { setDraft(''); setEditing(null) })
  }

  function deleteNote(note) {
    persist({ type: 'delete', id: note.id, expectedText: note.text }, () => setDeleted(note))
  }

  if (!isOpen) return null

  return (
    <Modal title="Notes: shared by every agent in this project" onClose={close} wide className="h-[32rem] flex flex-col">
      {confirmClose && <Modal title="Discard unsaved note?" onClose={() => setConfirmClose(false)}>
        <p className="text-sm">Your draft has not been saved.</p>
        <div className="flex gap-2 mt-3">
          <button className="btn-primary" onClick={() => setConfirmClose(false)}>Keep editing</button>
          <button className="btn-ghost" onClick={() => { setDraft(''); setEditing(null); setConfirmClose(false); onClose() }}>Discard draft</button>
        </div>
      </Modal>}
      <textarea
        aria-label={editing ? 'Edit note' : 'New note'}
        disabled={saving}
        className="input text-xs font-mono resize-none shrink-0"
        rows={3}
        placeholder="Write a reminder or summary… (multi-line OK)"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      <div className="flex justify-end mt-1.5 shrink-0">
        {editing && <button disabled={saving} className="btn-ghost" onClick={() => { setEditing(null); setDraft('') }}>Cancel edit</button>}
        <button onClick={addNote} className="btn-primary text-xs" disabled={!draft.trim() || saving || !loaded}>{saving ? 'Saving...' : editing ? 'Save edit' : 'Add note'}</button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error} <button disabled={saving} className="btn-ghost" onClick={() => setRetry(n => n + 1)}>Reload / retry</button></p>}
      <input type="search" aria-label="Search notes" placeholder="Search notes" value={search} onChange={e => setSearch(e.target.value)} className="input mt-2" />
      {deleted && <button className="btn-ghost" disabled={saving || !loaded} onClick={() => persist({ type: 'add', text: deleted.text, timestamp: deleted.timestamp }, () => setDeleted(null))}>Undo delete</button>}

      <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-2">
        {loading && <p className="text-xs text-muted">Loading…</p>}
        {!loading && notes.length === 0 && <p className="text-xs text-muted">No notes yet.</p>}
        {!loading && [...notes].reverse().filter(note => note.text.toLowerCase().includes(search.toLowerCase())).map((note) => {
          return (
            <div key={note.id} className="border border-border rounded p-2">
              <pre className="text-xs whitespace-pre-wrap font-sans text-gray-100 m-0">{note.text}</pre>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-muted">{new Date(note.timestamp).toLocaleString()}</span>
                <div className="flex gap-1.5">
                  <button
                    hidden={!onSend}
                    disabled={saving}
                    onClick={() => insert(note)}
                    title="Insert into terminal without submitting"
                    className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:bg-border transition-colors">
                    Insert into terminal
                  </button>
                  <button
                    disabled={saving || !loaded}
                    onClick={() => deleteNote(note)}
                    title="Delete this note"
                    className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:text-danger hover:bg-border transition-colors">
                    🗑️
                  </button>
                  <button disabled={saving || !loaded || !!draft.trim()} className="btn-ghost text-xs" onClick={() => { setEditing(note); setDraft(note.text) }}>Edit</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
