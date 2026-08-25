#!/usr/bin/env node
// Packaging smoke test (TICKET-0101).
//
// Runs against a PACKAGED build (`npm run package` output under ../releases),
// not source. It exercises the one layer that unit CI and `npm run dev` cannot:
// the app.asar / app.asar.unpacked boundary. TICKET-0029 (win32) and
// TICKET-0100 (macOS/Linux) were both invisible everywhere except a real
// package, because there is no app.asar outside one -- so every source repro
// passed while the shipped app read 0 usage.
//
// What it asserts, for the current platform/arch:
//   1. the tokscale native binary exists under app.asar.unpacked (guards an
//      asarUnpack regression directly), and is executable on POSIX;
//   2. spawning it with a trivial arg (`--version`) exits 0 with non-empty
//      stdout -- i.e. the real syscall path the app uses actually works.
//
// It reuses TokscaleService's own nativePackageFor mapping so the test looks
// for exactly the package the app resolves at runtime; a drift there fails here.
//
// Exit codes: 0 pass / skipped (unshipped platform); 1 failure.

const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const { nativePackageFor } = require('../main/services/TokscaleService')

// Overridable so the failure path (missing/packed-only binary) can be exercised
// against a synthetic tree; defaults to the electron-builder output dir.
const RELEASES_DIR = process.env.ACE_RELEASES_DIR
  ? path.resolve(process.env.ACE_RELEASES_DIR)
  : path.resolve(__dirname, '..', '..', 'releases')

function fail(message) {
  console.error(`[smoke-package] FAIL: ${message}`)
  process.exit(1)
}

// Walk the releases tree for every packaged app's unpacked sibling. Named
// directories differ per target (mac/, mac-arm64/*.app/Contents/Resources,
// win-unpacked/resources, linux-unpacked/resources), so match by name rather
// than hard-coding each layout.
function findUnpackedDirs(root, depth = 0) {
  if (depth > 6) return []
  let entries
  try {
    entries = fs.readdirSync(root, { withFileTypes: true })
  } catch {
    return []
  }
  const found = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const full = path.join(root, entry.name)
    if (entry.name === 'app.asar.unpacked') {
      found.push(full)
      continue // no packaged tree nests one unpacked dir inside another
    }
    found.push(...findUnpackedDirs(full, depth + 1))
  }
  return found
}

function main() {
  const pkg = nativePackageFor(process.platform, process.arch)
  if (!pkg) {
    console.log(`[smoke-package] SKIP: ${process.platform}/${process.arch} ships the JS shim, no native binary to smoke-test.`)
    process.exit(0)
  }

  if (!fs.existsSync(RELEASES_DIR)) {
    fail(`no releases/ directory at ${RELEASES_DIR} -- run \`npm run package\` first.`)
  }

  const binName = process.platform === 'win32' ? 'tokscale.exe' : 'tokscale'
  const relBin = path.join('node_modules', pkg, 'bin', binName)

  const unpackedDirs = findUnpackedDirs(RELEASES_DIR)
  if (unpackedDirs.length === 0) {
    fail(`found no app.asar.unpacked under ${RELEASES_DIR} -- packaging produced no unpacked tree (asarUnpack broken or package didn't run).`)
  }

  // Only smoke-test bundles built for the runner's own arch: a binary for a
  // different arch may not run here, and the point is to prove the real spawn.
  let tested = 0
  for (const unpacked of unpackedDirs) {
    const binPath = path.join(unpacked, relBin)
    if (!fs.existsSync(binPath)) continue // e.g. an x64 bundle on an arm64 runner

    console.log(`[smoke-package] checking ${binPath}`)

    if (process.platform !== 'win32') {
      try {
        fs.accessSync(binPath, fs.constants.X_OK)
      } catch {
        fail(`native binary is not executable: ${binPath}`)
      }
    }

    const result = spawnSync(binPath, ['--version'], { encoding: 'utf8', timeout: 30000, windowsHide: true })
    if (result.error) {
      fail(`spawning ${binPath} threw: ${result.error.message}`)
    }
    if (result.status !== 0) {
      fail(`${binPath} --version exited ${result.status}\nstderr: ${(result.stderr || '').trim()}`)
    }
    if (!result.stdout || !result.stdout.trim()) {
      fail(`${binPath} --version produced no stdout`)
    }

    console.log(`[smoke-package]   ok: ${result.stdout.trim()}`)
    tested += 1
  }

  if (tested === 0) {
    fail(`no packaged bundle contained ${relBin} for ${process.platform}/${process.arch}. asarUnpack likely dropped ${pkg}, or no matching-arch bundle was built.`)
  }

  console.log(`[smoke-package] PASS: ${tested} packaged bundle(s) can spawn tokscale from app.asar.unpacked.`)
}

main()
