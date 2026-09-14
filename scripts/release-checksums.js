const fs = require('node:fs')
const path = require('node:path')
const { createHash } = require('node:crypto')
const platform = process.argv[2]
if (!['Windows', 'macOS'].includes(platform)) throw new Error('Specify Windows or macOS')
const root = path.resolve(__dirname, '../releases')
const extension = platform === 'Windows' ? '.exe' : '.dmg'
const files = fs.readdirSync(root).filter(file => file.endsWith(extension)).sort()
if (!files.length) throw new Error('No release artifacts found')
const lines = files.map(file => createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') + '  ' + file)
fs.writeFileSync(path.join(root, 'SHA256SUMS-' + platform + '.txt'), lines.join('\n') + '\n')
