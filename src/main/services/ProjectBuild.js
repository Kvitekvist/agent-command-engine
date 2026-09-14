const fs = require('node:fs')
const path = require('node:path')
const { resolveWithinRoot } = require('./ProjectPath')

function detectBuild(root) {
  for (const relative of ['src/package.json', 'package.json']) {
    const file = resolveWithinRoot(root, relative)
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
      const script = pkg.scripts?.build ? 'build' : pkg.scripts?.package ? 'package' : null
      if (script) return { ok: true, cwd: path.dirname(file), script }
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error
    }
  }
  return { ok: false, error: 'No build/package script found in package.json' }
}

module.exports = { detectBuild }
