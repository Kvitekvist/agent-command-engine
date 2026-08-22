import React, { useEffect, useState } from 'react'
import Editor, { loader } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import useStore from '../store/useStore'

// TICKET-0021: point @monaco-editor/react at the monaco-editor package
// already bundled locally by vite-plugin-monaco-editor-esm (vite.renderer.
// config.mjs), instead of its default behavior of fetching a copy from a
// CDN at runtime -- keeps the editor working offline like every other
// dependency in this Electron app.
loader.config({ monaco })

export default function EditorView() {
  const {
    openFiles, activeFilePath, activeProject,
    setActiveFile, closeFile, updateFileContent, markFileSaved,
  } = useStore()
  const [saving, setSaving] = useState(false)

  const activeFile = openFiles.find((f) => f.path === activeFilePath)

  async function save(file) {
    if (!file || !file.dirty || !activeProject || saving) return
    setSaving(true)
    try {
      const result = await window.ace.fs.writeFile(activeProject.path, file.path, file.content)
      if (result.ok) markFileSaved(file.path)
      else window.alert(`Couldn't save "${file.name}": ${result.error || 'unknown error'}`)
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
      <div className="flex items-center border-b border-border bg-panel shrink-0 overflow-x-auto">
        {openFiles.map((f) => (
          <button key={f.path} onClick={() => setActiveFile(f.path)}
            className={'flex items-center gap-1.5 px-3 py-2 text-xs border-r border-border shrink-0 transition-colors '
              + (f.path === activeFilePath ? 'bg-surface text-gray-100' : 'text-muted hover:bg-border')}>
            <span className="truncate max-w-[140px]">{f.name}</span>
            {f.dirty && <span className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" title="Unsaved changes" />}
            <span onClick={(e) => handleClose(e, f.path)}
              className="text-muted hover:text-gray-100 ml-1 leading-none" title="Close">×</span>
          </button>
        ))}
        <div className="ml-auto px-3 flex items-center gap-2 shrink-0">
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
            onChange={(value) => updateFileContent(activeFile.path, value ?? '')}
            options={{ fontSize: 13, minimap: { enabled: false }, automaticLayout: true }}
          />
        )}
      </div>
    </div>
  )
}
