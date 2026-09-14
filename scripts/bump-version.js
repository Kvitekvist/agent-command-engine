// Bumps the patch version in src/package.json and mirrors it into the
// root version.txt and lockfile. Run explicitly when preparing a release;
// ordinary builds never change the version.
const fs = require('fs')
const path = require('path')

const pkgPath = path.join(__dirname, '..', 'src', 'package.json')
const versionTxtPath = path.join(__dirname, '..', 'version.txt')
const lockPath = path.join(__dirname, '..', 'src', 'package-lock.json')
const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))

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
lock.version = newVersion
lock.packages[''].version = newVersion
// Preserve 2-space indentation + CRLF line endings, matching the existing file style.
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2).replace(/\n/g, '\r\n') + '\r\n')
fs.writeFileSync(versionTxtPath, newVersion + '\r\n')
fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')

console.log(`Version bumped: ${oldVersion} -> ${newVersion}`)
