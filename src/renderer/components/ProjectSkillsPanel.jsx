import React, { useEffect, useState } from 'react'
import Modal from './Modal'
import { parseSkillFrontmatter } from '../utils/skills.mjs'
import { readLocalSettings, writeLocalSettings } from '../utils/claudeSettings.mjs'

// Toggle switch shared by all three tabs below. Writes go through the
// caller's onToggle -- this component only renders the on/off pill.
function Toggle({ on, onClick, disabled }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 w-9 h-5 rounded-full relative transition-colors ${on ? 'bg-accent' : 'bg-border'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${on ? 'translate-x-4' : ''}`} />
    </button>
  )
}

const TABS = [
  { id: 'skills', label: 'Skills' },
  { id: 'plugins', label: 'Plugins' },
  { id: 'mcp', label: 'MCP' },
]

export default function ProjectSkillsPanel({ isOpen, onClose, projectPath }) {
  const [tab, setTab] = useState('skills')
  const [provider, setProvider] = useState('claude')
  const skillsDir = provider === 'claude' ? '.claude/skills' : '.agents/skills'

  const [skills, setSkills] = useState([])
  const [mcpServers, setMcpServers] = useState([])
  // null while unreadable (TICKET-0166): toggles stay disabled rather than
  // writing over settings we couldn't parse.
  const [local, setLocal] = useState(null)
  const [newPlugin, setNewPlugin] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      let settingsError = ''
      const localSettings = await readLocalSettings(projectPath).catch((error) => { settingsError = error.message; return null })
      if (cancelled) return
      setLocal(localSettings)

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

      const mcpFile = await window.ace.fs.readFile(projectPath, '.mcp.json')
      let servers = []
      if (mcpFile?.ok) {
        try { servers = Object.keys(JSON.parse(mcpFile.content)?.mcpServers || {}) } catch (_) {}
      }
      if (cancelled) return
      setMcpServers(servers.sort())

      setError(settingsError)
    })().catch((error) => { if (!cancelled) setError(error.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen, projectPath, provider, retry])

  // Every toggle funnels through here: errors (including a settings file that
  // turned unparseable since it was read) show inline, and the panel only
  // reloads on success so the user's input survives a failed save.
  async function updateSettings(mutate) {
    try {
      const result = await writeLocalSettings(projectPath, local.raw, mutate)
      if (!result?.ok) { setError(result?.error || 'Could not save settings'); return false }
      setRetry((n) => n + 1)
      return true
    } catch (error) {
      setError(error.message)
      return false
    }
  }

  function toggleSkill(name, currentlyOff) {
    return updateSettings((settings) => {
      settings.skillOverrides = settings.skillOverrides || {}
      if (currentlyOff) delete settings.skillOverrides[name]
      else settings.skillOverrides[name] = 'off'
      if (Object.keys(settings.skillOverrides).length === 0) delete settings.skillOverrides
    })
  }

  function toggleMcp(name, currentlyOff) {
    return updateSettings((settings) => {
      const enabled = new Set(settings.enabledMcpjsonServers || [])
      const disabled = new Set(settings.disabledMcpjsonServers || [])
      if (currentlyOff) { disabled.delete(name); enabled.add(name) }
      else { enabled.delete(name); disabled.add(name) }
      settings.enabledMcpjsonServers = [...enabled]
      settings.disabledMcpjsonServers = [...disabled]
      if (settings.enabledMcpjsonServers.length === 0) delete settings.enabledMcpjsonServers
      if (settings.disabledMcpjsonServers.length === 0) delete settings.disabledMcpjsonServers
    })
  }

  async function togglePlugin(id, nextEnabled) {
    const ok = await updateSettings((settings) => {
      settings.enabledPlugins = settings.enabledPlugins || {}
      settings.enabledPlugins[id] = nextEnabled
    })
    if (ok) setNewPlugin('')
  }

  if (!isOpen) return null

  const settings = local?.settings || {}
  const skillOverrides = settings.skillOverrides || {}
  const disabledMcp = new Set(settings.disabledMcpjsonServers || [])
  const enabledPlugins = settings.enabledPlugins || {}

  return (
    <Modal title="🧩 Skills / Plugins / MCP" onClose={onClose} wide className="h-[32rem] flex flex-col">
      <div className="flex border border-border rounded overflow-hidden shrink-0 text-xs">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={'flex-1 px-3 py-1.5 transition-colors ' + (tab === t.id ? 'bg-accent text-white' : 'text-muted hover:bg-border')}>
            {t.label}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-danger">{error} <button onClick={() => setRetry((n) => n + 1)}>Retry</button></p>}

      {tab === 'skills' && (
        <>
          <label className="mt-2 shrink-0">Provider<select className="input" value={provider} onChange={(e) => setProvider(e.target.value)}><option value="claude">Claude</option><option value="codex">Codex</option></select></label>
          <p className="text-sm text-muted shrink-0">Installed project skills in {skillsDir}. Toggling off writes .claude/settings.local.json (Claude only -- Codex has no equivalent switch, only its skill dir listed here).</p>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mt-1">
            {loading && <p className="text-xs text-muted">Loading…</p>}
            {!loading && skills.length === 0 && <p className="text-xs text-muted">No skills found in {skillsDir}.</p>}
            {!loading && skills.map((skill) => {
              const off = skillOverrides[skill.key] === 'off'
              return (
                <div key={skill.key} className="border border-border rounded p-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-gray-100">{skill.name}</div>
                    {skill.description && <p className="text-xs text-muted mt-1">{skill.description}</p>}
                  </div>
                  <Toggle on={!off} disabled={!local || provider !== 'claude'} onClick={() => toggleSkill(skill.key, off)} />
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'mcp' && (
        <>
          <p className="text-sm text-muted mt-2 shrink-0">MCP servers defined in .mcp.json. Claude Code only -- Codex has no per-server enable/disable.</p>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mt-1">
            {loading && <p className="text-xs text-muted">Loading…</p>}
            {!loading && mcpServers.length === 0 && <p className="text-xs text-muted">No .mcp.json servers found in this project.</p>}
            {!loading && mcpServers.map((name) => {
              const off = disabledMcp.has(name)
              return (
                <div key={name} className="border border-border rounded p-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-gray-100">{name}</div>
                  <Toggle on={!off} disabled={!local} onClick={() => toggleMcp(name, off)} />
                </div>
              )
            })}
          </div>
        </>
      )}

      {tab === 'plugins' && (
        <>
          <p className="text-sm text-muted mt-2 shrink-0">Plugins ACE knows about for this project. Claude Code only. New installs aren't auto-discovered -- add a plugin's id below once (name, or name@marketplace) to start toggling it.</p>
          <div className="flex gap-1.5 mt-1 shrink-0">
            <input className="input text-xs flex-1" placeholder="plugin-name@marketplace" value={newPlugin} onChange={(e) => setNewPlugin(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && local && newPlugin.trim()) togglePlugin(newPlugin.trim(), true) }} />
            <button className="btn-primary text-xs" disabled={!local || !newPlugin.trim()} onClick={() => togglePlugin(newPlugin.trim(), true)}>Add</button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-2 mt-2">
            {loading && <p className="text-xs text-muted">Loading…</p>}
            {!loading && Object.keys(enabledPlugins).length === 0 && <p className="text-xs text-muted">No plugins registered yet.</p>}
            {!loading && Object.entries(enabledPlugins).sort(([a], [b]) => a.localeCompare(b)).map(([id, on]) => (
              <div key={id} className="border border-border rounded p-2 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-gray-100">{id}</div>
                <Toggle on={!!on} disabled={!local} onClick={() => togglePlugin(id, !on)} />
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
