#!/usr/bin/env node
// Build the unsigned MSIX/AppX package for Microsoft Store submission.
//
//   node scripts/build-msix.js
//
// Output: releases/Agent Command Engine <version>.appx  (an OPC/MSIX container;
// Partner Center's MSIX submission accepts the .appx extension as-is).
//
// You upload this UNSIGNED. The Store re-signs it with your publisher cert on
// ingestion, so there is no code-signing step here. Identity (identityName /
// publisher / publisherDisplayName) lives in src/package.json build.appx and
// must match Partner Center > Product identity for the ACE product you submit.
//
// Requires the Windows 10/11 SDK (makeappx.exe): electron-builder finds it to
// pack, and the post-process step below reuses it to unpack/repack.
//
// Post-process: electron-builder 24 hardcodes TargetDeviceFamily
// MinVersion / MaxVersionTested = 10.0.14316.0 (a 2016 build) with no config
// hook. Store certification wants a real, recent tested range, so after the
// pack we unpack the .appx, rewrite that one line, and repack.
//
// The same pass turns off AppData/HKCU write virtualization. ACE installs the
// Claude/Codex CLIs with `npm install -g`, which writes %APPDATA%\npm. With
// virtualization on, those writes land in the package's private LocalCache:
// ACE sees claude.exe, but the agent's PowerShell (and every other app)
// doesn't -- "claude.exe is not recognized" on a clean machine. desktop6
// needs Windows 10 2004, hence MIN_VERSION.

const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const root = path.join(__dirname, '..')
const src = path.join(root, 'src')
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { cwd: src, stdio: 'inherit', ...opts })

// --- build ---------------------------------------------------------------
run('npm', ['run', 'build'], { shell: process.platform === 'win32' })
run('npx', ['--yes', 'electron-builder', '--win', 'appx', '--x64', '--publish', 'never'], {
  shell: process.platform === 'win32',
})

const version = require(path.join(src, 'package.json')).version
const appx = path.join(root, 'releases', `Agent Command Engine ${version}.appx`)
if (!fs.existsSync(appx)) {
  console.error(`\nExpected package not found: ${appx}`)
  process.exit(1)
}

// --- post-process: fix the TargetDeviceFamily version range -------------
const MIN_VERSION = '10.0.19041.0' // Windows 10 2004 -- floor for desktop6 (below)
const MAX_TESTED = '10.0.19041.0' // Windows 10 2004

function findMakeAppx() {
  const bin = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin'
  const versions = fs.existsSync(bin)
    ? fs.readdirSync(bin).filter((d) => /^10\./.test(d)).sort().reverse()
    : []
  for (const v of versions) {
    const p = path.join(bin, v, 'x64', 'makeappx.exe')
    if (fs.existsSync(p)) return p
  }
  return null
}

const makeappx = findMakeAppx()
if (!makeappx) {
  console.error('\nmakeappx.exe not found (Windows 10/11 SDK) -- cannot patch the manifest.')
  process.exit(1)
}

const workDir = path.join(root, 'releases', '__msix-tdf')
fs.rmSync(workDir, { recursive: true, force: true })
// array args + no shell => spaces in paths are safe
execFileSync(makeappx, ['unpack', '/p', appx, '/d', workDir, '/o'], { stdio: 'inherit' })

const manifestPath = path.join(workDir, 'AppxManifest.xml')
const patched = fs
  .readFileSync(manifestPath, 'utf8')
  .replace(/MinVersion="10\.0\.14316\.0"/, `MinVersion="${MIN_VERSION}"`)
  .replace(/MaxVersionTested="10\.0\.14316\.0"/, `MaxVersionTested="${MAX_TESTED}"`)
  .replace(/(xmlns:rescap="[^"]+")/, '$1\n   xmlns:desktop6="http://schemas.microsoft.com/appx/manifest/desktop/windows10/6"\n   IgnorableNamespaces="desktop6"')
  .replace(/(<\/Logo>)/, '$1\n    <desktop6:FileSystemWriteVirtualization>disabled</desktop6:FileSystemWriteVirtualization>\n    <desktop6:RegistryWriteVirtualization>disabled</desktop6:RegistryWriteVirtualization>')
  .replace(/(<rescap:Capability Name="runFullTrust"\/>)/, '$1\n  <rescap:Capability Name="unvirtualizedResources"/>')
if (!patched.includes(`MaxVersionTested="${MAX_TESTED}"`)) {
  console.error('\nManifest patch did not apply -- electron-builder changed its TargetDeviceFamily default?')
  process.exit(1)
}
if (!patched.includes('unvirtualizedResources') || !patched.includes('<desktop6:FileSystemWriteVirtualization>')) {
  console.error('\nVirtualization patch did not apply -- electron-builder changed its manifest template?')
  process.exit(1)
}
fs.writeFileSync(manifestPath, patched)

// makeappx regenerates these on pack; leaving stale copies makes it fail
for (const f of ['AppxBlockMap.xml', '[Content_Types].xml']) {
  fs.rmSync(path.join(workDir, f), { force: true })
}
fs.rmSync(path.join(workDir, 'AppxMetadata'), { recursive: true, force: true })

execFileSync(makeappx, ['pack', '/d', workDir, '/p', appx, '/o'], { stdio: 'inherit' })
fs.rmSync(workDir, { recursive: true, force: true })

const mb = (fs.statSync(appx).size / 1e6).toFixed(0)
console.log(`\nBuilt ${appx} (${mb} MB, unsigned).`)
console.log(`TargetDeviceFamily patched to MinVersion ${MIN_VERSION} / MaxVersionTested ${MAX_TESTED}.`)
console.log('Upload it at Partner Center > your Agent Command Engine product > Packages.')
