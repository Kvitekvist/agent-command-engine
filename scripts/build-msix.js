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
// must match Partner Center > Product identity for product 9N64PL478DHP.
//
// Requires the Windows 10/11 SDK (makeappx.exe). electron-builder finds it
// under "C:\Program Files (x86)\Windows Kits\10\bin\<ver>\x64" automatically.
//
// ponytail: no manifest post-processing. electron-builder 24 hardcodes
// TargetDeviceFamily MaxVersionTested=10.0.14316.0; if Partner Center rejects
// that, bump electron-builder or patch AppxManifest.xml + repack with makeappx.

const { execFileSync } = require('child_process')
const path = require('path')
const fs = require('fs')

const src = path.join(__dirname, '..', 'src')
const run = (cmd, args) =>
  execFileSync(cmd, args, { cwd: src, stdio: 'inherit', shell: process.platform === 'win32' })

run('npm', ['run', 'build'])
run('npx', ['--yes', 'electron-builder', '--win', 'appx', '--x64', '--publish', 'never'])

const version = require(path.join(src, 'package.json')).version
const out = path.join(__dirname, '..', 'releases', `Agent Command Engine ${version}.appx`)
if (!fs.existsSync(out)) {
  console.error(`\nExpected package not found: ${out}`)
  process.exit(1)
}
const mb = (fs.statSync(out).size / 1e6).toFixed(0)
console.log(`\nBuilt ${out} (${mb} MB, unsigned).`)
console.log('Upload it at Partner Center > product 9N64PL478DHP > Packages.')
