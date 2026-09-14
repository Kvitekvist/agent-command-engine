const { electronStub } = require('./helpers/electron-stub')
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { makeTempDir } = require('./helpers/temp-dir')
let available = true
try { require.resolve('sql.js') } catch (_) { available = false }

test('real legacy SQL migration preserves names and permits new agents', { skip: !available && 'requires npm ci' }, async () => {
  const dir = makeTempDir('ace-migration-')
  electronStub.app.getPath = () => dir
  const SQL = await require('sql.js')()
  const db = new SQL.Database()
  db.run(`CREATE TABLE agents (id TEXT PRIMARY KEY, project_id INTEGER, label TEXT NOT NULL, title_set INTEGER, provider TEXT, model TEXT, status TEXT, created_at TEXT);
    INSERT INTO agents VALUES ('legacy', 1, 'Original name', 0, 'claude', 'claude-sonnet-5', 'stopped', '2026-01-01');`)
  fs.writeFileSync(path.join(dir, 'ace.db'), db.export())
  db.close()
  const { DBService } = require('../main/services/DBService')
  await DBService.init()
  assert.equal(DBService.getAgentsByProject(1)[0].agent_name, 'Original name')
  DBService.upsertAgent({ id: 'new', project_id: 1, agent_name: 'New agent', provider: 'codex', model: 'gpt-5.6-terra', status: 'running' })
  assert.equal(DBService.getAgentsByProject(1).length, 2)
  await DBService.init()
  assert.equal(DBService.getAgentsByProject(1).length, 2)
})
