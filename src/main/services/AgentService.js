const { spawn } = require('child_process')
const { randomUUID } = require('crypto')
const { EventEmitter } = require('events')

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
    this.agents.set(agentId, { activeProc: null, meta, inputTokens: 0, outputTokens: 0, sessionId: null })
    this._emit('agent:status', { agentId, status: 'running', meta })
    return { agentId, meta }
  }

  // Re-register an agent that was persisted in a previous run (app reopened,
  // or the project was reselected) so the lifecycle handlers (stop, delete,
  // getRunning) recognise it again. The live conversation runs in the
  // renderer's PTY-backed terminal (AgentTerminal.jsx), not here.
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
  buildPermissionArgs,
  buildCodexArgs,
  buildTitleCommand,
  sanitizeTitle,
}
