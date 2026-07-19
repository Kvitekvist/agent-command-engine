/**
 * Electron Binary Downloader
 * Tries multiple mirrors to download electron-v31.7.7-win32-x64.zip
 * and installs it into node_modules/electron/dist/
 */
const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const VERSION = '31.7.7'
const FILENAME = `electron-v${VERSION}-win32-x64.zip`
const SRC_DIR = path.join(__dirname, '..', 'src')
const ELECTRON_DIR = path.join(SRC_DIR, 'node_modules', 'electron')
const DIST_DIR = path.join(ELECTRON_DIR, 'dist')
const PATH_TXT = path.join(ELECTRON_DIR, 'path.txt')
const ZIP_PATH = path.join(ELECTRON_DIR, FILENAME)

const MIRRORS = [
  `https://github.com/electron/electron/releases/download/v${VERSION}/${FILENAME}`,
  `https://npmmirror.com/mirrors/electron/v${VERSION}/${FILENAME}`,
  `https://cdn.npmmirror.com/binaries/electron/v${VERSION}/${FILENAME}`,
  `https://electronjs.org/releases/download/v${VERSION}/${FILENAME}`,
]

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`  Trying: ${url}`)
    const proto = url.startsWith('https') ? https : http
    const file = fs.createWriteStream(dest)
    let received = 0
    const req = proto.get(url, { timeout: 30000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        fs.unlinkSync(dest)
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        file.close()
        fs.unlinkSync(dest)
        return reject(new Error(`HTTP ${res.statusCode}`))
      }
      const total = parseInt(res.headers['content-length'] || '0', 10)
      res.on('data', chunk => {
        received += chunk.length
        if (total) process.stdout.write(`\r  Progress: ${(received / total * 100).toFixed(1)}%  `)
      })
      res.pipe(file)
      file.on('finish', () => { file.close(); console.log('\n  Download complete!'); resolve() })
      file.on('error', reject)
    })
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')) })
  })
}

function extractZip(zipPath, destDir) {
  console.log(`\nExtracting ${path.basename(zipPath)}...`)
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true })
  try {
    // Use PowerShell to extract on Windows
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`, { stdio: 'inherit' })
    console.log('Extraction complete.')
    return true
  } catch (e) {
    console.error('Extraction failed:', e.message)
    return false
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log(' Electron Binary Downloader')
  console.log('='.repeat(60))

  // Check if already installed
  if (fs.existsSync(PATH_TXT)) {
    console.log('\nElectron is already installed! path.txt exists.')
    return
  }

  if (!fs.existsSync(ELECTRON_DIR)) {
    console.error(`\nERROR: electron package not found at:\n  ${ELECTRON_DIR}`)
    console.error('Run "npm install" in the src/ directory first.')
    process.exit(1)
  }

  let downloaded = false
  for (const mirror of MIRRORS) {
    try {
      await downloadFile(mirror, ZIP_PATH)
      downloaded = true
      break
    } catch (e) {
      console.log(`  Failed: ${e.message}`)
    }
  }

  if (!downloaded) {
    console.log('\n' + '='.repeat(60))
    console.log(' ALL MIRRORS FAILED')
    console.log('='.repeat(60))
    console.log('\nYour network is blocking the download.')
    console.log('\nManual steps:')
    console.log('1. Download this file on another network/VPN:')
    console.log(`   https://github.com/electron/electron/releases/download/v${VERSION}/${FILENAME}`)
    console.log('2. Copy it to:')
    console.log(`   ${ZIP_PATH}`)
    console.log('3. Run this script again')
    process.exit(1)
  }

  // Extract
  if (!extractZip(ZIP_PATH, DIST_DIR)) {
    process.exit(1)
  }

  // Create path.txt
  fs.writeFileSync(PATH_TXT, 'electron.exe')
  console.log('\nCreated path.txt')

  // Clean up zip
  try { fs.unlinkSync(ZIP_PATH) } catch(e) {}

  console.log('\n' + '='.repeat(60))
  console.log(' SUCCESS! Electron is ready.')
  console.log('='.repeat(60))
  console.log('\nRun: scripts\\run.bat')
}

main().catch(e => { console.error('\nFatal error:', e.message); process.exit(1) })
