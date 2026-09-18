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

module.exports = { ensureShellPath, loginShellPath, isOnPath }
