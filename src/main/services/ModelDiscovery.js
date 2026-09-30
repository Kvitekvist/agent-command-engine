const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { execFile } = require('node:child_process')
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

// Commands that make each CLI re-fetch its model list into the cache above
// without a model call: `/cost` is a local slash command (usage report only),
// and `codex debug models` refreshes then prints the catalog.
const REFRESH_ARGS = {
  claude: ['-p', '/cost', '--no-session-persistence'],
  codex: ['debug', 'models'],
}

// Best-effort and silent: a CLI that is missing, logged out or offline just
// leaves its existing cache (or none) in place.
function refreshCliCaches({ resolve = providerExecutable, run = execFile, timeoutMs = 60000 } = {}) {
  return Promise.all(Object.entries(REFRESH_ARGS).map(([provider, args]) => new Promise(done => {
    let command
    try { command = resolve(provider) } catch { return done() }
    run(command[0], [...command.slice(1), ...args], {
      env: buildChildEnv(), windowsHide: true, timeout: timeoutMs, cwd: os.homedir(),
    }, () => done())
  })))
}

async function refreshAndDiscoverModels(options) {
  await refreshCliCaches(options)
  return discoverModels(options?.home, options?.env)
}

module.exports = { discoverModels, refreshCliCaches, refreshAndDiscoverModels }
