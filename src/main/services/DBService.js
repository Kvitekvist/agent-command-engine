const path = require('path')
const fs = require('fs')
const { app } = require('electron')

let db = null
let dbPath = null
let SQL = null

// Convert sql.js result ([{columns, values}]) to array of row objects
function toRows(results) {
  if (!results || results.length === 0) return []
  const { columns, values } = results[0]
  return values.map(row =>
    Object.fromEntries(columns.map((col, i) => [col, row[i]]))
  )
}

function save() {
  if (!db || !dbPath) return
  const data = db.export()
  const tempPath = `${dbPath}.tmp`
  fs.writeFileSync(tempPath, Buffer.from(data))
  fs.renameSync(tempPath, dbPath)
}

// Thin wrapper to mimic better-sqlite3's prepared statement API
function prepare(sql) {
  return {
    all(...params) {
      const results = db.exec(sql, params)
      return toRows(results)
    },
    get(...params) {
      const results = db.exec(sql, params)
      const rows = toRows(results)
      return rows[0] || null
    },
    run(...params) {
      db.run(sql, params)
      // last_insert_rowid() must be read before save() — sql.js's export()
      // (called inside save()) resets the connection's rowid counter to 0,
      // so reading it afterwards (as logPrompt used to, via a separate
      // query) always returned 0 instead of the real inserted id.
      const lastInsertRowid = toRows(db.exec('SELECT last_insert_rowid() as id'))[0]?.id ?? null
      save()
      return { changes: db.getRowsModified(), lastInsertRowid }
    },
  }
}

const DBService = {
  async init() {
    // sql.js uses a WASM binary — locate it relative to the module
    // Resolve through Node's module loader. This file is copied from
    // main/services to dist/main/services during a build, so deriving the
    // package location from __dirname would incorrectly target
    // dist/node_modules. require.resolve also works inside a packaged app.
    const sqlJsPath = require.resolve('sql.js/dist/sql-wasm.js')
    const initSqlJs = require(sqlJsPath)
    const wasmPath = path.join(path.dirname(sqlJsPath), 'sql-wasm.wasm')

    SQL = await initSqlJs({ locateFile: () => wasmPath })

    dbPath = path.join(app.getPath('userData'), 'cpi.db')
    let buffer = null
    if (fs.existsSync(dbPath)) {
      buffer = fs.readFileSync(dbPath)
    }
    db = new SQL.Database(buffer)
    this._createSchema()
    this._migrateSchema()
    save()
  },

  _createSchema() {
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL UNIQUE,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        project_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        provider TEXT NOT NULL DEFAULT 'claude',
        model TEXT NOT NULL DEFAULT 'claude-sonnet-5',
        status TEXT NOT NULL DEFAULT 'idle',
        permission_mode TEXT NOT NULL DEFAULT 'safe',
        session_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT,
        project_id INTEGER NOT NULL,
        task_label TEXT,
        prompt_text TEXT NOT NULL,
        response_text TEXT,
        provider TEXT,
        model TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cache_creation_tokens INTEGER DEFAULT 0,
        cost_usd REAL DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('default_model', 'claude-sonnet-5'),
        ('default_provider', 'claude'),
        ('codex_fallback_enabled', 'true'),
        ('claude_credit_threshold', '10');
    `)
  },

  // CREATE TABLE IF NOT EXISTS leaves pre-existing DB files on old schemas
  // untouched, so add any columns introduced after their creation by hand.
  _migrateSchema() {
    const cols = toRows(db.exec('PRAGMA table_info(agents)')).map((c) => c.name)
    if (!cols.includes('permission_mode')) {
      db.run("ALTER TABLE agents ADD COLUMN permission_mode TEXT NOT NULL DEFAULT 'safe'")
    }
    if (!cols.includes('session_id')) {
      db.run('ALTER TABLE agents ADD COLUMN session_id TEXT')
    }
    const promptCols = toRows(db.exec('PRAGMA table_info(prompts)')).map((c) => c.name)
    if (!promptCols.includes('cache_read_tokens')) {
      db.run('ALTER TABLE prompts ADD COLUMN cache_read_tokens INTEGER DEFAULT 0')
    }
    if (!promptCols.includes('cache_creation_tokens')) {
      db.run('ALTER TABLE prompts ADD COLUMN cache_creation_tokens INTEGER DEFAULT 0')
    }
    if (!promptCols.includes('cost_usd')) {
      db.run('ALTER TABLE prompts ADD COLUMN cost_usd REAL DEFAULT 0')
    }
  },

  // Projects
  getProjects: () => prepare('SELECT * FROM projects ORDER BY created_at DESC').all(),
  addProject: (name, folderPath) =>
    prepare('INSERT INTO projects (name, path) VALUES (?, ?)').run(name, folderPath),
  removeProject: (id) => prepare('DELETE FROM projects WHERE id = ?').run(id),

  // Agents
  getAgentsByProject: (projectId) =>
    prepare('SELECT * FROM agents WHERE project_id = ? ORDER BY created_at ASC').all(projectId),
  upsertAgent: ({ id, project_id, label, provider, model, status, permission_mode }) =>
    prepare(`
      INSERT INTO agents (id, project_id, label, provider, model, status, permission_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, model = excluded.model
    `).run(id, project_id, label, provider, model, status, permission_mode || 'safe'),
  updateAgentStatus: (id, status) =>
    prepare('UPDATE agents SET status = ? WHERE id = ?').run(status, id),
  updateAgentSession: (id, sessionId) =>
    prepare('UPDATE agents SET session_id = ? WHERE id = ?').run(sessionId, id),
  // Removes the agent row only — prompt/audit history is kept for the
  // audit log and token stats, which are keyed by project, not by a live agent.
  deleteAgent: (id) =>
    prepare('DELETE FROM agents WHERE id = ?').run(id),

  // Wipe an agent's persisted history — the only thing that should ever do this
  // is the user's explicit "Clear Context" action.
  clearAgentHistory: (id) => {
    prepare('DELETE FROM prompts WHERE agent_id = ?').run(id)
    prepare('UPDATE agents SET session_id = NULL WHERE id = ?').run(id)
  },

  // Prompts
  logPrompt: ({ agent_id, project_id, task_label, prompt_text, response_text, provider, model, input_tokens, output_tokens, duration_ms }) => {
    const { lastInsertRowid } = prepare(`
      INSERT INTO prompts (agent_id, project_id, task_label, prompt_text, response_text,
        provider, model, input_tokens, output_tokens, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agent_id, project_id, task_label, prompt_text, response_text, provider, model, input_tokens, output_tokens, duration_ms)
    return lastInsertRowid
  },

  updatePromptTokens: (id, { response_text, input_tokens, output_tokens, duration_ms }) =>
    prepare(`
      UPDATE prompts SET response_text = ?, input_tokens = ?, output_tokens = ?, duration_ms = ?
      WHERE id = ?
    `).run(response_text, input_tokens, output_tokens, duration_ms, id),

  // Applied once TokscaleService reconciliation resolves, some time after
  // updatePromptTokens already ran with the fast stdout-parsed estimate.
  // Only touches the numeric usage columns — response_text/duration_ms were
  // already written and must not be clobbered here.
  updatePromptUsage: (id, { input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd }) =>
    prepare(`
      UPDATE prompts SET input_tokens = ?, output_tokens = ?,
        cache_read_tokens = ?, cache_creation_tokens = ?, cost_usd = ?
      WHERE id = ?
    `).run(input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens, cost_usd, id),

  getPrompts: ({ projectId, agentId, limit = 100, offset = 0 } = {}) => {
    let sql = 'SELECT * FROM prompts WHERE 1=1'
    const params = []
    if (projectId) { sql += ' AND project_id = ?'; params.push(projectId) }
    if (agentId)   { sql += ' AND agent_id = ?';   params.push(agentId) }
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)
    return prepare(sql).all(...params)
  },
  getPromptById: (id) => prepare('SELECT * FROM prompts WHERE id = ?').get(id),

  // Token stats
  getTokenStats: ({ projectId } = {}) => {
    const sql = `
      SELECT
        task_label, model, provider,
        COUNT(*) as prompt_count,
        SUM(input_tokens) as total_input,
        SUM(output_tokens) as total_output,
        SUM(input_tokens + output_tokens) as total_tokens,
        SUM(cache_read_tokens) as total_cache_read,
        SUM(cache_creation_tokens) as total_cache_creation,
        SUM(cost_usd) as total_cost_usd,
        AVG(duration_ms) as avg_duration_ms,
        date(created_at) as day
      FROM prompts
      ${projectId ? 'WHERE project_id = ?' : ''}
      GROUP BY day, task_label, model
      ORDER BY day DESC
    `
    return projectId ? prepare(sql).all(projectId) : prepare(sql).all()
  },
  getProjectTokenSummary: (projectId) =>
    prepare(`
      SELECT
        SUM(input_tokens) as total_input,
        SUM(output_tokens) as total_output,
        COUNT(*) as total_prompts,
        AVG(duration_ms) as avg_duration_ms
      FROM prompts WHERE project_id = ?
    `).get(projectId),

  // Settings
  getSetting: (key) => {
    const row = prepare('SELECT value FROM settings WHERE key = ?').get(key)
    return row ? row.value : null
  },
  setSetting: (key, value) =>
    prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
      .run(key, value, value),
}

module.exports = { DBService }
