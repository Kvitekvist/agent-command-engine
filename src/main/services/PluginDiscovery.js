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

// MCP servers configured outside the project's .mcp.json, which the MCP tab
// would otherwise never see: user scope and local scope (`claude mcp add`,
// both in ~/.claude.json, local keyed by forward-slash project path) and the
// IT-deployed managed-mcp.json. Plugin- and claude.ai-provided servers aren't
// on disk in a stable place, so they're not listed.
const MANAGED_MCP = process.platform === 'win32' ? 'C:\\Program Files\\ClaudeCode\\managed-mcp.json'
  : process.platform === 'darwin' ? '/Library/Application Support/ClaudeCode/managed-mcp.json'
  : '/etc/claude-code/managed-mcp.json'

function serverNames(config) {
  const servers = config?.mcpServers
  return servers && typeof servers === 'object' ? Object.keys(servers) : []
}

function mcpServers(home, projectPath, managedFile = MANAGED_MCP) {
  const userConfig = readJson(path.join(home, '.claude.json'))
  const key = projectPath && path.resolve(projectPath).replace(/\\/g, '/')
  const rows = [
    ...serverNames(readJson(managedFile)).map((name) => ({ name, scope: 'managed' })),
    ...serverNames(userConfig).map((name) => ({ name, scope: 'user' })),
    ...(key ? serverNames(userConfig?.projects?.[key]).map((name) => ({ name, scope: 'local' })) : []),
  ]
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

function discoverPlugins(home = os.homedir(), projectPath = null, managedFile) {
  return { plugins: installedPlugins(home), marketplaces: knownMarketplaces(home), mcpServers: mcpServers(home, projectPath, managedFile) }
}

module.exports = { discoverPlugins }
