import React, { useEffect, useState } from 'react'
import Modal from './Modal'
import { parseSkillFrontmatter } from '../utils/skills.mjs'


export default function ProjectSkillsPanel({ isOpen, onClose, projectPath }) {
  const [skills, setSkills] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [provider, setProvider] = useState('claude')
  const skillsDir = provider === 'claude' ? '.claude/skills' : '.agents/skills'

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      const dir = await window.ace.fs.readDir(projectPath, skillsDir)
      if (!dir.ok && dir.code !== 'ENOENT') throw new Error(dir.error || 'Could not read project skills')
      const dirs = dir?.ok ? dir.entries.filter((e) => e.isDirectory) : []
      const rows = await Promise.all(dirs.map(async (entry) => {
        const file = await window.ace.fs.readFile(projectPath, `${skillsDir}/${entry.name}/SKILL.md`)
        if (!file?.ok) return null
        const { name, description } = parseSkillFrontmatter(file.content)
        return { key: entry.name, name: name || entry.name, description: description || '' }
      }))
      if (cancelled) return
      setSkills(rows.filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)))
      setLoading(false)
      setError('')
    })().catch(error => { if (!cancelled) setError(error.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, projectPath, provider, retry])

  if (!isOpen) return null

  return (
    <Modal title="🧩 Project skills" onClose={onClose} wide className="h-[32rem] flex flex-col">
      <label>Provider<select className="input" value={provider} onChange={e => setProvider(e.target.value)}><option value="claude">Claude</option><option value="codex">Codex</option></select></label>
      <p className="text-sm text-muted">Installed project skills in {skillsDir}. CLI support depends on the installed provider version.</p>
      {error && <p role="alert" className="text-danger">{error}<button onClick={() => setRetry(n => n + 1)}>Retry</button></p>}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2">
        {loading && <p className="text-xs text-muted">Loading…</p>}
        {!loading && skills.length === 0 && (
          <p className="text-xs text-muted">No skills found in {skillsDir}.</p>
        )}
        {!loading && skills.map((skill) => (
          <div key={skill.key} className="border border-border rounded p-2">
            <div className="text-xs font-semibold text-gray-100">{skill.name}</div>
            {skill.description && (
              <p className="text-xs text-muted mt-1">{skill.description}</p>
            )}
          </div>
        ))}
      </div>
    </Modal>
  )
}
