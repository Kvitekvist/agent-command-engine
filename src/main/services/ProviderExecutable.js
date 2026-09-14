const fs = require('node:fs')
const path = require('node:path')
const PACKAGES = { claude: ['@anthropic-ai', 'claude-code', 'cli.js'], codex: ['@openai', 'codex', 'bin', 'codex.js'] }

// npm .cmd launchers expand percent variables a second time. Invoke their
// actual JS entry point with Node, or a native executable, inside the PTY.
function providerExecutable(provider, platform = process.platform, searchPath = process.env.PATH || '') {
  if (!PACKAGES[provider]) throw new Error('Unsupported provider')
  if (platform !== 'win32') return [provider]
  for (const dir of searchPath.split(';').filter(Boolean)) {
    const native = path.join(dir, provider + '.exe')
    if (fs.existsSync(native)) return [native]
    if (provider === 'claude') {
      const npmNative = path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
      if (fs.existsSync(npmNative)) return [npmNative]
    }
    const entry = path.join(dir, 'node_modules', ...PACKAGES[provider])
    if (fs.existsSync(entry)) return ['node', entry]
  }
  throw new Error(`Cannot resolve a native or npm ${provider} installation. Reinstall the provider from Settings.`)
}

module.exports = { providerExecutable }
