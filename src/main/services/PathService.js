// TICKET-0060: a GUI-launched app on macOS/Linux (Finder, Dock, Spotlight)
// inherits only a minimal PATH -- roughly /usr/bin:/bin:/usr/sbin:/sbin -- not
// the PATH the user sees in their terminal. So ~/.local/bin, Homebrew, nvm,
// volta, etc. are all missing, and a packaged ACE can't find the `claude` /
// `codex` CLIs even when they're installed and run fine in a terminal. The
// agent PTY happens to still find them only because node-pty spawns an
// interactive shell that re-sources the user's rc file -- but the main-process
// `prereqs:check` (and any direct spawn) uses process.env.PATH raw, so it
// under-reports the CLIs as missing. Resolve the user's real login-shell PATH
// once at startup and merge it into process.env.PATH before anything spawns
// (the forked ptyHost inherits it too), so the whole app agrees on one PATH.
const { execFileSync } = require('child_process')

// Wrap the PATH in a marker so it can be extracted cleanly even when the
// user's rc files print banners / MOTD / other noise to stdout on an
// interactive login shell. Exported for unit testing.
const MARKER = '__ACE_PATH__'

// Pulls the marked PATH out of a login-shell's stdout, tolerating any preamble
// or trailing output around it. Returns null when no marked value is present.
function parseShellPath(output) {
  const text = String(output == null ? '' : output)
  const start = text.indexOf(MARKER)
  if (start === -1) return null
  const rest = text.slice(start + MARKER.length)
  const end = rest.indexOf(MARKER)
  if (end === -1) return null
  const value = rest.slice(0, end).trim()
  return value || null
}

// Union the resolved login-shell PATH with whatever is already inherited:
// prefer the login-shell ordering, but keep any inherited entry it happens to
// omit so we never lose a directory. Exported for unit testing.
function mergePaths(loginPath, currentPath) {
  const merged = String(loginPath || '').split(':').filter(Boolean)
  const seen = new Set(merged)
  for (const dir of String(currentPath || '').split(':').filter(Boolean)) {
    if (!seen.has(dir)) { merged.push(dir); seen.add(dir) }
  }
  return merged.join(':')
}

// Resolve and apply the login-shell PATH. No-op on Windows, where GUI
// processes already inherit the full user + system PATH. Fails open: any
// error (missing shell, a slow or interactive-blocking rc file caught by the
// timeout, an rc that never prints the marker) leaves the inherited PATH
// untouched, i.e. the pre-TICKET-0060 behavior.
function applyLoginShellPath() {
  if (process.platform === 'win32') return
  const shell = process.env.SHELL || '/bin/zsh'
  try {
    // -i (interactive) so ~/.zshrc / ~/.bashrc -- where ~/.local/bin and the
    // like are usually added -- are sourced; -l (login) for ~/.zprofile etc.;
    // -c to run the one command. printf (not echo) so no trailing newline
    // muddies the value. stderr ignored: an interactive shell without a tty
    // often warns ("no job control"), which is harmless here.
    const out = execFileSync(shell, ['-ilc', `printf %s "${MARKER}$PATH${MARKER}"`], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const resolved = parseShellPath(out)
    if (resolved) process.env.PATH = mergePaths(resolved, process.env.PATH)
  } catch (_) {
    // Keep the inherited PATH -- worst case is the prior behavior.
  }
}

module.exports = { applyLoginShellPath, parseShellPath, mergePaths, MARKER }
