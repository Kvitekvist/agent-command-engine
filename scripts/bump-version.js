// Bumps the patch version in src/package.json and mirrors it into the
// root version.txt. Run from build.bat/build.sh before every dev build
// (TICKET-0054) -- not wired into any npm script, so a plain `npm run
// build` (CI, `npm run package`, etc.) never bumps the version on its own.
const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '..', 'src', 'package.json')
const versionTxtPath = path.join(__dirname, '..', 'version.txt')

const raw = fs.readFileSync(pkgPath, 'utf8')
const pkg = JSON.parse(raw)

const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version)
if (!match) {
  console.error(`ERROR: src/package.json version "${pkg.version}" is not a plain major.minor.patch semver string.`)
  process.exit(1)
}

const [, major, minor, patch] = match
const oldVersion = pkg.version
const newVersion = `${major}.${minor}.${Number(patch) + 1}`

pkg.version = newVersion
// Preserve 2-space indentation + CRLF line endings, matching the existing file style.
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2).replace(/\n/g, '\r\n') + '\r\n')
fs.writeFileSync(versionTxtPath, newVersion + '\r\n')

console.log(`Version bumped: ${oldVersion} -> ${newVersion}`)
