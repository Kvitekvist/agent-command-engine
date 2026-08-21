// electron-builder afterPack hook.
//
// node-pty ships its `spawn-helper` prebuilt binary WITHOUT the executable bit
// (verified: node_modules/node-pty/prebuilds/darwin-*/spawn-helper is 0644),
// and asar packing preserves that. node-pty execs spawn-helper via posix_spawn
// to create the PTY, so on macOS/Linux a packaged build fails at terminal
// startup with "posix_spawnp failed" unless the bit is restored (TICKET-0063).
//
// afterPack runs after the app is packed but BEFORE code signing, so the bit is
// set before electron-builder signs the helper — the shipped, signed binary is
// both executable and correctly signed. Idempotent; safe on every arch/platform
// (Windows has no spawn-helper, so the walk simply finds nothing).

const fs = require('fs')
const path = require('path')

// Recursively collect every file named `spawn-helper` under a directory.
function findSpawnHelpers(dir, found) {
  let entries
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      findSpawnHelpers(full, found)
    } else if (entry.isFile() && entry.name === 'spawn-helper') {
      found.push(full)
    }
  }
  return found
}

exports.default = async function afterPack(context) {
  const helpers = findSpawnHelpers(context.appOutDir, [])
  for (const helper of helpers) {
    fs.chmodSync(helper, 0o755)
    console.log(`  • chmod +x ${path.relative(context.appOutDir, helper)}`)
  }
  if (helpers.length === 0) {
    // Not an error: Windows builds have no spawn-helper.
    console.log('  • afterPack: no spawn-helper binaries found (expected on Windows)')
  }
}
