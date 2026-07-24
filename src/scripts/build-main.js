const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const sourceDir = path.join(projectRoot, 'main')
const outputDir = path.join(projectRoot, 'dist', 'main')

fs.rmSync(outputDir, { recursive: true, force: true })
fs.mkdirSync(path.dirname(outputDir), { recursive: true })
fs.cpSync(sourceDir, outputDir, { recursive: true })

console.log(`Copied Electron main process to ${outputDir}`)
