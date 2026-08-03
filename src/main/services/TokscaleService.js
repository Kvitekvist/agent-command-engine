const { spawn } = require('child_process')

// tokscale reads Claude Code's/Codex's own local session transcript files
// (~/.claude/projects, ~/.codex/sessions) and reports already-computed
// token + cost totals per session — far more accurate than parsing live CLI
// stdout, since it captures cache tokens too and needs no per-provider
// output-format flag. It ships as a Node shim (tokscale/bin.js) that
// resolves the right native platform binary as an optional dependency, so
// spawning it as plain JS through node/electron works everywhere.
//
// Electron's own binary is not Node — ELECTRON_RUN_AS_NODE makes it behave
// like one for this one subprocess, same trick the reference project
// (token-monitor) uses to run tokscale from inside an Electron main process.
function resolveBinPath() {
  return require.resolve('tokscale/bin.js')
}

function runTokscale(args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let binPath
    try {
      binPath = resolveBinPath()
    } catch (error) {
      reject(error)
      return
    }

    const child = spawn(process.execPath, [binPath, ...args], {
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      windowsHide: true,
    })

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

  sessionKey,
}

module.exports = { TokscaleService, sessionKey, toUsageMap }
