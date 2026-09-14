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

// electron-builder names each output tree after the target it built --
// mac/ and mac-arm64/, win-unpacked/ and win-arm64-unpacked/, linux-unpacked/
// -- so a bundle's own arch is readable from its path. Check each bundle
// against the binary IT needs rather than the runner's: the arm64 macOS runner
// used to build an x64 dmg containing no x64 tokscale at all, and the old
// host-arch-only loop skipped straight past it.
function archOf(unpackedDir) {
  return path.relative(RELEASES_DIR, unpackedDir).includes('arm64') ? 'arm64' : 'x64'
}

function main() {
  if (!nativePackageFor(process.platform, process.arch)) {
    console.log(`[smoke-package] SKIP: ${process.platform}/${process.arch} ships the JS shim, no native binary to smoke-test.`)
    process.exit(0)
  }

  if (!fs.existsSync(RELEASES_DIR)) {
    fail(`no releases/ directory at ${RELEASES_DIR} -- run \`npm run package\` first.`)
  }

  const binName = process.platform === 'win32' ? 'tokscale.exe' : 'tokscale'

  const unpackedDirs = findUnpackedDirs(RELEASES_DIR)
  if (unpackedDirs.length === 0) {
    fail(`found no app.asar.unpacked under ${RELEASES_DIR} -- packaging produced no unpacked tree (asarUnpack broken or package didn't run).`)
  }

  let spawned = 0
  for (const unpacked of unpackedDirs) {
    const arch = archOf(unpacked)
    const pkg = nativePackageFor(process.platform, arch)
    if (!pkg) continue
    const binPath = path.join(unpacked, 'node_modules', pkg, 'bin', binName)

    // Presence is asserted for EVERY bundle. A bundle missing its own arch's
    // binary is a shipped app whose Usage tab reads 0 -- exactly the bug this
    // test exists to catch, and it is invisible from the build machine.
    if (!fs.existsSync(binPath)) {
      fail(`${arch} bundle is missing ${pkg} at ${binPath}. Install that arch's tokscale package before packaging (see .github/workflows/release.yml), or asarUnpack dropped it.`)
    }

    if (process.platform !== 'win32') {
      try {
        fs.accessSync(binPath, fs.constants.X_OK)
      } catch {
        fail(`native binary is not executable: ${binPath}`)
      }
    }

    // Only the runner's own arch can actually be executed here. A foreign-arch
    // binary is verified as far as this machine allows: present and +x.
    if (arch !== process.arch) {
      console.log(`[smoke-package] ${arch} bundle: ${pkg} present (not spawnable on ${process.arch})`)
      continue
    }

    console.log(`[smoke-package] checking ${binPath}`)
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
    if (process.platform === 'win32' || process.platform === 'darwin') {
      const resources = path.dirname(unpacked)
      const archive = unpacked.slice(0, -'.unpacked'.length)
      const executable = process.platform === 'win32'
        ? path.join(resources, '..', 'Agent Command Engine.exe')
        : path.join(resources, '..', 'MacOS', 'Agent Command Engine')
      for (const [args, extraEnv] of [
        [[path.join(__dirname, 'smoke-pty.js')], { ACE_PTY_HOST: path.join(archive, 'dist/main/ptyHost.js'), ACE_PTY_EXECUTABLE: executable }],
        [[require.resolve('electron/cli.js'), path.join(__dirname, 'smoke-renderer.js')], { ACE_RENDERER_ENTRY: path.join(archive, 'dist/renderer/index.html') }],
      ]) {
        const check = spawnSync(process.execPath, args, { env: { ...process.env, ...extraEnv }, encoding: 'utf8', timeout: 45000, windowsHide: true })
        if (check.status !== 0) fail(`packaged runtime check: ${check.error?.message || check.stderr || check.stdout}`)
        console.log(`[smoke-package] ${check.stdout.trim()}`)
      }
    }
    spawned += 1
  }

  if (spawned === 0) {
    fail(`no packaged bundle matched the runner's own ${process.platform}/${process.arch}, so nothing was actually spawned. Packaging produced no native-arch bundle to verify.`)
  }

  console.log(`[smoke-package] PASS: every bundle carries its tokscale binary; ${spawned} spawned it from app.asar.unpacked.`)
}

main()
