const fs = require('node:fs')
const path = require('node:path')
// Not destructured at load time -- tests mock child_process.spawnSync on the
// module object (t.mock.method), which a `const { spawnSync } = require(...)`
// captured here would miss.
const child_process = require('node:child_process')

// TICKET-0153: an app launched from Finder/Dock (not a terminal) inherits
// launchd's minimal default PATH (/usr/bin:/bin:/usr/sbin:/sbin), not the
// interactive login shell's PATH that .zshrc/.zprofile/.bash_profile build
// up -- which is where Homebrew, nvm, and most other Node install methods
// add themselves. So prereqs:check's bare `spawn('node', ...)` can report
// Node.js missing even though it works fine in Terminal on the same
// machine. GitPath.js already solved this class of problem for git, but
// Windows-only (bundled MinGit); this is the macOS/Linux equivalent, same
// approach the `fix-path` npm package uses: ask the user's own login shell
// for its PATH once, at startup, and every spawn after this (prereq checks,
// agent terminals via TerminalService/ptyHost, git) inherits it.

function isOnPath(cmd, pathEnv) {
  return (pathEnv || '').split(path.delimiter).filter(Boolean)
    .some(dir => { try { return fs.existsSync(path.join(dir, cmd)) } catch (_) { return false } })
}

// Spawns the user's login shell once and returns its PATH, or null on any
// failure (unusual $SHELL, timeout, no output) -- callers should leave
// env.PATH untouched in that case rather than fail startup over it.
function loginShellPath({ env = process.env, platform = process.platform } = {}) {
  if (platform === 'win32') return null
  const shell = env.SHELL || '/bin/zsh'
  const marker = '__ACE_PATH__'
  let result
  try {
    result = child_process.spawnSync(shell, ['-ilc', `echo ${marker}"$PATH"${marker}`], { timeout: 5000, encoding: 'utf8' })
  } catch (_) {
    return null
  }
  if (!result || result.error || !result.stdout) return null
  const match = result.stdout.match(new RegExp(`${marker}(.*)${marker}`, 's'))
  return match ? match[1].trim() || null : null
}

// Mutates env.PATH in place. Returns whether it changed.
function ensureShellPath({ env = process.env, platform = process.platform } = {}) {
  if (platform === 'win32' || isOnPath('node', env.PATH)) return false
  const shellPath = loginShellPath({ env, platform })
  if (!shellPath || shellPath === env.PATH) return false
  env.PATH = shellPath
  return true
}

// A restarted child still inherits its parent's stale PATH. Read the saved
// Windows values directly and retain process-only entries such as MinGit.
function refreshWindowsPath({ env = process.env, platform = process.platform } = {}) {
  if (platform !== 'win32') return false
  let result
  try {
    result = child_process.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Environment]::GetEnvironmentVariable('Path', 'Machine'); [Environment]::GetEnvironmentVariable('Path', 'User')",
    ], { windowsHide: true, timeout: 5000, encoding: 'utf8' })
  } catch (_) { return false }
  if (result.error || result.status !== 0 || !result.stdout?.trim()) return false
  const key = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH'
  const entries = [env[key] || '', result.stdout.trim().replace(/\r?\n/g, ';')].join(';').split(';').filter(Boolean)
  const seen = new Set()
  const updated = entries.filter(entry => {
    const normalized = entry.toLowerCase()
    if (seen.has(normalized)) return false
    seen.add(normalized)
    return true
  }).join(';')
  const changed = updated !== env[key]
  env[key] = updated
  return changed
}

// TICKET-0160: on Windows ACE installs the Claude/Codex CLIs into its own npm
// prefix instead of npm's global %APPDATA%\npm. The Store (MSIX) build
// redirects a packaged app's AppData writes into a private copy that agent
// terminals can't see; the user profile and HKCU\Environment are not
// redirected, so this folder works for both the packaged and .exe builds.
function aceNpmPrefix({ env = process.env, platform = process.platform } = {}) {
  if (platform !== 'win32') return null
  return path.join(env.USERPROFILE || require('node:os').homedir(), '.ace', 'npm')
}

// Appends the prefix to this process's PATH so prereq checks, providerExecutable
// and agent terminals find CLIs installed there. Returns whether it changed.
function ensureAceNpmOnPath({ env = process.env, platform = process.platform } = {}) {
  const prefix = aceNpmPrefix({ env, platform })
  if (!prefix) return false
  const key = Object.keys(env).find(key => key.toLowerCase() === 'path') || 'PATH'
  const entries = (env[key] || '').split(';').filter(Boolean)
  if (entries.some(entry => entry.toLowerCase() === prefix.toLowerCase())) return false
  env[key] = [...entries, prefix].join(';')
  return true
}

// Persists a folder on the user's saved PATH so the user's own terminals find
// the CLIs too. Keeps the value's REG_EXPAND_SZ form and unexpanded %VARS%,
// and broadcasts the change so newly opened terminals pick it up.
function addToUserPath(dir, { platform = process.platform } = {}) {
  if (platform !== 'win32') return false
  const script = [
    "$k = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)",
    "$v = [string]$k.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)",
    "if (($v -split ';') -contains $env:ACE_PATH_DIR) { exit 0 }",
    "$parts = @($v.TrimEnd(';'), $env:ACE_PATH_DIR) | Where-Object { $_ }",
    "$k.SetValue('Path', ($parts -join ';'), [Microsoft.Win32.RegistryValueKind]::ExpandString)",
    "[Environment]::SetEnvironmentVariable('ACE_PATH_BROADCAST', '1', 'User'); [Environment]::SetEnvironmentVariable('ACE_PATH_BROADCAST', $null, 'User')",
  ].join('; ')
  try {
    const result = child_process.spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true, timeout: 10000, env: { ...process.env, ACE_PATH_DIR: dir },
    })
    return !result.error && result.status === 0
  } catch (_) { return false }
}

module.exports = { ensureShellPath, loginShellPath, isOnPath, refreshWindowsPath, aceNpmPrefix, ensureAceNpmOnPath, addToUserPath }
