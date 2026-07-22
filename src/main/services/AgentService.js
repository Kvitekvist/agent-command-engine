const { spawn } = require('child_process')
const { randomUUID } = require('crypto')
const { EventEmitter } = require('events')

// Parses token counts from Claude CLI JSON output lines. Only the final
// 'result' event's usage is read — it's the authoritative total for the
// whole turn. Intermediate 'assistant' events carry their own partial usage
// too, so counting both would double (or triple, with multi-step tool use)
// count the same tokens.
function parseTokens(line) {
  try {
    const obj = JSON.parse(line)
    if (obj.type === 'result' && obj.usage) {
      return { input: obj.usage.input_tokens || 0, output: obj.usage.output_tokens || 0 }
    }
  } catch (_) {}
  return null
}

// Extracts the Claude CLI session id (present on every stream-json event) so
// we can pass --resume on the next turn and keep conversation context.
function parseSessionId(line) {
  try {
    const obj = JSON.parse(line)
    return obj.session_id || null
  } catch (_) {}
  return null
}

// Extracts human-readable text from stream-json lines
function parseText(line) {
  try {
    const obj = JSON.parse(line)
    if (obj.type === 'content_block_delta' && obj.delta?.type === 'text_delta') {
      return obj.delta.text
    }
    if (obj.type === 'result' && obj.result) {
      return obj.result
    }
  } catch (_) {}
  return null
}

// Extracts tool use info from stream-json lines (for displaying what Claude is doing)
function parseToolUse(line) {
  try {
    const obj = JSON.parse(line)
    // Tool use appears in assistant messages
    if (obj.type === 'assistant' && obj.message?.content) {
      for (const block of obj.message.content) {
        if (block.type === 'tool_use') {
          return { tool: block.name, input: block.input }
        }
      }
    }
    // Also appears as content_block_start with tool_use type
    if (obj.type === 'content_block_start' && obj.content_block?.type === 'tool_use') {
      return { tool: obj.content_block.name, input: null }
    }
  } catch (_) {}
  return null
}

// Claude CLI's --print mode is fully headless: it can't pause mid-turn to ask
// a human for approval, so risky tool calls are just denied outright. The
// final 'result' event lists exactly what got denied — surface those to the
// renderer as clear, unambiguous messages instead of leaving the model to
// (sometimes vaguely) narrate that it's "stuck".
function parsePermissionDenials(line) {
  try {
    const obj = JSON.parse(line)
    if (obj.type === 'result' && Array.isArray(obj.permission_denials)) {
      return obj.permission_denials
    }
  } catch (_) {}
  return null
}

// Per-mode static tool policy. Claude CLI's headless mode has no live
// approval flow, so "asking" isn't possible — these are fixed allow/deny
// lists instead. Verified empirically against the real CLI:
//   - --allowedTools without a tool grants it unconditionally
//   - --disallowedTools "Tool(cmd:*)" reliably blocks by exact leading
//     command name (e.g. "rm", "sudo", "Remove-Item") — finer-grained
//     patterns like "git push:*" are NOT reliably enforced by the CLI, so we
//     don't pretend they are.
function buildPermissionArgs(permissionMode) {
  if (permissionMode === 'auto') {
    return ['--dangerously-skip-permissions']
  }
  if (permissionMode === 'ask') {
    // "Guarded": shell access allowed, but the most destructive single
    // commands are hard-blocked by name.
    return [
      '--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'PowerShell',
      '--disallowedTools', 'Bash(rm:*)', 'Bash(sudo:*)', 'PowerShell(Remove-Item:*)',
    ]
  }
  // 'safe' (default): file tools only, no shell access at all.
  return ['--allowedTools', 'Read', 'Edit', 'Write', 'Glob', 'Grep']
}

// If this app is itself launched from a terminal that has an active Claude
// Code session (CLAUDECODE=1 etc. — exactly the dev setup here), those env
// vars leak into spawned children and make the nested `claude` CLI treat
// itself as a sandboxed child session, hard-blocking file writes even inside
// the real project directory. Strip them so spawned agents behave as
// ordinary top-level sessions.
function buildChildEnv() {
  const env = { ...process.env }
  for (const key of Object.keys(env)) {
    if (/^CLAUDE/i.test(key)) delete env[key]
  }
  return env
}

class AgentService extends EventEmitter {
  constructor() {
    super()
    this.agents = new Map()
    this.mainWindow = null
  }

  init(mainWindow) { this.mainWindow = mainWindow }
  setWindow(win) { this.mainWindow = win }

  _emit(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
    this.emit(channel, data)
  }

  start({ projectId, projectPath, label, provider = 'claude', model = 'claude-sonnet-5', permissionMode = 'safe' }) {
    const agentId = randomUUID()
    const meta = { agentId, projectId, projectPath, label, provider, model, permissionMode, startedAt: Date.now() }
    this.agents.set(agentId, { activeProc: null, meta, inputTokens: 0, outputTokens: 0, sessionId: null })
    this._emit('agent:status', { agentId, status: 'running', meta })
    return { agentId, meta }
  }

  // Re-register an agent that was persisted in a previous run (app reopened,
  // or the project was reselected) so it can keep accepting prompts. No
  // process is spawned here — sendPrompt spawns one per turn as usual,
  // resuming the stored session id so conversation context carries over.
  //
  // Deliberately does NOT emit 'agent:status' — the caller (the project
  // selection flow) adds it to the UI directly from the returned meta, since
  // that path must work identically whether this is the first restore this
  // session or a revisit of an already-registered agent (which would
  // otherwise get no event at all).
  restore({ agentId, projectId, projectPath, label, provider, model, permissionMode, sessionId }) {
    if (this.agents.has(agentId)) return { agentId, meta: this.agents.get(agentId).meta }
    const meta = { agentId, projectId, projectPath, label, provider, model, permissionMode, startedAt: Date.now() }
    this.agents.set(agentId, { activeProc: null, meta, inputTokens: 0, outputTokens: 0, sessionId: sessionId || null })
    return { agentId, meta }
  }

  sendPrompt(agentId, prompt) {
    const agent = this.agents.get(agentId)
    if (!agent) return { error: 'Agent not found' }

    if (agent.activeProc) {
      try { agent.activeProc.kill('SIGTERM') } catch (_) {}
      agent.activeProc = null
    }

    const { meta } = agent

    let args
    if (meta.provider === 'claude') {
      args = ['--print', '--output-format', 'stream-json', '--verbose', '--model', meta.model]
      args.push(...buildPermissionArgs(meta.permissionMode))

      // Each turn spawns a new process, so resume the prior turn's session
      // (by id) to keep conversation context — otherwise every message
      // starts from a blank slate.
      if (agent.sessionId) {
        args.push('--resume', agent.sessionId)
      }
    } else {
      args = ['codex', '--model', meta.model, '--print']
    }

    const proc = spawn(meta.provider === 'claude' ? 'claude' : 'openai', args, {
      cwd: meta.projectPath,
      shell: true,
      env: buildChildEnv(),
    })

    agent.activeProc = proc

    // agent.inputTokens/outputTokens are lifetime totals (surfaced in the
    // "Tokens — in/out" summary shown when the agent is stopped). Snapshot
    // them here so the DB row for *this* prompt only gets this turn's delta,
    // not the running lifetime total.
    const turnStartInput = agent.inputTokens
    const turnStartOutput = agent.outputTokens

    proc.stdin.write(prompt)
    proc.stdin.end()

    let textBuffer = ''

    // stdout arrives as arbitrary-sized chunks, not one-line-per-chunk — a
    // single JSON line (especially the final 'result' line, which carries
    // the whole response text + token usage and is often the largest line
    // in the stream) can be split across two 'data' events. Without
    // buffering the trailing partial line across chunks, JSON.parse fails
    // silently on both fragments and that line's data is lost entirely.
    let lineBuffer = ''

    const processLine = (trimmed) => {
      if (!trimmed) return

      const sessionId = parseSessionId(trimmed)
      if (sessionId) {
        agent.sessionId = sessionId
      }

      const tokens = parseTokens(trimmed)
      if (tokens) {
        agent.inputTokens += tokens.input
        agent.outputTokens += tokens.output
      }

      const toolUse = parseToolUse(trimmed)
      if (toolUse) {
        this._emit('agent:tool-use', { agentId, tool: toolUse.tool, input: toolUse.input })
      }

      const denials = parsePermissionDenials(trimmed)
      if (denials && denials.length) {
        for (const d of denials) {
          const cmd = d.tool_input?.command || d.tool_input?.file_path || ''
          const text = `⛔ Blocked by permission policy: ${d.tool_name}${cmd ? ' — ' + cmd : ''}`
          this._emit('agent:output', { agentId, text: '\n' + text, stream: 'permission-denied' })
        }
      }

      const text = parseText(trimmed)
      if (text) {
        textBuffer += text
        this._emit('agent:output', { agentId, text, stream: 'text' })
      }
    }

    proc.stdout.on('data', (data) => {
      lineBuffer += data.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() // keep the last (possibly incomplete) line for the next chunk
      for (const line of lines) processLine(line.trim())
    })

    proc.stderr.on('data', (data) => {
      const msg = data.toString()
      if (msg.includes('Warning:') || msg.includes('API key') || !msg.trim()) return
      this._emit('agent:output', { agentId, text: `⚠ ${msg}`, stream: 'stderr' })
    })

    proc.on('close', (code) => {
      if (lineBuffer.trim()) {
        processLine(lineBuffer.trim())
        lineBuffer = ''
      }
      if (agent.activeProc === proc) {
        agent.activeProc = null
      }
      this._emit('agent:prompt-done', {
        agentId,
        exitCode: code,
        response: textBuffer,
        tokens: {
          input: agent.inputTokens - turnStartInput,
          output: agent.outputTokens - turnStartOutput,
        },
        sessionId: agent.sessionId,
      })
    })

    return { ok: true }
  }

  // Drop the resumed session so the next prompt starts a brand-new conversation
  clearContext(agentId) {
    const agent = this.agents.get(agentId)
    if (!agent) return { error: 'Agent not found' }

    if (agent.activeProc) {
      try { agent.activeProc.kill('SIGTERM') } catch (_) {}
      agent.activeProc = null
    }
    agent.sessionId = null
    agent.inputTokens = 0
    agent.outputTokens = 0

    this._emit('agent:context-cleared', { agentId })
    return { ok: true }
  }

  stop(agentId) {
    const agent = this.agents.get(agentId)
    if (!agent) return
    if (agent.activeProc) {
      try { agent.activeProc.kill('SIGTERM') } catch (_) {}
    }
    const tokenSummary = { input: agent.inputTokens, output: agent.outputTokens }
    this._emit('agent:status', { agentId, status: 'stopped', tokenSummary })
    this.agents.delete(agentId)
  }

  killAll() {
    for (const [, agent] of this.agents) {
      try { if (agent.activeProc) agent.activeProc.kill('SIGTERM') } catch (_) {}
    }
    this.agents.clear()
  }

  getRunning() {
    return [...this.agents.entries()].map(([id, a]) => ({
      agentId: id, ...a.meta,
      inputTokens: a.inputTokens, outputTokens: a.outputTokens,
    }))
  }
}

module.exports = { AgentService: new AgentService() }
