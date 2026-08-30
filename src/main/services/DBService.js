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
      // so reading it afterwards via a separate query always returned 0
      // instead of the real inserted id.
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

    dbPath = path.join(app.getPath('userData'), 'ace.db')
    // TICKET-0071: the db was originally named cpi.db (the app's old internal
    // name). Migrate an existing install's file forward on first launch after
    // the rename rather than silently starting a fresh, empty database.
    const legacyDbPath = path.join(app.getPath('userData'), 'cpi.db')
    if (!fs.existsSync(dbPath) && fs.existsSync(legacyDbPath)) {
      fs.renameSync(legacyDbPath, dbPath)
    }
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
        title_set INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      -- TICKET-0044: maps a Claude CLI session id (which ACE now forces via
      -- claude --session-id <uuid> at launch) back to the ACE agent that
      -- owns it, so the Token Usage tab By Agent breakdown can label
      -- tokscale per-session rows with real agent names. One row per launch:
      -- an agent relaunched over its lifetime spans several sessions, all
      -- attributed to the same agent. The label is snapshotted at launch so a
      -- later rename or delete of the agent does not lose historical rows.
      CREATE TABLE IF NOT EXISTS agent_sessions (
        session_id TEXT PRIMARY KEY,
        agent_id TEXT,
        project_id INTEGER,
        label TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );

      INSERT OR IGNORE INTO settings (key, value) VALUES
        ('default_model', 'claude-sonnet-5'),
        ('default_provider', 'claude');
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
    // TICKET-0070: tracks whether an agent's label has already been
    // auto-titled from its first submitted terminal line, so a restored
    // session (fresh AgentTerminal mount, pre-existing label) doesn't
    // re-arm capture and clobber a real title with a later follow-up line.
    if (!cols.includes('title_set')) {
      db.run('ALTER TABLE agents ADD COLUMN title_set INTEGER NOT NULL DEFAULT 0')
    }
    // TICKET-0083: the headless `prompts` table (audit log / optimization
    // advisor / load-balancer heuristic) has been dead since interactive
    // terminals landed in TICKET-0019. Drop it from existing installs.
    db.run('DROP TABLE IF EXISTS prompts')
    // TICKET-0026 follow-up: agents created before the ChatGPT-account
    // model-list fix still carry the old API-key-only Codex slugs in their
    // row, so they keep hitting "model not supported" on every relaunch
    // even though the create-agent dropdown itself was already fixed.
    // One-time data repair, idempotent (no-op once no rows match).
    db.run(`
      UPDATE agents SET model = 'gpt-5.6-terra'
      WHERE provider = 'codex' AND model IN ('codex-mini-latest', 'o3', 'o4-mini')
    `)
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
  // TICKET-0070: renames an agent's label -- used to auto-title a card from
  // the user's first submitted terminal line. Sets title_set so a later
  // restore (fresh AgentTerminal mount, same persisted label) doesn't re-arm
  // capture and overwrite it with a follow-up line. Doesn't touch
  // agent_sessions' own snapshotted label (see its comment above), by design.
  updateAgentLabel: (id, label) =>
    prepare('UPDATE agents SET label = ?, title_set = 1 WHERE id = ?').run(label, id),
  // Removes the agent row only. Per-session token history lives in
  // `agent_sessions` (TICKET-0044), keyed by project, and is kept.
  deleteAgent: (id) =>
    prepare('DELETE FROM agents WHERE id = ?').run(id),

  // Agent <-> CLI session mapping (TICKET-0044)
  recordAgentSession: ({ session_id, agent_id, project_id, label }) =>
    prepare(`
      INSERT INTO agent_sessions (session_id, agent_id, project_id, label)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        agent_id = excluded.agent_id, project_id = excluded.project_id, label = excluded.label
    `).run(session_id, agent_id, project_id, label),

  // { [session_id]: { agent_id, label } } for one project — used to label
  // tokscale's per-session report rows with the ACE agent that owns them.
  getAgentSessionMap: (projectId) => {
    const rows = prepare('SELECT session_id, agent_id, label FROM agent_sessions WHERE project_id = ?').all(projectId)
    const map = {}
    for (const r of rows) map[r.session_id] = { agent_id: r.agent_id, label: r.label }
    return map
  },

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
