// Downloads the pinned MinGit (portable Git for Windows) release into
// src/resources/mingit so electron-builder can bundle it for users who don't
// have Git on PATH. MinGit is GPLv2 (ships its own LICENSE.txt inside the
// zip) and is built by the Git for Windows project specifically for this
// kind of bundling. Skips the download if the pinned version is already
// there. Run before `electron-builder` packages the Windows targets.
'use strict'
const fs = require('fs')
const path = require('path')
const https = require('https')
const crypto = require('crypto')
const os = require('os')
const { execFileSync } = require('child_process')

const VERSION = '2.55.0.5'
const URL = `https://github.com/git-for-windows/git/releases/download/v2.55.0.windows.5/MinGit-${VERSION}-64-bit.zip`
const SHA256 = '56d7b226b7693196cfc71fef26568f536c4a021ab6c37ff2db4287bed908e96e'

const destDir = path.join(__dirname, '..', 'src', 'resources', 'mingit')
const versionFile = path.join(destDir, '.mingit-version')

if (fs.existsSync(versionFile) && fs.readFileSync(versionFile, 'utf8').trim() === VERSION) {
  console.log(`MinGit ${VERSION} already present, skipping.`)
  process.exit(0)
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        fs.unlinkSync(dest)
        download(res.headers.location, dest).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        file.close()
        reject(new Error(`GET ${url} -> ${res.statusCode}`))
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', reject)
  })
}

async function main() {
  const tmpZip = path.join(os.tmpdir(), `mingit-${VERSION}.zip`)
  console.log(`Downloading MinGit ${VERSION}...`)
  await download(URL, tmpZip)

  const hash = crypto.createHash('sha256').update(fs.readFileSync(tmpZip)).digest('hex')
  if (hash !== SHA256) {
    fs.unlinkSync(tmpZip)
    throw new Error(`MinGit checksum mismatch: got ${hash}, expected ${SHA256}`)
  }

  fs.rmSync(destDir, { recursive: true, force: true })
  fs.mkdirSync(destDir, { recursive: true })
  execFileSync('tar', ['-xf', tmpZip, '-C', destDir])
  fs.unlinkSync(tmpZip)
  fs.writeFileSync(versionFile, VERSION + '\n')
  console.log(`MinGit ${VERSION} ready at ${destDir}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
