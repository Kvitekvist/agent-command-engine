// TICKET-0066: node-pty execs the user's shell through a small native helper
// binary, `spawn-helper`, on POSIX platforms (macOS/Linux). That helper MUST
// carry the executable bit or node-pty fails at spawn time with the opaque
// `posix_spawnp failed` error -- exactly what broke new agent terminals on
// macOS while Windows (which uses ConPTY and has no spawn-helper) was fine.
//
// Some package-manager / archive-extraction paths drop the +x bit on files in
// node_modules, so restoring it once by hand isn't durable. This runs as a
// `postinstall` step to re-assert it after every install. No-op on Windows.
const fs = require('fs')
const path = require('path')

function chmodExec(file) {
  try {
    fs.chmodSync(file, 0o755)
    return true
  } catch (_) {
    return false
  }
}

// Walks a directory tree looking for files literally named `spawn-helper`.
// node-pty keeps them under prebuilds/<platform>-<arch>/ (prebuilt installs)
// and/or build/Release/ (compiled-from-source installs); we cover both by
// just scanning the whole node-pty folder rather than hardcoding paths that
// shift between node-pty versions and install modes.
function findSpawnHelpers(dir, found = []) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch (_) {
    return found
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      findSpawnHelpers(full, found)
    } else if (entry.name === 'spawn-helper') {
      found.push(full)
    }
  }
  return found
}

function main() {
  if (process.platform === 'win32') return

  const ptyRoot = path.join(__dirname, '..', 'node_modules', 'node-pty')
  const helpers = findSpawnHelpers(ptyRoot)
  if (!helpers.length) {
    // Not fatal: node-pty may not be installed (e.g. a renderer-only install)
    // or its layout changed. Warn rather than fail the whole install.
    console.warn('[fix-pty-perms] no spawn-helper found under', ptyRoot)
    return
  }
  for (const helper of helpers) {
    if (chmodExec(helper)) {
      console.log('[fix-pty-perms] chmod +x', path.relative(ptyRoot, helper))
    } else {
      console.warn('[fix-pty-perms] failed to chmod', helper)
    }
  }
}

main()
