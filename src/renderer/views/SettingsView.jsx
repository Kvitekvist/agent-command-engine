import React, { useEffect, useState } from 'react'
import ModelSelector from '../components/ModelSelector'
import PrereqChecklist from '../components/PrereqChecklist'
import useStore from '../store/useStore'
import {
  DEFAULT_MODEL_BY_PROVIDER,
  MODEL_GROUPS_BY_PROVIDER,
  getAllModelIds,
  filterGroupsByEnabled,
} from '../utils/modelCatalog'

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'models', label: 'Models' },
]

export default function SettingsView() {
  const [tab, setTab] = useState('general')
  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODEL_BY_PROVIDER.claude)
  const [provider, setProvider] = useState('claude')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [retry, setRetry] = useState(0)

  const [enabledClaude, setEnabledClaude] = useState(new Set())
  const [enabledCodex, setEnabledCodex] = useState(new Set())

  useEffect(() => {
    async function load() {
      const [m, p, ec, ex] = await Promise.all([
        window.ace.getSetting('default_model'),
        window.ace.getSetting('default_provider'),
        window.ace.getSetting('enabled_models_claude'),
        window.ace.getSetting('enabled_models_codex'),
      ])
      let nextProvider = p === 'codex' ? 'codex' : 'claude'
      if (p === 'auto') {
        const available = await window.ace.prereqs.check()
        if (!available.claude?.present && available.codex?.present) nextProvider = 'codex'
      }
      setProvider(nextProvider)
      setDefaultModel(p === 'auto' ? DEFAULT_MODEL_BY_PROVIDER[nextProvider] : m || DEFAULT_MODEL_BY_PROVIDER[nextProvider])
      setEnabledClaude(ec ? new Set(JSON.parse(ec)) : new Set(getAllModelIds('claude')))
      setEnabledCodex(ex ? new Set(JSON.parse(ex)) : new Set(getAllModelIds('codex')))
    }
    load().then(() => setError('')).catch(error => setError(error.message))
  }, [retry])

  async function saveSettings() {
    setSaving(true)
    setError('')
    try {
    await Promise.all([
      window.ace.setSetting('default_model', defaultModel),
      window.ace.setSetting('default_provider', provider),
    ])
    useStore.getState().settingsUpdated()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    } catch (error) { setError(error.message) }
    finally { setSaving(false) }
  }

  async function saveEnabledModels() {
    setSaving(true)
    setError('')
    try {
    await Promise.all([
      window.ace.setSetting('enabled_models_claude', JSON.stringify([...enabledClaude])),
      window.ace.setSetting('enabled_models_codex', JSON.stringify([...enabledCodex])),
      window.ace.setSetting('default_model', defaultModel),
    ])
    useStore.getState().settingsUpdated()
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    } catch (error) { setError(error.message) }
    finally { setSaving(false) }
  }

  function toggleModel(providerKey, modelId) {
    const setter = providerKey === 'claude' ? setEnabledClaude : setEnabledCodex
    setter(prev => {
      const next = new Set(prev)
      if (next.has(modelId)) next.delete(modelId)
      else next.add(modelId)
      return next
    })
  }

  const filteredGroups = filterGroupsByEnabled(
    MODEL_GROUPS_BY_PROVIDER[provider],
    provider === 'claude' ? enabledClaude : enabledCodex
  )
  useEffect(() => {
    const options = filteredGroups.flatMap(group => group.options)
    if (!options.some(option => option.id === defaultModel)) setDefaultModel(options[0]?.id || '')
  }, [provider, enabledClaude, enabledCodex, defaultModel])

  return (
    <div className="p-6 max-w-2xl space-y-6 overflow-y-auto h-full">
      {error && <p role="alert" className="text-danger">{error}<button onClick={() => setRetry(n => n + 1)}>Reload settings</button></p>}
      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-sm -mb-px border-b-2 transition-colors ${
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <>
          {/* Prerequisites */}
          <section className="card space-y-4">
            <div>
              <h2 className="text-sm font-semibold">Prerequisites</h2>
              <p className="text-xs text-muted mt-0.5">
                The CLIs ACE launches agents through. Re-run this anytime a launch fails with
                "command not found", e.g. after reinstalling Node.js.
              </p>
            </div>
            <PrereqChecklist allowUninstall />
          </section>

          {/* General settings */}
          <section className="card space-y-4">
            <h2 className="text-sm font-semibold">Default Provider &amp; Model</h2>

            <div>
              <label className="text-xs text-muted block mb-1">Default Provider</label>
              <div className="flex gap-2">
                {['claude', 'codex'].map(p => (
                  <button
                    key={p}
                    onClick={() => {
                      setProvider(p)
                      if (p !== 'auto') setDefaultModel(DEFAULT_MODEL_BY_PROVIDER[p])
                    }}
                    className={`btn text-xs ${provider === p ? 'bg-accent text-white' : 'btn-ghost'}`}
                  >
                    {p === 'auto' ? '⚖ Auto' : p === 'claude' ? '🟣 Claude' : '🟢 Codex'}
                  </button>
                ))}
              </div>
              {provider === 'auto' && (
                <p className="text-xs text-muted mt-2">
                  ACE routes Auto to Claude, then uses a compatible model for it.
                </p>
              )}
            </div>

            {provider !== 'auto' && (
              <div>
                <label className="text-xs text-muted block mb-1">Default Model</label>
                <ModelSelector
                  groups={filteredGroups}
                  value={defaultModel}
                  onChange={setDefaultModel}
                  className="w-full"
                />
              </div>
            )}

            <button disabled={saving} onClick={saveSettings} className="btn-primary text-xs">
              {saved ? '✓ Saved' : 'Save Settings'}
            </button>
          </section>
        </>
      )}

      {tab === 'models' && (
        <section className="card space-y-6">
          <div>
            <h2 className="text-sm font-semibold">Visible Models</h2>
            <p className="text-xs text-muted mt-0.5">
              Toggle which models appear in the model dropdown when launching agents.
            </p>
          </div>

          {['claude', 'codex'].map(prov => {
            const enabled = prov === 'claude' ? enabledClaude : enabledCodex
            return (
              <div key={prov}>
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  {prov === 'claude' ? '🟣 Claude' : '🟢 Codex'}
                </h3>
                <div className="space-y-3">
                  {MODEL_GROUPS_BY_PROVIDER[prov].map(group => (
                    <div key={group.label}>
                      <div className="text-xs text-muted mb-1">{group.label}</div>
                      <div className="space-y-1">
                        {group.options.map(opt => (
                          <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={enabled.has(opt.id)}
                              onChange={() => toggleModel(prov, opt.id)}
                              className="accent-accent"
                            />
                            <span className="text-sm">{opt.label}</span>
                            <span className="text-xs text-muted">— {opt.description}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          <button disabled={saving} onClick={saveEnabledModels} className="btn-primary text-xs">
            {saved ? '✓ Saved' : 'Save Model Visibility'}
          </button>
        </section>
      )}
    </div>
  )
}
