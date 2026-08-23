const { spawn } = require('child_process')
const { randomUUID } = require('crypto')
const { EventEmitter } = require('events')
const { TokscaleService } = require('./TokscaleService')

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

// Diffs tokscale's cumulative session usage against the last-seen baseline
// to get this turn's actual delta (cache tokens + real cost included),
// clamped to 0 in case tokscale's own numbers ever settle backwards between
// calls (e.g. a cache/index rebuild) rather than surfacing a negative delta.
function computeTokscaleDelta(usage, baseline) {
  return {
    input: Math.max(0, usage.inputTokens - baseline.inputTokens),
    output: Math.max(0, usage.outputTokens - baseline.outputTokens),
    cacheRead: Math.max(0, usage.cacheReadTokens - baseline.cacheReadTokens),
    cacheCreation: Math.max(0, usage.cacheCreationTokens - baseline.cacheCreationTokens),
    cost: Math.max(0, usage.costUsd - baseline.costUsd),
  }
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

// TICKET-0020: same three-tier policy as buildPermissionArgs above,
// translated to the real Codex CLI's own --sandbox/--ask-for-approval
// flags (confirmed via `codex exec --help`).
function buildCodexArgs(permissionMode) {
  if (permissionMode === 'auto') {
    return ['--dangerously-bypass-approvals-and-sandbox']
  }
  if (permissionMode === 'ask') {
    return ['--sandbox', 'workspace-write', '--ask-for-approval', 'on-request']
  }
  // Current Codex releases accept only `on-request` and `never` here.
  // Safe mode is already constrained by the read-only sandbox, so it must
  // never request an escalation outside that sandbox.
  return ['--sandbox', 'read-only', '--ask-for-approval', 'never']
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

function createExecutionId() {
  return randomUUID()
}

// TICKET-0070 (follow-up): title generation is a short, high-volume task, so
// use each provider's economical model instead of the interactive agent's
// selected model. It remains best-effort: if a model is unavailable, the
// renderer keeps the instant local fallback title.
const TITLE_MODELS = {
  claude: 'claude-haiku-4-5-20251001',
  codex: 'gpt-5.6-luna',
}
const TITLE_TIMEOUT_MS = 12000
const TITLE_MAX_LENGTH = 60

function buildTitleCommand(provider = 'claude') {
  if (provider === 'codex') {
    return {
      command: 'codex',
      args: ['exec', '--model', TITLE_MODELS.codex, ...buildCodexArgs('safe')],
    }
  }
  return {
    command: 'claude',
    args: [
      '--print', '--output-format', 'text', '--model', TITLE_MODELS.claude,
      ...buildPermissionArgs('safe'),
    ],
  }
}

// Cleans up the raw text a headless title-generation call returns: strips
// wrapping quotes/markdown emphasis the model sometimes adds despite being
// told not to, keeps only the first line (in case it answers in more than
// one despite instructions), and falls back to the same word-boundary
// truncation the local heuristic title used, as a hard safety net in case
// the model ignores the length instruction. Returns null for an empty/
// unusable result so the caller knows to keep its fallback title instead.
function sanitizeTitle(raw) {
  let text = raw.split('\n')[0]
    .trim()
    .replace(/^["'`*_]+|["'`*_]+$/g, '')
    .replace(/\.+$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return null
  if (text.length <= TITLE_MAX_LENGTH) return text
  const cut = text.slice(0, TITLE_MAX_LENGTH)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…'
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
    this.agents.set(agentId, { activeProc: null, meta, inputTokens: 0, outputTokens: 0, sessionId: null, tokscaleBaseline: null })
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
    const agent = { activeProc: null, meta, inputTokens: 0, outputTokens: 0, sessionId: sessionId || null, tokscaleBaseline: null }
    this.agents.set(agentId, agent)
    // Best-effort, non-blocking: without this, the first turn after a restore
    // would diff against a null baseline and see the *entire* session's
    // pre-restore usage as if it all belonged to that one turn.
    if (sessionId && provider === 'claude') {
      this._seedTokscaleBaseline(agent).catch(() => {})
    }
    return { agentId, meta }
  }

  async _seedTokscaleBaseline(agent) {
    const usageMap = await TokscaleService.getUsageMap([agent.meta.provider])
    const usage = usageMap.get(`${agent.meta.provider}:${agent.sessionId}`)
    if (usage && !agent.tokscaleBaseline) agent.tokscaleBaseline = usage
  }

  sendPrompt(agentId, prompt) {
    const agent = this.agents.get(agentId)
    if (!agent) return { error: 'Agent not found' }

    if (agent.activeProc) {
      return { error: 'This agent is already processing a prompt' }
    }

    const { meta } = agent
    const executionId = createExecutionId()

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
      // TICKET-0020: `codex exec` is the real Codex CLI's non-interactive
      // subcommand (analogous to Claude's --print); --json is its JSONL
      // event-stream equivalent of --output-format stream-json. Note: the
      // stdout parsers below (parseTokens/parseText/parseToolUse/etc.) are
      // shaped for Claude's stream-json schema and won't correctly
      // interpret Codex's own event schema yet — this fixes the process
      // actually starting, not full response/token parsing for it.
      args = ['exec', '--model', meta.model, '--json', ...buildCodexArgs(meta.permissionMode)]
    }

    const proc = spawn(meta.provider === 'claude' ? 'claude' : 'codex', args, {
      cwd: meta.projectPath,
      // Windows CLI installations are commonly .cmd shims and require a shell.
      // Arguments are selected by the application; prompt text is sent over stdin.
      shell: process.platform === 'win32',
      env: buildChildEnv(),
      windowsHide: true,
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

    let finished = false
    const finish = (code, error = null) => {
      if (finished) return
      finished = true
      if (lineBuffer.trim()) {
        processLine(lineBuffer.trim())
        lineBuffer = ''
      }
      if (agent.activeProc === proc) {
        agent.activeProc = null
      }
      const stdoutDelta = {
        input: agent.inputTokens - turnStartInput,
        output: agent.outputTokens - turnStartOutput,
      }
      this._emit('agent:prompt-done', {
        agentId,
        executionId,
        exitCode: code,
        error: error ? error.message : null,
        response: textBuffer,
        tokens: stdoutDelta,
        sessionId: agent.sessionId,
      })
      // Fire-and-forget: corrects the numbers above (adds cache tokens + real
      // cost, sourced from tokscale reading Claude's own session transcript)
      // once it resolves a moment later, instead of delaying the response
      // the user is waiting on. Claude only — see class doc on sessionId.
      this._reconcileTokens(agent, agentId, executionId, stdoutDelta).catch(() => {})
    }

    proc.on('error', (error) => {
      this._emit('agent:output', {
        agentId,
        text: `Unable to start ${meta.provider}: ${error.message}`,
        stream: 'stderr',
      })
      finish(null, error)
    })

    proc.on('close', (code) => finish(code))

    return { ok: true, executionId }
  }

  // Reconciles one turn's stdout-parsed token estimate against tokscale's
  // authoritative reading of the CLI's own session transcript. Only possible
  // for providers where a stable session id is captured (Claude, via
  // --resume/session_id) — codex is spawned stateless with no equivalent id
  // to match a tokscale row against, so it's skipped rather than guessed at.
  async _reconcileTokens(agent, agentId, executionId, stdoutDelta) {
    if (!agent.sessionId || agent.meta.provider !== 'claude') return

    const usageMap = await TokscaleService.getUsageMap([agent.meta.provider])
    const usage = usageMap.get(`${agent.meta.provider}:${agent.sessionId}`)
    if (!usage) return

    const baseline = agent.tokscaleBaseline || {
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0,
    }
    const delta = computeTokscaleDelta(usage, baseline)
    agent.tokscaleBaseline = usage

    // The lifetime counters already absorbed stdoutDelta when this turn's
    // stdout lines were parsed — correct them to the accurate figure instead
    // of double-counting.
    agent.inputTokens += delta.input - stdoutDelta.input
    agent.outputTokens += delta.output - stdoutDelta.output

    this._emit('agent:tokens-reconciled', {
      agentId,
      executionId,
      tokens: { input: delta.input, output: delta.output, cacheRead: delta.cacheRead, cacheCreation: delta.cacheCreation },
      costUsd: delta.cost,
    })
  }

  // TICKET-0070 (follow-up): turns the user's raw first-submitted line into a
  // short, meaningful title (e.g. "Fix login redirect bug" rather than a
  // truncated copy of the literal wording) via a one-off headless call to the
  // matching provider CLI. Deliberately separate from the agent's own interactive
  // session -- no --resume, nothing added to its history -- so this can
  // never consume the agent's turn or leak into its context. The inexpensive
  // default is Haiku for Claude and Luna for Codex.
  // Best-effort: resolves to null (never rejects) on any failure -- CLI
  // missing, non-zero exit, timeout, empty/unusable reply -- so the caller
  // can just keep the local heuristic title it already showed instantly.
  generateTitle(promptLine, cwd, provider = 'claude') {
    return new Promise((resolve) => {
      let settled = false
      const done = (value) => {
        if (settled) return
        settled = true
        resolve(value)
      }

      const instruction =
        'Summarize the following user request as a short title for a task list, ' +
        'focused on WHAT is being solved (the goal), not a restatement of the wording. ' +
        '3 to 6 words, title case, no ending punctuation, no quotes, no markdown. ' +
        'Reply with ONLY the title text and nothing else.\n\nRequest:\n' + promptLine

      let proc
      try {
        const titleCommand = buildTitleCommand(provider)
        proc = spawn(titleCommand.command, titleCommand.args, {
          cwd,
          shell: process.platform === 'win32',
          env: buildChildEnv(),
          windowsHide: true,
        })
      } catch (_) {
        return done(null)
      }

      const timer = setTimeout(() => {
        try { proc.kill('SIGTERM') } catch (_) {}
        done(null)
      }, TITLE_TIMEOUT_MS)

      let output = ''
      proc.stdout.on('data', (data) => { output += data.toString() })
      proc.stderr.on('data', () => {}) // best-effort call -- errors just fall through to done(null)
      proc.on('error', () => { clearTimeout(timer); done(null) })
      proc.on('close', (code) => {
        clearTimeout(timer)
        if (code !== 0) return done(null)
        done(sanitizeTitle(output))
      })

      proc.stdin.write(instruction)
      proc.stdin.end()
    })
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
    agent.tokscaleBaseline = null

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
      pid: a.activeProc?.pid || null,
      inputTokens: a.inputTokens, outputTokens: a.outputTokens,
    }))
  }
}

module.exports = {
  AgentService: new AgentService(),
  AgentServiceClass: AgentService,
  computeTokscaleDelta,
  buildPermissionArgs,
  buildCodexArgs,
  buildTitleCommand,
  parsePermissionDenials,
  parseSessionId,
  parseText,
  parseTokens,
  parseToolUse,
  sanitizeTitle,
}
