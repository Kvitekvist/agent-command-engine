const { spawn } = require('child_process')
const path = require('path')

// tokscale reads Claude Code's/Codex's own local session transcript files
// (~/.claude/projects, ~/.codex/sessions) and reports already-computed
// token + cost totals per session — far more accurate than parsing live CLI
// stdout, since it captures cache tokens too and needs no per-provider
// output-format flag. It ships as a Node shim (tokscale/bin.js -> @tokscale/cli)
// that, at runtime, locates the right native platform binary (an optional
// dependency, e.g. @tokscale/cli-darwin-arm64) relative to its OWN module
// location and runs it via spawnSync (see @tokscale/cli/dist/index.js). That
// works from a normal node_modules tree but breaks two ways inside a packaged
// Electron app:
//   1. Windows: the inner spawnSync doesn't set windowsHide, so it flashes a
//      console window every poll (TICKET-0029).
//   2. Every OS: the shim finds its binary INSIDE app.asar (existsSync returns
//      true there because Electron patches fs), then tries to exec a file that
//      lives in the virtual archive — which the OS cannot do. It exits 1 with
//      no output, so every tokscale call returns nothing and the whole Token
//      Usage tab reads 0. TICKET-0029 dodged both by bypassing the shim, but
//      ONLY on win32; macOS/Linux still went through it, so a packaged mac
//      build showed 0 usage everywhere (TICKET-0100).
// So on every platform we skip the shim and invoke the native binary package
// directly, redirecting an app.asar path to its unpacked sibling. Each native
// package's `main` field IS its `bin/tokscale[.exe]` executable, so
// require.resolve returns the binary path itself.

// Maps the current platform+arch to tokscale's native binary package. Exported
// for unit testing. Returns null for a platform/arch tokscale doesn't ship, so
// runTokscale can fall back to the JS shim. Linux resolves the glibc (gnu)
// build: ACE packages and runs against glibc (electron-builder default, CI
// ubuntu); the musl variants aren't bundled.
function nativePackageFor(platform, arch) {
  if (platform === 'win32') return arch === 'arm64' ? '@tokscale/cli-win32-arm64-msvc' : '@tokscale/cli-win32-x64-msvc'
  if (platform === 'darwin') return arch === 'arm64' ? '@tokscale/cli-darwin-arm64' : '@tokscale/cli-darwin-x64'
  if (platform === 'linux') return arch === 'arm64' ? '@tokscale/cli-linux-arm64-gnu' : '@tokscale/cli-linux-x64-gnu'
  return null
}

// Redirects a path that points inside an app.asar archive to its unpacked
// sibling (app.asar.unpacked), where asarUnpack (package.json) places a real,
// spawnable copy. Outside a packaged app there is no app.asar segment, so this
// is a no-op. Exported for unit testing; `sep` is injectable so the Windows
// separator can be tested on any host.
function redirectAsarToUnpacked(resolvedPath, sep = path.sep) {
  return resolvedPath.split(`${sep}app.asar${sep}`).join(`${sep}app.asar.unpacked${sep}`)
}

function resolveNativeBinary() {
  const pkg = nativePackageFor(process.platform, process.arch)
  if (!pkg) return null
  try {
    // The native package's `main` is its bin/tokscale executable, so this
    // resolves straight to the binary path.
    return redirectAsarToUnpacked(require.resolve(pkg))
  } catch (error) {
    return null
  }
}

function runTokscale(args, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const nativeBinary = resolveNativeBinary()

    let child
    if (nativeBinary) {
      child = spawn(nativeBinary, args, { windowsHide: true })
    } else {
      // Fallback for a platform/arch with no native package, or a dev machine
      // that skipped optional deps: go through the JS shim via the
      // ELECTRON_RUN_AS_NODE trick. (Inside a packaged app this is the broken
      // path above, but we only reach it when there's no native binary to run.)
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
        resolve(extractJson(stdout))
      } catch (error) {
        reject(new Error(`Could not parse tokscale JSON output: ${stdout.slice(0, 300)}`))
      }
    })
  })
}

// tokscale writes its data as JSON to stdout, but the `report` subcommand also
// emits a plain-text status line ("<N> new sessions added to wiki") the first
// time it catalogs previously-unseen sessions -- and that line can land on
// stdout, prepended to the JSON. A bare JSON.parse(stdout) then throws on that
// otherwise-successful run, which getWorkspaceReport swallows into an empty
// History (working only on a later refresh once the sessions are catalogued).
// Slice from the first JSON opener so any human-readable preamble is dropped
// before parsing. Exported for unit testing. Originally TICKET-0061; that
// commit was blanket-reverted (b1ad161) and only its sibling arg-parsing fix
// was re-applied (TICKET-0067), so the macOS History regression returned and
// this is re-applied under TICKET-0098.
function extractJson(stdout) {
  const text = String(stdout == null ? '' : stdout)
  const opens = [text.indexOf('{'), text.indexOf('[')].filter((i) => i >= 0)
  const closes = [text.lastIndexOf('}'), text.lastIndexOf(']')]
  const start = opens.length ? Math.min(...opens) : -1
  const end = Math.max(...closes)
  // No JSON delimiters at all -> let JSON.parse throw on the raw text, so a
  // genuinely broken/empty output still surfaces as a parse error.
  if (start === -1 || end < start) return JSON.parse(text)
  return JSON.parse(text.slice(start, end + 1))
}

function sessionKey(client, sessionId) {
  return `${client}:${sessionId}`
}

// tokscale reports a workspace by its Claude Code project-dir key, where every
// path separator (and other non-alphanumerics) is flattened to a dash, e.g.
// "C--Users-Jane-Documents-VS-Code-ACE". The UI only wants the leaf folder
// name ("ACE"), so take the last dash-delimited segment. A folder name that
// itself contains dashes can't be recovered unambiguously from this key, so
// this is best-effort; callers keep the full key around for the tooltip
// (TICKET-0042).
function shortenWorkspace(label) {
  if (!label) return 'unknown'
  const segments = String(label).split('-').filter(Boolean)
  return segments.length ? segments[segments.length - 1] : String(label)
}

// The inverse of shortenWorkspace's assumption: turn a real filesystem path
// into the workspace key tokscale/Claude Code use, by flattening every
// non-alphanumeric character to a single dash. Verified against a real key
// ("C:\Users\Jane\Documents\VS Code\ACE" -> "C--Users-Jane-Documents-VS-Code-ACE").
// Used to scope tokscale's per-workspace report to one ACE project (TICKET-0044).
function pathToWorkspaceKey(projectPath) {
  return String(projectPath || '').replace(/[^a-zA-Z0-9]/g, '-')
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
  // ACE never touches auth tokens itself. Returns tokscale's array as-is
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
    for (const client of clients) result[client] = { models: new Map(), projects: new Map(), totalTokens: 0, totalCost: 0 }

    for (const entry of entries) {
      const bucket = result[entry.client]
      if (!bucket) continue
      const tokens = rowTokenTotal(entry)
      const cost = Number(entry.cost) || 0
      bucket.totalTokens += tokens
      bucket.totalCost += cost
      bucket.models.set(entry.model, (bucket.models.get(entry.model) || 0) + tokens)
      // Key by the full workspace label so two distinct paths never merge, but
      // keep it around so the UI can show the leaf folder name and still expose
      // the full key on hover (TICKET-0042).
      const project = entry.workspaceLabel || entry.workspaceKey || 'unknown'
      bucket.projects.set(project, (bucket.projects.get(project) || 0) + tokens)
    }

    for (const client of clients) {
      result[client] = {
        totalTokens: result[client].totalTokens,
        totalCost: result[client].totalCost,
        models: [...result[client].models].map(([name, tokens]) => ({ name, tokens })).sort((a, b) => b.tokens - a.tokens),
        projects: [...result[client].projects]
          .map(([fullName, tokens]) => ({ name: shortenWorkspace(fullName), fullName, tokens }))
          .sort((a, b) => b.tokens - a.tokens),
      }
    }
    return result
  },

  // TICKET-0044: all-time, per-session usage for ONE workspace — the source
  // for the Token Usage tab's "History (this project)" section, which used to
  // read ACE's own `prompts` table (dead since TICKET-0019). `tokscale report`
  // is the only mode that returns per-session rows carrying a `created_at`
  // timestamp and `session_id`, which the History section needs for its By Day
  // breakdown and to join sessions back to ACE agent names (see DBService
  // agent_sessions). `--no-summarize` skips the optional LLM titling so this
  // stays a pure, fast data read. `report --workspace` filters server-side to
  // the one workspace; its `--client` is singular (comma-separated values are
  // silently treated as one unknown client and return nothing), so call it
  // once per client and merge, tagging each row with the client it came from.
  async getWorkspaceReport(workspaceKey, clients) {
    const perClient = await Promise.all(
      clients.map(async (client) => {
        try {
          // TICKET-0067 (re-applies reverted TICKET-0059): pass the workspace
          // as `--workspace=<key>`, one argv token. Every macOS/Linux workspace
          // key starts with "-" (pathToWorkspaceKey flattens the path's leading
          // "/" to "-"); as a separate token tokscale's CLI parser misreads it
          // as an unknown flag ("unexpected argument '-U' found", exit 2) and
          // the per-client error below is swallowed, blanking History. The
          // `=`-form is unambiguous. Windows keys start with a drive letter, so
          // they were never affected. Verified live against the real binary.
          const rows = await runTokscale([
            'report', '--json', '--no-summarize',
            `--workspace=${workspaceKey}`,
            '--client', client,
          ], 30000)
          return Array.isArray(rows) ? rows.map((r) => ({ ...r, client })) : []
        } catch (error) {
          // One provider being unavailable (logged out, not installed) must
          // not blank out the other's history. Log it, though -- silently
          // returning [] here made a broken tokscale call indistinguishable
          // from a genuinely empty project (TICKET-0098).
          console.warn(`[tokscale] report failed for client "${client}", workspace "${workspaceKey}": ${error.message}`)
          return []
        }
      })
    )
    return perClient.flat()
  },

  sessionKey,
  pathToWorkspaceKey,
}

module.exports = { TokscaleService, sessionKey, toUsageMap, rowTokenTotal, shortenWorkspace, pathToWorkspaceKey, extractJson, nativePackageFor, redirectAsarToUnpacked }
