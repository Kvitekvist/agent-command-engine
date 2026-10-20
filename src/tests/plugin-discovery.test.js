const assert = require('node:assert/strict')
const test = require('node:test')
const fs = require('fs')
const path = require('path')
const { makeTempDir } = require('./helpers/temp-dir')
const { discoverPlugins } = require('../main/services/PluginDiscovery')

function home(files = {}) {
  const dir = makeTempDir('ace-plugin-discovery-')
  const pluginsDir = path.join(dir, '.claude', 'plugins')
  fs.mkdirSync(pluginsDir, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(pluginsDir, name), content)
  }
  return dir
}

test('reads installed plugin ids and marketplace names', () => {
  const dir = home({
    'installed_plugins.json': JSON.stringify({ plugins: { 'ponytail@ponytail': [{ scope: 'user' }], 'code-review@claude-plugins-official': [] } }),
    'known_marketplaces.json': JSON.stringify({ ponytail: {}, 'claude-plugins-official': {} }),
  })
  const { plugins, marketplaces } = discoverPlugins(dir)
  assert.deepEqual({ plugins, marketplaces }, {
    plugins: ['code-review@claude-plugins-official', 'ponytail@ponytail'],
    marketplaces: ['claude-plugins-official', 'ponytail'],
  })
})

test('missing or malformed files yield empty lists, not an error', () => {
  const none = path.join(home(), 'no-managed.json')
  assert.deepEqual(discoverPlugins(home(), null, none), { plugins: [], marketplaces: [], mcpServers: [] })
  const dir = home({ 'installed_plugins.json': 'not json', 'known_marketplaces.json': '[]' })
  fs.writeFileSync(path.join(dir, '.claude.json'), 'not json')
  assert.deepEqual(discoverPlugins(dir, null, none), { plugins: [], marketplaces: [], mcpServers: [] })
})

test('lists managed, user and local-scope MCP servers', () => {
  const dir = home()
  const project = path.join(dir, 'proj')
  const managed = path.join(dir, 'managed-mcp.json')
  fs.writeFileSync(managed, JSON.stringify({ mcpServers: { corp: {} } }))
  fs.writeFileSync(path.join(dir, '.claude.json'), JSON.stringify({
    mcpServers: { github: {} },
    projects: { [project.replace(/\\/g, '/')]: { mcpServers: { db: {} } }, '/other': { mcpServers: { nope: {} } } },
  }))
  assert.deepEqual(discoverPlugins(dir, project, managed).mcpServers, [
    { name: 'corp', scope: 'managed' },
    { name: 'db', scope: 'local' },
    { name: 'github', scope: 'user' },
  ])
})
