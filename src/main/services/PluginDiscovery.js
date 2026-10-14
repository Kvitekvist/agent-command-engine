const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')

// Claude Code tracks installed plugins and configured marketplaces itself in
// these two files (confirmed against the installed CLI's own strings, not
// just its docs). Neither is a public contract; a missing or reshaped file
// yields [] rather than an error.

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return null }
}

// ~/.claude/plugins/installed_plugins.json: { plugins: { "<name>@<marketplace>": [...] } }
function installedPlugins(home) {
  const plugins = readJson(path.join(home, '.claude', 'plugins', 'installed_plugins.json'))?.plugins
  if (!plugins || typeof plugins !== 'object') return []
  return Object.keys(plugins).sort()
}

// ~/.claude/plugins/known_marketplaces.json: { "<marketplace-name>": {...} }
function knownMarketplaces(home) {
  const marketplaces = readJson(path.join(home, '.claude', 'plugins', 'known_marketplaces.json'))
  if (!marketplaces || typeof marketplaces !== 'object') return []
  return Object.keys(marketplaces).sort()
}

function discoverPlugins(home = os.homedir()) {
  return { plugins: installedPlugins(home), marketplaces: knownMarketplaces(home) }
}

module.exports = { discoverPlugins }
