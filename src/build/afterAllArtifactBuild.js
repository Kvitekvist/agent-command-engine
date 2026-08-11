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
    // A previously-built Portable-ACE can be locked on Windows if an ACE
    // instance launched from it is still running (EPERM on rmSync). That must
    // not abort a release whose actual deliverables — the portable + installer
    // exes — have already been built; the folder is only a local convenience,
    // never a release asset. So warn and leave the fresh build in win-unpacked
    // instead of throwing.
    try {
      if (fs.existsSync(dest)) {
        fs.rmSync(dest, { recursive: true, force: true })
      }
      fs.renameSync(src, dest)
      console.log('  • renamed portable folder win-unpacked → Portable-ACE')
    } catch (err) {
      console.warn(
        `  • could not rename win-unpacked → Portable-ACE (${err.code || err.message}); ` +
        'the fresh build is in win-unpacked. Close any running ACE launched from ' +
        'Portable-ACE and rename it manually.',
      )
    }
  }

  // Return no additional artifact paths.
  return []
}
