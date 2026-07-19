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
  fs.writeFileSync(dbPath, Buffer.from(data))
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
      save()
      return { changes: db.getRowsModified() }
    },
  }
}

const DBService = {
  async init() {
    // sql.js uses a WASM binary — locate it relative to the module
    const sqlJsPath = path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', 'sql-wasm.js')
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

  // Projects
  getProjects: () => prepare('SELECT * FROM projects ORDER BY created_at DESC').all(),
  addProject: (name, folderPath) =>
    prepare('INSERT INTO projects (name, path) VALUES (?, ?)').run(name, folderPath),
  removeProject: (id) => prepare('DELETE FROM projects WHERE id = ?').run(id),

  // Agents
  getAgentsByProject: (projectId) =>
    prepare('SELECT * FROM agents WHERE project_id = ? ORDER BY created_at DESC').all(projectId),
  upsertAgent: ({ id, project_id, label, provider, model, status }) =>
    prepare(`
      INSERT INTO agents (id, project_id, label, provider, model, status)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, model = excluded.model
    `).run(id, project_id, label, provider, model, status),
  updateAgentStatus: (id, status) =>
    prepare('UPDATE agents SET status = ? WHERE id = ?').run(status, id),

  // Prompts
  logPrompt: ({ agent_id, project_id, task_label, prompt_text, response_text, provider, model, input_tokens, output_tokens, duration_ms }) =>
    prepare(`
      INSERT INTO prompts (agent_id, project_id, task_label, prompt_text, response_text,
        provider, model, input_tokens, output_tokens, duration_ms)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(agent_id, project_id, task_label, prompt_text, response_text, provider, model, input_tokens, output_tokens, duration_ms),

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
