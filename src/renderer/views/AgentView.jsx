import React, { useState, useRef, useEffect } from 'react'
import useStore from '../store/useStore'
import ModelSelector from '../components/ModelSelector'

const CLAUDE_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-fable-5',
]
const CODEX_MODELS = ['codex-mini-latest', 'o3', 'o4-mini']

export default function AgentView() {
  const { activeProject, agents, agentOutputs, removeAgent } = useStore()
  const [label, setLabel]       = useState('Agent 1')
  const [provider, setProvider] = useState('claude')
  const [model, setModel]       = useState('claude-sonnet-5')
  const [launching, setLaunching] = useState(false)

  async function launchAgent() {
    if (!activeProject) return
    setLaunching(true)
    try {
      await window.cpi.startAgent({
        projectId:   activeProject.id,
        projectPath: activeProject.path,
        label,
        provider,
        model,
      })
      // increment default label
      const num = parseInt(label.replace(/\D/g, '') || '1', 10)
      setLabel(`Agent ${num + 1}`)
    } finally {
      setLaunching(false)
    }
  }

  async function stopAgent(agentId) {
    await window.cpi.stopAgent(agentId)
    removeAgent(agentId)
  }

  if (!activeProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted">
        <div className="text-4xl mb-3">📁</div>
        <div className="text-sm">Select a project from the sidebar to get started.</div>
      </div>
    )
  }

  const models = provider === 'claude' ? CLAUDE_MODELS : CODEX_MODELS

  return (
    <div className="flex flex-col h-full">
      {/* Header / launch bar */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-border bg-panel shrink-0 flex-wrap">
        <div className="text-sm font-semibold text-gray-100 mr-2 truncate max-w-xs">
          {activeProject.name}
        </div>

        <input
          className="input w-32 text-xs"
          placeholder="Agent label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />

        {/* Provider toggle */}
        <div className="flex rounded overflow-hidden border border-border text-xs">
          {['claude', 'codex'].map((p) => (
            <button
              key={p}
              onClick={() => {
                setProvider(p)
                setModel(p === 'claude' ? CLAUDE_MODELS[1] : CODEX_MODELS[0])
              }}
              className={`px-3 py-1.5 transition-colors ${provider === p ? 'bg-accent text-white' : 'text-muted hover:bg-border'}`}
            >
              {p === 'claude' ? '🟣 Claude' : '🟢 Codex'}
            </button>
          ))}
        </div>

        <ModelSelector
          models={models}
          value={model}
          onChange={setModel}
        />

        <button
          onClick={launchAgent}
          disabled={launching}
          className="btn-primary ml-auto text-xs"
        >
          {launching ? 'Launching…' : '+ New Agent'}
        </button>
      </div>

      {/* Agent panes */}
      <div className="flex-1 overflow-auto p-4">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted">
            <div className="text-3xl mb-2">⚡</div>
            <div className="text-sm">No agents running. Launch one above.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {agents.map((agent) => (
              <AgentPane
                key={agent.agentId}
                agent={agent}
                output={agentOutputs[agent.agentId] || []}
                onStop={() => stopAgent(agent.agentId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AgentPane({ agent, output, onStop }) {
  const [prompt, setPrompt] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [output])

  async function sendPrompt(e) {
    e.preventDefault()
    if (!prompt.trim()) return
    await window.cpi.sendPrompt(agent.agentId, prompt)
    setPrompt('')
  }

  const statusBadge = agent.status === 'running'
    ? <span className="badge-green">● Running</span>
    : <span className="badge-gray">○ Stopped</span>

  return (
    <div className="card flex flex-col h-80">
      {/* Pane header */}
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          {statusBadge}
          <span className="text-sm font-medium text-gray-200">{agent.label}</span>
          <span className="text-xs text-muted">{agent.model}</span>
          {agent.provider === 'codex' && <span className="badge-green text-xs">Codex</span>}
        </div>
        <button onClick={onStop} className="btn-danger text-xs py-0.5">Stop</button>
      </div>

      {/* Terminal output */}
      <div className="flex-1 overflow-y-auto bg-surface rounded p-2 font-mono text-xs text-green-400 leading-relaxed">
        {output.map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
        ))}
        {output.length === 0 && (
          <span className="text-muted">Waiting for output…</span>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Prompt input */}
      {agent.status === 'running' && (
        <form onSubmit={sendPrompt} className="flex gap-2 mt-2 shrink-0">
          <input
            className="input text-xs flex-1"
            placeholder="Send a prompt…"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button type="submit" className="btn-primary text-xs px-3">Send</button>
        </form>
      )}

      {/* Token summary if stopped */}
      {agent.tokenSummary && (
        <div className="text-xs text-muted mt-1">
          Tokens used — in: {agent.tokenSummary.input.toLocaleString()} / out: {agent.tokenSummary.output.toLocaleString()}
        </div>
      )}
    </div>
  )
}
