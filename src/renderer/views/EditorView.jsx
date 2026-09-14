import React, { useEffect, useRef, useState } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import useStore from '../store/useStore'
import Modal from '../components/Modal'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker&inline'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker&inline'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&inline'

globalThis.MonacoEnvironment = {
  getWorker(_moduleId, label) {
    const Worker = label === 'json' ? JsonWorker : ['css', 'scss', 'less'].includes(label) ? CssWorker
      : ['html', 'handlebars', 'razor'].includes(label) ? HtmlWorker
      : ['typescript', 'javascript'].includes(label) ? TsWorker : EditorWorker
    return new Worker()
  },
}

// Use the local editor and workers, never the wrapper's default CDN loader.
loader.config({ monaco })

export default function EditorView() {
  const {
    openFiles, activeFilePath, activeProject,
    setActiveFile, closeFile, updateFileContent, markFileSaved,
  } = useStore()
  const [saving, setSaving] = useState(false)
  const [conflict, setConflict] = useState(null)
  const [error, setError] = useState('')
  const editorRef = useRef(null)

  const activeFile = openFiles.find((f) => f.path === activeFilePath)

  async function save(file, expected = file?.originalContent) {
    if (!file || !file.dirty || !activeProject || saving) return
    setSaving(true)
    try {
      setError('')
      const result = await window.ace.fs.writeFile(activeProject.path, file.path, file.content, expected)
      if (result.ok) { markFileSaved(file.path, file.content); setConflict(null) }
      else if (result.reason === 'conflict') setConflict({ file, disk: result.content })
      else setError(result.error || 'Save failed')
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    function onKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        save(activeFile)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFile, saving])

  function handleClose(e, filePath) {
    e.stopPropagation()
    const file = openFiles.find((f) => f.path === filePath)
    if (file?.dirty && !window.confirm(`Discard unsaved changes to "${file.name}"?`)) return
    closeFile(filePath)
  }

  function runEditorAction(id) {
    editorRef.current?.getAction(id)?.run()
  }

  if (!openFiles.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <div className="text-3xl mb-2">📝</div>
        <div className="text-sm">No files open. Pick one from Files in the Sidebar.</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {error && <p role="alert" className="text-danger p-2">{error}</p>}
      {conflict && <Modal title="File changed on disk" wide onClose={() => setConflict(null)}>
        <p className="text-sm mb-2">Your unsaved text is retained. Compare the current disk copy below before choosing.</p>
        <label className="text-sm">Disk content<textarea readOnly className="input h-40 font-mono" value={conflict.disk ?? '(File deleted)'} /></label>
        <div className="flex justify-end gap-2 mt-3">
          <button className="btn-ghost" onClick={() => setConflict(null)}>Cancel</button>
          <button className="btn-ghost" onClick={() => {
            updateFileContent(conflict.file.path, conflict.disk ?? '')
            markFileSaved(conflict.file.path, conflict.disk)
            setConflict(null)
          }}>Reload disk copy</button>
          <button className="btn-danger" disabled={saving} onClick={() => save(useStore.getState().openFiles.find(f => f.path === conflict.file.path), conflict.disk)}>Overwrite disk copy</button>
        </div>
      </Modal>}
      <div className="flex items-center border-b border-border bg-panel shrink-0 overflow-x-auto">
        {openFiles.map((f) => (
          <div key={f.path}
            className={'flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border shrink-0 transition-colors '
              + (f.path === activeFilePath ? 'bg-surface text-gray-100' : 'text-muted hover:bg-border')}>
            <button onClick={() => setActiveFile(f.path)} className="truncate max-w-[140px]">{f.name}</button>
            {f.dirty && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Unsaved changes" />}
            <button onClick={(e) => handleClose(e, f.path)} aria-label={`Close ${f.name}`}
              className="text-muted hover:text-gray-100 ml-1 leading-none" title="Close">×</button>
          </div>
        ))}
        <div className="ml-auto px-3 flex items-center gap-2 shrink-0">
          <button onClick={() => runEditorAction('actions.find')}
            className="text-xs text-muted hover:text-gray-100" title="Find (Ctrl/Cmd+F)">
            Find
          </button>
          <button onClick={() => runEditorAction('editor.action.startFindReplaceAction')}
            className="text-xs text-muted hover:text-gray-100" title="Replace (Ctrl/Cmd+H)">
            Replace
          </button>
          {activeFile?.dirty && <span className="text-xs text-muted">Unsaved</span>}
          <button onClick={() => save(activeFile)} disabled={!activeFile?.dirty || saving}
            className="btn-primary text-xs px-3 py-1 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {activeFile && (
          <Editor
            path={activeFile.path}
            value={activeFile.content}
            theme="vs-dark"
            onMount={(editor) => { editorRef.current = editor }}
            onChange={(value) => updateFileContent(activeFile.path, value ?? '')}
            options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true }}
          />
        )}
      </div>
    </div>
  )
}
