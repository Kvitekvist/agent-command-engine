import React, { useId, useRef, useState } from 'react'
import Modal from './Modal'

// TICKET-0164: installer-style new project. The parent folder comes first
// (native picker, so main can authorize it), then the folder name and a
// required description that seeds the project's memory (TICKET-0165). Main
// validates everything again; its errors show inline and keep the form.
export default function NewProjectWizard({ parentDir, onChangeFolder, onCreated, onClose }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  // State lags a render behind; the ref blocks a second click in the same tick.
  const inFlight = useRef(false)
  const nameId = useId()
  const descriptionId = useId()

  const separator = parentDir.includes('\\') ? '\\' : '/'
  const destination = `${parentDir.replace(/[\\/]+$/, '')}${separator}${name.trim() || '…'}`

  async function create() {
    if (inFlight.current) return
    if (!name.trim()) { setError('Enter a folder name.'); return }
    if (!description.trim()) { setError('Describe the project.'); return }
    inFlight.current = true
    setCreating(true)
    setError('')
    try {
      const result = await window.ace.createNewProject(name.trim(), description, parentDir)
      if (result?.error) { setError(result.error); return }
      await onCreated(name.trim(), result.path)
    } catch (err) {
      setError(err.message)
    } finally {
      inFlight.current = false
      setCreating(false)
    }
  }

  return (
    <Modal title="New project" onClose={() => { if (!creating) onClose() }} wide>
      <p className="text-xs text-muted">Location</p>
      <div className="flex items-center gap-2 mt-1">
        <code className="text-xs text-gray-300 truncate flex-1" title={parentDir}>{parentDir}</code>
        <button className="btn-ghost text-xs" disabled={creating} onClick={onChangeFolder}>Back: choose another folder</button>
      </div>

      <label htmlFor={nameId} className="block text-xs text-muted mt-3">Folder name</label>
      <input
        id={nameId}
        className="input text-xs mt-1"
        value={name}
        maxLength={100}
        disabled={creating}
        onChange={(e) => { setName(e.target.value); setError('') }}
        autoFocus
      />

      <label htmlFor={descriptionId} className="block text-xs text-muted mt-3">Description</label>
      <p className="text-xs text-muted">What is it for, who will use it, and what should the first useful version do?</p>
      <textarea
        id={descriptionId}
        className="input text-xs mt-1 h-28 resize-y"
        value={description}
        maxLength={4000}
        disabled={creating}
        onChange={(e) => { setDescription(e.target.value); setError('') }}
      />

      <p className="text-xs text-muted mt-3">Will be created at</p>
      <code className="block text-xs text-gray-300 break-all">{destination}</code>

      {error && <p role="alert" className="text-xs text-danger mt-2">{error}</p>}
      <div className="flex justify-end gap-1.5 mt-3">
        <button className="btn-ghost text-xs" disabled={creating} onClick={onClose}>Cancel</button>
        <button className="btn-primary text-xs" disabled={creating} onClick={create}>{creating ? 'Creating…' : 'Create project'}</button>
      </div>
    </Modal>
  )
}
