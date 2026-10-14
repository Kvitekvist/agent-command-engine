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
  assert.deepEqual(discoverPlugins(dir), {
    plugins: ['code-review@claude-plugins-official', 'ponytail@ponytail'],
    marketplaces: ['claude-plugins-official', 'ponytail'],
  })
})

test('missing or malformed files yield empty lists, not an error', () => {
  assert.deepEqual(discoverPlugins(home()), { plugins: [], marketplaces: [] })
  const dir = home({ 'installed_plugins.json': 'not json', 'known_marketplaces.json': '[]' })
  assert.deepEqual(discoverPlugins(dir), { plugins: [], marketplaces: [] })
})
