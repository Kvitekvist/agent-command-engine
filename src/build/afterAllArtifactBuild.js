// electron-builder afterAllArtifactBuild hook.
//
// The Windows build emits an intermediate unpacked application directory named
// `win-unpacked` — this is the "portable" copy-anywhere form of the app (run
// the .exe inside it directly, no install). Per project preference the folder
// should be named `Portable-ACE` instead. This hook runs after every artifact
// (portable exe + nsis installer) is built, so it can safely rename the folder
// without disrupting the targets that read from win-unpacked during packaging.
//
// Guarded by existsSync so non-Windows builds (mac/linux, different unpacked
// dir names) are left untouched.

const fs = require('fs')
const path = require('path')

exports.default = async function afterAllArtifactBuild(buildResult) {
  const outDir = buildResult.outDir
  const src = path.join(outDir, 'win-unpacked')
  const dest = path.join(outDir, 'Portable-ACE')

  if (fs.existsSync(src)) {
    if (fs.existsSync(dest)) {
      fs.rmSync(dest, { recursive: true, force: true })
    }
    fs.renameSync(src, dest)
    console.log('  • renamed portable folder win-unpacked → Portable-ACE')
  }

  // Return no additional artifact paths.
  return []
}
