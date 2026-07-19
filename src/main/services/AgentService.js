const { spawn } = require('child_process')
const { randomUUID } = require('crypto')
const path = require('path')

// Parses token counts from Claude CLI JSON output lines
function parseTokens(line) {
  try {
    const obj = JSON.parse(line)
    // Claude CLI --output-format json emits usage in result messages
    if (obj.type === 'result' && obj.usage) {
      return {
        input: obj.usage.input_tokens || 0,
        output: obj.usage.output_tokens || 0,
      }
    }
    // Also check assistant messages for streaming token counts
    if (obj.type === 'assistant' && obj.message?.usage) {
      return {
        input: obj.message.usage.input_tokens || 0,
        output: obj.message.usage.output_tokens || 0,
      }
    }
  } catch (_) {}
  return null
}

class AgentService {
  constructor() {
    this.agents = new Map() // agentId -> { process, buffer, meta }
    this.mainWindow = null
  }

  init(mainWindow) {
    this.mainWindow = mainWindow
  }

  setWindow(win) {
    this.mainWindow = win
  }

  _emit(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  start({ projectId, projectPath, label, provider = 'claude', model = 'claude-sonnet-5' }) {
    const agentId = randomUUID()
    const cmd = provider === 'claude' ? 'claude' : 'openai'
    const args = provider === 'claude'
      ? ['--model', model, '--output-format', 'stream-json', '--verbose']
      : ['codex', '--model', model]

    const proc = spawn(cmd, args, {
      cwd: projectPath,
      shell: true,
      env: { ...process.env },
    })

    const meta = { agentId, projectId, projectPath, label, provider, model, startedAt: Date.now() }
    this.agents.set(agentId, { proc, meta, inputTokens: 0, outputTokens: 0 })

    proc.stdout.on('data', (data) => {
      const text = data.toString()
      // Try to extract tokens from each line
      for (const line of text.split('\n')) {
        const tokens = parseTokens(line.trim())
        if (tokens) {
          const agent = this.agents.get(agentId)
          if (agent) {
            agent.inputTokens += tokens.input
            agent.outputTokens += tokens.output
          }
        }
      }
      this._emit('agent:output', { agentId, text, stream: 'stdout' })
    })

    proc.stderr.on('data', (data) => {
      this._emit('agent:output', { agentId, text: data.toString(), stream: 'stderr' })
    })

    proc.on('close', (code) => {
      const agent = this.agents.get(agentId)
      const tokenSummary = agent ? { input: agent.inputTokens, output: agent.outputTokens } : null
      this._emit('agent:status', { agentId, status: 'stopped', exitCode: code, tokenSummary })
      this.agents.delete(agentId)
    })

    this._emit('agent:status', { agentId, status: 'running', meta })
    return { agentId, meta }
  }

  sendPrompt(agentId, prompt) {
    const agent = this.agents.get(agentId)
    if (!agent) return { error: 'Agent not found' }
    // Claude CLI reads prompts from stdin
    agent.proc.stdin.write(prompt + '\n')
    return { ok: true }
  }

  stop(agentId) {
    const agent = this.agents.get(agentId)
    if (!agent) return
    agent.proc.kill('SIGTERM')
    this.agents.delete(agentId)
  }

  killAll() {
    for (const [, agent] of this.agents) {
      try { agent.proc.kill('SIGTERM') } catch (_) {}
    }
    this.agents.clear()
  }

  getRunning() {
    return [...this.agents.entries()].map(([id, a]) => ({
      agentId: id,
      ...a.meta,
      inputTokens: a.inputTokens,
      outputTokens: a.outputTokens,
    }))
  }
}

module.exports = { AgentService: new AgentService() }
