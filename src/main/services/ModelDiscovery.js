const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFile, spawn } = require('node:child_process')
const { providerExecutable } = require('./ProviderExecutable')
const { buildChildEnv } = require('./AgentService')

// Both subscription CLIs keep the model list they fetched from their vendor
// on disk and refresh it themselves on every run, so reading those caches
// picks up new releases without an API key. Neither file is a public
// contract; a missing or reshaped cache yields [] for that provider rather
// than an error, and the static catalog in modelCatalog.js still applies.

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

// ~/.claude/cache/model-catalog/<uuid>-cc.json: catalog.config.models[]
function claudeModels(home) {
  const dir = path.join(home, '.claude', 'cache', 'model-catalog')
  let files
  try { files = fs.readdirSync(dir).filter(f => f.endsWith('-cc.json')) } catch { return [] }
  const newest = files
    .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)[0]
  const models = newest && readJson(path.join(dir, newest.f))?.catalog?.config?.models
  if (!Array.isArray(models)) return []
  return models
    .filter(m => typeof m?.id === 'string')
    .map(m => ({ id: m.id, label: m.name ? `Claude ${m.name}` : m.id, description: m.description || '' }))
}

// ~/.codex/models_cache.json: models[], hidden entries are internal.
function codexModels(home) {
  const models = readJson(path.join(home, '.codex', 'models_cache.json'))?.models
  if (!Array.isArray(models)) return []
  return models
    .filter(m => typeof m?.slug === 'string' && m.visibility === 'list')
    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
    .map(m => ({ id: m.slug, label: m.display_name || m.slug, description: m.description || '' }))
}

// Enterprise-gateway and API logins never write the model-catalog cache;
// their models are pinned with these variables instead, either in the
// environment or in the `env` block of ~/.claude/settings.json (which
// Claude Code applies to every session). Read both so the Models button
// finds them.
const PINNED_MODEL_VARS = ['ANTHROPIC_MODEL', 'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL', 'ANTHROPIC_DEFAULT_HAIKU_MODEL']

function pinnedClaudeModels(home, env) {
  const settingsEnv = readJson(path.join(home, '.claude', 'settings.json'))?.env || {}
  const models = []
  for (const key of PINNED_MODEL_VARS) {
    for (const value of [env[key], settingsEnv[key]]) {
      if (typeof value !== 'string' || !value.trim()) continue
      models.push({ id: value.trim(), label: value.trim(), description: `Pinned in your Claude settings (${key})` })
    }
  }
  return models
}

function discoverModels(home = os.homedir(), env = process.env) {
  const seen = new Set()
  const claude = [...claudeModels(home), ...pinnedClaudeModels(home, env)]
    .filter(m => !seen.has(m.id) && seen.add(m.id))
  return { claude, codex: codexModels(home) }
}

// Claude Code answers an Agent SDK `initialize` control request with the
// exact list its /model menu shows, built from whatever login it runs under --
// including the models an enterprise gateway exposes -- without a model call.
const CLAUDE_LIST_ARGS = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', '--no-session-persistence']
const INITIALIZE_REQUEST = JSON.stringify({ type: 'control_request', request_id: 'ace-models', request: { subtype: 'initialize' } }) + '\n'

// /model entries are aliases (`opus`, `sonnet[1m]`) or concrete ids; keep the
// concrete id so the dropdown value is what --model receives. "Default" only
// counts when it points at a model no other entry lists.
function modelsFromInitialize(models) {
  if (!Array.isArray(models)) return []
  const ordered = [...models.filter(m => m?.value !== 'default'), ...models.filter(m => m?.value === 'default')]
  const seen = new Set()
  const out = []
  for (const m of ordered) {
    const id = [m?.value, m?.resolvedModel].find(v => typeof v === 'string' && v.startsWith('claude-'))
      || (typeof m?.value === 'string' && m.value !== 'default' ? m.value : null)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const name = typeof m.displayName === 'string' && m.displayName ? m.displayName : id
    out.push({ id, label: /^claude/i.test(name) ? name : `Claude ${name}`, description: typeof m.description === 'string' ? m.description : '' })
  }
  return out
}

// Resolves to the /model list, or null when the CLI is missing, too old to
// answer, logged out or slow -- the caller then falls back to the caches.
function listClaudeModels({ resolve = providerExecutable, spawnFn = spawn, timeoutMs = 60000 } = {}) {
  return new Promise(done => {
    let command
    let child
    try {
      command = resolve('claude')
      child = spawnFn(command[0], [...command.slice(1), ...CLAUDE_LIST_ARGS], { env: buildChildEnv(), windowsHide: true, cwd: os.homedir() })
    } catch { return done(null) }
    let settled = false
    let buffer = ''
    const finish = (models) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { child.kill() } catch {}
      done(models)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    child.on('error', () => finish(null))
    child.on('close', () => finish(null))
    child.stdout.setEncoding?.('utf8')
    child.stdout.on('data', (chunk) => {
      buffer += chunk
      let newline
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline)
        buffer = buffer.slice(newline + 1)
        let message
        try { message = JSON.parse(line) } catch { continue }
        if (message?.type !== 'control_response' || message.response?.request_id !== 'ace-models') continue
        const models = modelsFromInitialize(message.response.response?.models)
        finish(models.length ? models : null)
      }
    })
    child.stdin.on('error', () => {})
    child.stdin.end(INITIALIZE_REQUEST)
  })
}

// Commands that make each CLI re-fetch its model list into the cache above
// without a model call: `/cost` is a local slash command (usage report only),
// and `codex debug models` refreshes then prints the catalog.
const REFRESH_ARGS = {
  claude: ['-p', '/cost', '--no-session-persistence'],
  codex: ['debug', 'models'],
}

// Best-effort and silent: a CLI that is missing, logged out or offline just
// leaves its existing cache (or none) in place.
function refreshCliCaches({ resolve = providerExecutable, run = execFile, timeoutMs = 60000, providers = Object.keys(REFRESH_ARGS) } = {}) {
  return Promise.all(providers.map((provider) => new Promise(done => {
    let command
    try { command = resolve(provider) } catch { return done() }
    run(command[0], [...command.slice(1), ...REFRESH_ARGS[provider]], {
      env: buildChildEnv(), windowsHide: true, timeout: timeoutMs, cwd: os.homedir(),
    }, () => done())
  })))
}

// Claude: the CLI's own /model list when it can give one, else its cache and
// pinned variables. Codex: its refreshed cache.
async function refreshAndDiscoverModels(options = {}) {
  const [claudeFromCli] = await Promise.all([listClaudeModels(options), refreshCliCaches({ ...options, providers: ['codex'] })])
  if (!claudeFromCli) await refreshCliCaches({ ...options, providers: ['claude'] })
  const found = discoverModels(options.home, options.env)
  return claudeFromCli ? { ...found, claude: claudeFromCli } : found
}

module.exports = { discoverModels, refreshCliCaches, refreshAndDiscoverModels, listClaudeModels, modelsFromInitialize }
