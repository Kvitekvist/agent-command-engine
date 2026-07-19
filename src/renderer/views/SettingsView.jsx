import React, { useEffect, useState } from 'react'
import useStore from '../store/useStore'
import ModelSelector from '../components/ModelSelector'

const CLAUDE_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-fable-5',
]

export default function SettingsView() {
  const { activeProject, optimizationResult, setOptimizationResult } = useStore()

  const [defaultModel, setDefaultModel]           = useState('claude-sonnet-5')
  const [provider, setProvider]                   = useState('claude')
  const [fallbackEnabled, setFallbackEnabled]     = useState(true)
  const [threshold, setThreshold]                 = useState('100000')
  const [analyzing, setAnalyzing]                 = useState(false)
  const [saved, setSaved]                         = useState(false)

  useEffect(() => {
    async function load() {
      const [m, p, f, t] = await Promise.all([
        window.cpi.getSetting('default_model'),
        window.cpi.getSetting('default_provider'),
        window.cpi.getSetting('codex_fallback_enabled'),
        window.cpi.getSetting('claude_credit_threshold'),
      ])
      if (m) setDefaultModel(m)
      if (p) setProvider(p)
      if (f !== null) setFallbackEnabled(f === 'true')
      if (t) setThreshold(t)
    }
    load()
  }, [])

  async function saveSettings() {
    await Promise.all([
      window.cpi.setSetting('default_model', defaultModel),
      window.cpi.setSetting('default_provider', provider),
      window.cpi.setSetting('codex_fallback_enabled', String(fallbackEnabled)),
      window.cpi.setSetting('claude_credit_threshold', threshold),
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function runAdvisor() {
    setAnalyzing(true)
    setOptimizationResult(null)
    try {
      const result = await window.cpi.getOptimizationAdvice(activeProject?.id || null)
      setOptimizationResult(result)
    } finally {
      setAnalyzing(false)
    }
  }

  const savingColor = { High: 'text-danger', Medium: 'text-warning', Low: 'text-muted', Speed: 'text-accent', None: 'text-success' }
  const typeIcon = { warning: '⚠️', tip: '💡', info: 'ℹ️', success: '✅' }

  return (
    <div className="p-6 max-w-2xl space-y-8 overflow-y-auto h-full">
      {/* General settings */}
      <section className="card space-y-4">
        <h2 className="text-sm font-semibold">General Settings</h2>

        <div>
          <label className="text-xs text-muted block mb-1">Default Model</label>
          <ModelSelector models={CLAUDE_MODELS} value={defaultModel} onChange={setDefaultModel} />
        </div>

        <div>
          <label className="text-xs text-muted block mb-1">Default Provider</label>
          <div className="flex gap-2">
            {['claude', 'codex'].map((p) => (
              <button
                key={p}
                onClick={() => setProvider(p)}
                className={`btn text-xs ${provider === p ? 'bg-accent text-white' : 'btn-ghost'}`}
              >
                {p === 'claude' ? '🟣 Claude' : '🟢 Codex'}
              </button>
            ))}
          </div>
        </div>

        <button onClick={saveSettings} className="btn-primary text-xs">
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </section>

      {/* Load balancing */}
      <section className="card space-y-4">
        <h2 className="text-sm font-semibold">Load Balancing</h2>
        <p className="text-xs text-muted">
          When Claude token usage in the past hour exceeds the threshold, new agents automatically
          route to OpenAI Codex instead.
        </p>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setFallbackEnabled((v) => !v)}
            className={`w-10 h-5 rounded-full transition-colors relative cursor-pointer
              ${fallbackEnabled ? 'bg-accent' : 'bg-border'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
              ${fallbackEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <span className="text-sm text-gray-200">Enable Codex fallback</span>
        </label>

        {fallbackEnabled && (
          <div>
            <label className="text-xs text-muted block mb-1">
              Token threshold per hour (switch to Codex above this)
            </label>
            <input
              className="input w-40 text-xs"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
        )}

        <button onClick={saveSettings} className="btn-primary text-xs">
          {saved ? '✓ Saved' : 'Save Settings'}
        </button>
      </section>

      {/* Token Optimization Advisor */}
      <section className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Token Optimization Advisor</h2>
            <p className="text-xs text-muted mt-0.5">
              Analyzes your recent prompts and suggests ways to spend fewer tokens.
              {activeProject && ` Scoped to: ${activeProject.name}`}
            </p>
          </div>
          <button
            onClick={runAdvisor}
            disabled={analyzing}
            className="btn-primary text-xs shrink-0"
          >
            {analyzing ? '⏳ Analyzing…' : '🔍 Analyze'}
          </button>
        </div>

        {optimizationResult && (
          <div className="space-y-3">
            {/* Stats bar */}
            {optimizationResult.stats && (
              <div className="flex gap-4 text-xs text-muted border-b border-border pb-3">
                <span>Prompts analyzed: <b className="text-gray-200">{optimizationResult.stats.totalPrompts}</b></span>
                <span>Total tokens: <b className="text-gray-200">{optimizationResult.stats.totalTokens?.toLocaleString()}</b></span>
                <span>Avg input: <b className="text-gray-200">{optimizationResult.stats.avgInputTokens}</b></span>
                <span>Avg output: <b className="text-gray-200">{optimizationResult.stats.avgOutputTokens}</b></span>
              </div>
            )}

            {/* Suggestions */}
            {(optimizationResult.suggestions || optimizationResult).map((s, i) => (
              <div key={i} className="bg-surface rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <span>{typeIcon[s.type] || 'ℹ️'}</span>
                  <span className="text-xs font-semibold text-gray-200">{s.category}</span>
                  {s.saving && s.saving !== 'None' && (
                    <span className={`ml-auto text-xs font-medium ${savingColor[s.saving] || 'text-muted'}`}>
                      {s.saving} savings
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-300 leading-relaxed">{s.message}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
