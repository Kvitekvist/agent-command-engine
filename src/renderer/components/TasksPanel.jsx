import React, { useEffect, useState } from 'react'
import Modal from './Modal'
import { formatMinutes, describeDelay } from '../utils/schedule.mjs'

// Main owns mutations of the shared .ace/tasks.txt JSON Lines file, and the
// .ace/schedule.json trigger below it. When the trigger fires, main spawns a
// brand-new autonomous agent and auto-submits whatever tasks are still open
// -- see SchedulerService.js / HookService.registerAutoPrompt.

export default function TasksPanel({ isOpen, onClose, projectPath, projectId }) {
  const [tasks, setTasks] = useState([])
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

  const [schedule, setSchedule] = useState(null)
  const [scheduleError, setScheduleError] = useState('')
  const [delayHours, setDelayHours] = useState(0)
  const [delayMinutes, setDelayMinutes] = useState(30)
  const [repeat, setRepeat] = useState(false)
  const [intervalHours, setIntervalHours] = useState(1)
  const [intervalMinutes, setIntervalMinutes] = useState(0)
  const [, tick] = useState(0)

  function close() {
    if (saving) return
    if (draft.trim()) setConfirmClose(true)
    else onClose()
  }

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    setLoaded(false)
    window.ace.tasks.read(projectPath)
      .then((res) => {
        if (cancelled) return
        if (!res?.ok) throw new Error(res?.error || 'Could not load tasks')
        setTasks(res.tasks)
        setLoaded(true)
        setError('')
      })
      .catch(error => { if (!cancelled) setError(error.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, projectPath, retry])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    window.ace.schedule.read(projectPath).then(res => { if (!cancelled && res?.ok) setSchedule(res.schedule) })
    return () => { cancelled = true }
  }, [isOpen, projectPath, retry])

  // Only the countdown text needs to stay fresh -- re-render every 30s
  // rather than computing real time from a stored "now" value.
  useEffect(() => {
    if (!schedule?.nextRunAt) return
    const id = setInterval(() => tick(n => n + 1), 30000)
    return () => clearInterval(id)
  }, [schedule?.nextRunAt])

  async function persist(mutation, onSuccess) {
    if (saving || !loaded) return
    setSaving(true)
    setError('')
    try {
      const result = await window.ace.tasks.mutate(projectPath, mutation)
      if (!result.ok) throw new Error(result.error)
      setTasks(result.tasks)
      onSuccess?.()
    } catch (error) { setError(error.message) }
    finally { setSaving(false) }
  }

  function addTask() {
    if (!draft.trim()) return
    persist(editing ? { type: 'edit', id: editing.id, expectedText: editing.text, text: draft } : { type: 'add', text: draft }, () => { setDraft(''); setEditing(null) })
  }

  function deleteTask(task) {
    persist({ type: 'delete', id: task.id, expectedText: task.text }, () => setDeleted(task))
  }

  function toggleTask(task) {
    persist({ type: 'toggle', id: task.id })
  }

  async function armTrigger() {
    setScheduleError('')
    try {
      const result = await window.ace.schedule.set(projectPath, projectId, {
        delayMinutes: delayHours * 60 + delayMinutes,
        intervalMinutes: repeat ? intervalHours * 60 + intervalMinutes : null,
      })
      if (!result.ok) throw new Error(result.error)
      setSchedule(result.schedule)
    } catch (error) { setScheduleError(error.message) }
  }

  async function cancelTrigger() {
    setScheduleError('')
    try {
      const result = await window.ace.schedule.cancel(projectPath)
      if (!result.ok) throw new Error(result.error)
      setSchedule({ nextRunAt: null, intervalMinutes: null })
    } catch (error) { setScheduleError(error.message) }
  }

  if (!isOpen) return null

  return (
    <Modal title="Tasks: shared by every agent in this project" onClose={close} wide className="h-[36rem] flex flex-col" closeOnBackdrop={false}>
      {confirmClose && <Modal title="Discard unsaved task?" onClose={() => setConfirmClose(false)}>
        <p className="text-sm">Your draft has not been saved.</p>
        <div className="flex gap-2 mt-3">
          <button className="btn-primary" onClick={() => setConfirmClose(false)}>Keep editing</button>
          <button className="btn-ghost" onClick={() => { setDraft(''); setEditing(null); setConfirmClose(false); onClose() }}>Discard draft</button>
        </div>
      </Modal>}

      <div className="border border-border rounded p-2 mb-3 shrink-0">
        <p className="text-xs font-semibold text-gray-100 mb-1.5">Autonomous run trigger</p>
        {schedule?.nextRunAt
          ? <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">
                Next run in {describeDelay(schedule.nextRunAt)} ({new Date(schedule.nextRunAt).toLocaleString()})
                {schedule.intervalMinutes ? `, repeating every ${formatMinutes(schedule.intervalMinutes)}` : ''}
              </span>
              <button className="btn-ghost text-xs shrink-0" onClick={cancelTrigger}>Cancel</button>
            </div>
          : <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted">Run open tasks automatically in</span>
              <input type="number" min="0" className="input w-14" value={delayHours} onChange={e => setDelayHours(Number(e.target.value))} aria-label="Delay hours" />h
              <input type="number" min="0" className="input w-14" value={delayMinutes} onChange={e => setDelayMinutes(Number(e.target.value))} aria-label="Delay minutes" />m
              <label className="flex items-center gap-1 ml-2">
                <input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} /> repeat every
              </label>
              {repeat && <>
                <input type="number" min="0" className="input w-14" value={intervalHours} onChange={e => setIntervalHours(Number(e.target.value))} aria-label="Repeat hours" />h
                <input type="number" min="0" className="input w-14" value={intervalMinutes} onChange={e => setIntervalMinutes(Number(e.target.value))} aria-label="Repeat minutes" />m
              </>}
              <button className="btn-primary ml-auto" onClick={armTrigger}>Arm</button>
            </div>}
        {scheduleError && <p role="alert" className="text-xs text-danger mt-1">{scheduleError}</p>}
      </div>

      <textarea
        aria-label={editing ? 'Edit task' : 'New task'}
        disabled={saving}
        className="input text-xs font-mono resize-none shrink-0"
        rows={2}
        placeholder="Add a task…"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
      />
      <div className="flex justify-end mt-1.5 shrink-0">
        {editing && <button disabled={saving} className="btn-ghost" onClick={() => { setEditing(null); setDraft('') }}>Cancel edit</button>}
        <button onClick={addTask} className="btn-primary text-xs" disabled={!draft.trim() || saving || !loaded}>{saving ? 'Saving...' : editing ? 'Save edit' : 'Add task'}</button>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error} <button disabled={saving} className="btn-ghost" onClick={() => setRetry(n => n + 1)}>Reload / retry</button></p>}
      <input type="search" aria-label="Search tasks" placeholder="Search tasks" value={search} onChange={e => setSearch(e.target.value)} className="input mt-2" />
      {deleted && <button className="btn-ghost" disabled={saving || !loaded} onClick={() => persist({ type: 'add', text: deleted.text, timestamp: deleted.timestamp, done: deleted.done }, () => setDeleted(null))}>Undo delete</button>}

      <div className="mt-3 flex-1 min-h-0 overflow-y-auto space-y-2">
        {loading && <p className="text-xs text-muted">Loading…</p>}
        {!loading && tasks.length === 0 && <p className="text-xs text-muted">No tasks yet.</p>}
        {!loading && [...tasks].reverse().filter(task => task.text.toLowerCase().includes(search.toLowerCase())).map((task) => {
          return (
            <div key={task.id} className="border border-border rounded p-2">
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={task.done}
                  disabled={saving}
                  onChange={() => toggleTask(task)}
                  className="mt-0.5"
                  aria-label={task.done ? 'Mark not done' : 'Mark done'}
                />
                <pre className={`text-xs whitespace-pre-wrap font-sans m-0 flex-1 ${task.done ? 'text-muted line-through' : 'text-gray-100'}`}>{task.text}</pre>
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-xs text-muted">{new Date(task.timestamp).toLocaleString()}</span>
                <div className="flex gap-1.5">
                  <button
                    disabled={saving || !loaded}
                    onClick={() => deleteTask(task)}
                    title="Delete this task"
                    className="text-xs py-0.5 px-2 rounded border border-border text-muted hover:text-danger hover:bg-border transition-colors">
                    🗑️
                  </button>
                  <button disabled={saving || !loaded || !!draft.trim()} className="btn-ghost text-xs" onClick={() => { setEditing(task); setDraft(task.text) }}>Edit</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
