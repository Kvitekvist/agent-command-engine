const { spawn } = require('child_process')

// tokscale reads Claude Code's/Codex's own local session transcript files
// (~/.claude/projects, ~/.codex/sessions) and reports already-computed
// token + cost totals per session — far more accurate than parsing live CLI
// stdout, since it captures cache tokens too and needs no per-provider
// output-format flag. It ships as a Node shim (tokscale/bin.js) that
// resolves the right native platform binary as an optional dependency and
// runs it via a bare, un-hidden `spawnSync` (see @tokscale/cli/dist/index.js)
// — fine on a real terminal, but on Windows that inner spawn briefly flashes
// a visible console window every poll, since `spawnSync` there doesn't set
// `windowsHide`. That's not our code to fix, so on win32 we skip the JS
// shim entirely and invoke the platform binary package directly ourselves
// with `windowsHide: true` (TICKET-0029). Elsewhere, go through the shim as
// before via the ELECTRON_RUN_AS_NODE trick (same one the reference project,
// token-monitor, uses to run tokscale from inside an Electron main process).
function resolveWindowsBinary() {
  const pkg = process.arch === 'arm64' ? '@tokscale/cli-win32-arm64-msvc' : '@tokscale/cli-win32-x64-msvc'
  try {
    return require.resolve(pkg)
  } catch (error) {
    return null
  }
}

function runTokscale(args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const windowsBinary = process.platform === 'win32' ? resolveWindowsBinary() : null

    let child
    if (windowsBinary) {
      child = spawn(windowsBinary, args, { windowsHide: true })
    } else {
      let binPath
      try {
        binPath = require.resolve('tokscale/bin.js')
      } catch (error) {
        reject(error)
        return
      }
      child = spawn(process.execPath, [binPath, ...args], {
        env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
        windowsHide: true,
      })
    }

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error(`tokscale timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.on('error', (error) => { clearTimeout(timer); reject(error) })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error(`tokscale exited with code ${code}: ${(stderr || stdout).trim().slice(0, 300)}`))
        return
      }
      try {
        resolve(JSON.parse(stdout))
      } catch (error) {
        reject(new Error(`Could not parse tokscale JSON output: ${stdout.slice(0, 300)}`))
      }
    })
  })
}

function sessionKey(client, sessionId) {
  return `${client}:${sessionId}`
}

// Sums every model row belonging to the same session into one usage
// object. A session almost always uses one model throughout, but nothing
// stops that (e.g. a manual model switch mid-session), so this must sum
// rather than assume a single row per session.
function toUsageMap(json) {
  const map = new Map()
  const entries = Array.isArray(json?.entries) ? json.entries : []
  for (const entry of entries) {
    if (!entry?.client || !entry?.sessionId) continue
    const key = sessionKey(entry.client, entry.sessionId)
    const existing = map.get(key) || {
      inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costUsd: 0,
    }
    existing.inputTokens += Number(entry.input) || 0
    existing.outputTokens += Number(entry.output) || 0
    existing.cacheReadTokens += Number(entry.cacheRead) || 0
    existing.cacheCreationTokens += Number(entry.cacheWrite) || 0
    existing.costUsd += Number(entry.cost) || 0
    map.set(key, existing)
  }
  return map
}

// TICKET-0022: total tokens for one tokscale row, matching the formula the
// reference project (token-monitor, see usage.js) uses -- reasoning tokens
// are deliberately excluded since Codex/OpenAI already counts them inside
// `output`, so adding them again would double-count.
function rowTokenTotal(entry) {
  return (Number(entry.input) || 0)
    + (Number(entry.output) || 0)
    + (Number(entry.cacheRead) || 0)
    + (Number(entry.cacheWrite) || 0)
}

const TokscaleService = {
  // All-time cumulative usage per session, grouped by client/session/model.
  // No date filter: agent sessions can span more than a day, and per-agent
  // reconciliation already tracks its own cumulative baseline to turn this
  // into a per-turn delta (see AgentService).
  async getUsageMap(clients) {
    const json = await runTokscale([
      '--json', '--client', clients.join(','),
      '--group-by', 'client,session,model',
      '--no-spinner',
    ])
    return toUsageMap(json)
  },

  // TICKET-0022: real subscription quota (5-hour rolling / weekly limits +
  // reset times) straight from tokscale's own `usage` subcommand, which
  // reads the same local OAuth credentials Claude Code/Codex already use --
  // CPI never touches auth tokens itself. Returns tokscale's array as-is
  // (one entry per provider); callers key it by `provider` (case-varies,
  // e.g. "Claude"/"Codex").
  async getQuota() {
    return runTokscale(['usage', '--json'])
  },

  // TICKET-0022: today's usage, broken down by project and by model in one
  // call -- rows carry both `workspaceLabel` and `model`, rolled up
  // client-side into the two breakdowns the UsageCard needs.
  async getTodayBreakdown(clients) {
    const json = await runTokscale([
      '--json', '--today', '--client', clients.join(','),
      '--group-by', 'workspace,model',
      '--no-spinner',
    ])
    const entries = Array.isArray(json?.entries) ? json.entries : []

    const result = {}
    for (const client of clients) result[client] = { models: new Map(), projects: new Map(), totalTokens: 0 }

    for (const entry of entries) {
      const bucket = result[entry.client]
      if (!bucket) continue
      const tokens = rowTokenTotal(entry)
      bucket.totalTokens += tokens
      bucket.models.set(entry.model, (bucket.models.get(entry.model) || 0) + tokens)
      const project = entry.workspaceLabel || entry.workspaceKey || 'unknown'
      bucket.projects.set(project, (bucket.projects.get(project) || 0) + tokens)
    }

    for (const client of clients) {
      result[client] = {
        totalTokens: result[client].totalTokens,
        models: [...result[client].models].map(([name, tokens]) => ({ name, tokens })).sort((a, b) => b.tokens - a.tokens),
        projects: [...result[client].projects].map(([name, tokens]) => ({ name, tokens })).sort((a, b) => b.tokens - a.tokens),
      }
    }
    return result
  },

  sessionKey,
}

module.exports = { TokscaleService, sessionKey, toUsageMap, rowTokenTotal }
