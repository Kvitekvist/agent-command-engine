import React, { useEffect, useState } from 'react'
import ModelSelector from '../components/ModelSelector'
import PrereqChecklist from '../components/PrereqChecklist'
import { DEFAULT_MODEL_BY_PROVIDER, MODEL_GROUPS_BY_PROVIDER } from '../utils/modelCatalog'

export default function SettingsView() {
  const [defaultModel, setDefaultModel] = useState(DEFAULT_MODEL_BY_PROVIDER.claude)
  const [provider, setProvider]         = useState('claude')
  const [saved, setSaved]               = useState(false)

  useEffect(() => {
    async function load() {
      const [m, p] = await Promise.all([
        window.ace.getSetting('default_model'),
        window.ace.getSetting('default_provider'),
      ])
      if (m) setDefaultModel(m)
      if (p) setProvider(p)
    }
    load()
  }, [])

  async function saveSettings() {
    await Promise.all([
      window.ace.setSetting('default_model', defaultModel),
      window.ace.setSetting('default_provider', provider),
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="p-6 max-w-2xl space-y-8 overflow-y-auto h-full">
      {/* Prerequisites (TICKET-0055) */}
      <section className="card space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Prerequisites</h2>
          <p className="text-xs text-muted mt-0.5">
            The CLIs ACE launches agents through. Re-run this anytime a launch fails with
            "command not found", e.g. after reinstalling Node.js.
          </p>
        </div>
        <PrereqChecklist />
      </section>

      {/* General settings */}
      <section className="card space-y-4">
        <h2 className="text-sm font-semibold">General Settings</h2>

        {provider !== 'auto' && <div>
          <label className="text-xs text-muted block mb-1">Default Model</label>
          <ModelSelector
            groups={MODEL_GROUPS_BY_PROVIDER[provider]}
            value={defaultModel}
            onChange={setDefaultModel}
            className="w-full"
          />
        </div>}

        <div>
          <label className="text-xs text-muted block mb-1">Default Provider</label>
          <div className="flex gap-2">
            {['auto', 'claude', 'codex'].map((p) => (
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

        <button onClick={saveSettings} className="btn-primary text-xs">
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </section>
    </div>
  )
}
