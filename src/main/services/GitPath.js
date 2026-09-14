const fs = require('node:fs')
const path = require('node:path')

// MinGit is already bundled by scripts/fetch-mingit.js ("for users who don't
// have Git on PATH") but nothing wired it in -- handlers.js's git:pull and
// prereqs:check both spawn bare `git`, inheriting process.env.PATH. Prepend
// the bundled copy once at startup (only when git isn't already resolvable)
// and every one of those call sites picks it up automatically -- including
// agent terminals, since TerminalService forks ptyHost with process.env and
// ptyHost spawns PTYs with its own process.env in turn.

function isGitOnPath(pathEnv, platform) {
  const exe = platform === 'win32' ? 'git.exe' : 'git'
  return (pathEnv || '').split(path.delimiter).filter(Boolean)
    .some(dir => fs.existsSync(path.join(dir, exe)))
}

function bundledGitCmdDir({ packaged, resourcesPath, appPath, platform }) {
  if (platform !== 'win32') return null
  const base = packaged ? path.join(resourcesPath, 'mingit') : path.join(appPath, 'resources', 'mingit')
  const cmdDir = path.join(base, 'cmd')
  return fs.existsSync(path.join(cmdDir, 'git.exe')) ? cmdDir : null
}

// Mutates env.PATH in place. Returns whether the bundled copy was added.
function ensureGitOnPath({ env = process.env, platform = process.platform, packaged, resourcesPath, appPath } = {}) {
  if (isGitOnPath(env.PATH, platform)) return false
  const cmdDir = bundledGitCmdDir({ packaged, resourcesPath, appPath, platform })
  if (!cmdDir) return false
  env.PATH = cmdDir + path.delimiter + (env.PATH || '')
  return true
}

module.exports = { ensureGitOnPath, isGitOnPath, bundledGitCmdDir }
