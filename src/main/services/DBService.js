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
        agent_name TEXT NOT NULL,
        session_title TEXT,
        provider TEXT NOT NULL DEFAULT 'claude',
        model TEXT NOT NULL DEFAULT 'claude-sonnet-5',
        status TEXT NOT NULL DEFAULT 'idle',
        permission_mode TEXT NOT NULL DEFAULT 'safe',
        session_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (project_id) REFERENCES projects(id)
      );

      -- TICKET-0044: maps a Claude CLI session id (which ACE now forces via
      -- claude --session-id <uuid> at launch) back to the ACE agent that
      -- owns it, so the Token Usage tab By Agent breakdown can label
      -- tokscale per-session rows with real agent names. One row per launch:
      -- an agent relaunched over its lifetime spans several sessions, all
      -- attributed to the same agent. The agent_name and session_title are
      -- snapshotted at launch so a later rename or delete does not lose
      -- historical rows.
      CREATE TABLE IF NOT EXISTS agent_sessions (
        session_id TEXT PRIMARY KEY,
        agent_id TEXT,
        project_id INTEGER,
        agent_name TEXT,
        session_title TEXT,
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
    // Migrate from old label-only schema to agent_name + session_title:
    // If title_set=1, the label was already an auto-title, so move it to
    // session_title and reset agent_name to a random name. Otherwise keep
    // label as agent_name.
    if (cols.includes('label') && !cols.includes('agent_name')) {
      db.run('ALTER TABLE agents ADD COLUMN agent_name TEXT')
      db.run('ALTER TABLE agents ADD COLUMN session_title TEXT')
      db.run(`
        UPDATE agents SET
          agent_name = CASE WHEN title_set = 1 THEN 'Agent' ELSE label END,
          session_title = CASE WHEN title_set = 1 THEN label ELSE NULL END
      `)
    }
    // The old `label` column is NOT NULL with no default, and the current
    // insert path never writes it -- so every agent start on a pre-existing
    // install fails with "NOT NULL constraint failed: agents.label" until the
    // column is gone. DROP COLUMN isn't reliable across the SQLite builds we
    // ship, so rebuild the table to the canonical shape (also drops title_set).
    if (cols.includes('label')) {
      db.run(`
        CREATE TABLE agents_new (
          id TEXT PRIMARY KEY,
          project_id INTEGER NOT NULL,
          agent_name TEXT NOT NULL,
          session_title TEXT,
          provider TEXT NOT NULL DEFAULT 'claude',
          model TEXT NOT NULL DEFAULT 'claude-sonnet-5',
          status TEXT NOT NULL DEFAULT 'idle',
          permission_mode TEXT NOT NULL DEFAULT 'safe',
          session_id TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (project_id) REFERENCES projects(id)
        );
        INSERT INTO agents_new
          (id, project_id, agent_name, session_title, provider, model, status, permission_mode, session_id, created_at)
          SELECT id, project_id, COALESCE(agent_name, label, 'Agent'), session_title,
                 provider, model, status, permission_mode, session_id, created_at
          FROM agents;
        DROP TABLE agents;
        ALTER TABLE agents_new RENAME TO agents;
      `)
    }
    // Migrate agent_sessions table
    const sessionCols = toRows(db.exec('PRAGMA table_info(agent_sessions)')).map((c) => c.name)
    if (sessionCols.includes('label') && !sessionCols.includes('agent_name')) {
      db.run('ALTER TABLE agent_sessions ADD COLUMN agent_name TEXT')
      db.run('ALTER TABLE agent_sessions ADD COLUMN session_title TEXT')
      db.run('UPDATE agent_sessions SET agent_name = label, session_title = NULL')
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
  upsertAgent: ({ id, project_id, agent_name, session_title, provider, model, status, permission_mode }) =>
    prepare(`
      INSERT INTO agents (id, project_id, agent_name, session_title, provider, model, status, permission_mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status = excluded.status, model = excluded.model
    `).run(id, project_id, agent_name, session_title || null, provider, model, status, permission_mode || 'safe'),
  updateAgentStatus: (id, status) =>
    prepare('UPDATE agents SET status = ? WHERE id = ?').run(status, id),
  // Updates an agent's session title -- used to auto-title a card from
  // the user's first submitted terminal line. Also updates agent_sessions
  // so the Token Usage report shows the final title, not the null placeholder.
  updateAgentSessionTitle: (id, title) => {
    prepare('UPDATE agents SET session_title = ? WHERE id = ?').run(title, id)
    // Also update agent_sessions for this agent's current session (if any).
    // An agent can have multiple sessions over its lifetime; update all of
    // them so past sessions also show the title in historical reports.
    prepare('UPDATE agent_sessions SET session_title = ? WHERE agent_id = ?').run(title, id)
  },
  // Removes the agent row only. Per-session token history lives in
  // `agent_sessions` (TICKET-0044), keyed by project, and is kept.
  deleteAgent: (id) =>
    prepare('DELETE FROM agents WHERE id = ?').run(id),

  // Agent <-> CLI session mapping (TICKET-0044)
  recordAgentSession: ({ session_id, agent_id, project_id, agent_name, session_title }) =>
    prepare(`
      INSERT INTO agent_sessions (session_id, agent_id, project_id, agent_name, session_title)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        agent_id = excluded.agent_id, project_id = excluded.project_id,
        agent_name = excluded.agent_name, session_title = excluded.session_title
    `).run(session_id, agent_id, project_id, agent_name, session_title || null),

  // sessionId -> owning agentId, for the Claude-hook status watcher (HookService).
  getAgentIdBySession: (sessionId) => {
    const row = prepare('SELECT agent_id FROM agent_sessions WHERE session_id = ?').get(sessionId)
    return row ? row.agent_id : null
  },

  // { [session_id]: { agent_id, agent_name, session_title } } for one project
  // — used to label tokscale's per-session report rows with the ACE agent that owns them.
  getAgentSessionMap: (projectId) => {
    const rows = prepare('SELECT session_id, agent_id, agent_name, session_title FROM agent_sessions WHERE project_id = ?').all(projectId)
    const map = {}
    for (const r of rows) map[r.session_id] = {
      agent_id: r.agent_id,
      agent_name: r.agent_name,
      session_title: r.session_title
    }
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
