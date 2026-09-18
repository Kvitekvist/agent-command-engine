const { app, dialog, shell } = require('electron')
const { resolveLaunchPolicy } = require('../services/LaunchPolicy')
const { FileService } = require('../services/FileService')
const { TokscaleService, pathToWorkspaceKey } = require('../services/TokscaleService')
const { ScreenshotService } = require('../services/ScreenshotService')
const { createProjectFromScaffold, ensureBundledSkills, getScaffoldDir } = require('../services/ProjectScaffoldService')
const { ensureHookFiles, watchAgentStatus, watchQuestionnaireRequests, readPromptEvents } = require('../services/HookService')
const fs = require('node:fs')
const { resolveWithinRoot } = require('../services/ProjectPath')
const { notesOperation } = require('../services/NotesService')
const { detectBuild } = require('../services/ProjectBuild')
const { providerExecutable } = require('../services/ProviderExecutable')

// TICKET-0075: the renderer hands main a filesystem path for every fs / git /
// build / screenshot / agent-spawn call. Trusting that string verbatim lets a
// compromised renderer aim those operations anywhere on disk. Resolve it
// against main's own project records instead, and hand callers back the
// canonical stored path rather than the renderer-supplied one.
function resolveProjectRoot(DB, candidate) {
  const path = require('path')
  if (typeof candidate !== 'string' || !candidate.trim()) {
    throw new Error('A project path is required')
  }
  const norm = (p) => {
    const resolved = path.resolve(p)
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved
  }
  const wanted = norm(candidate)
  const match = DB.getProjects().find((p) => norm(p.path) === wanted)
  if (!match) throw new Error('Path is not a registered project')
  return fs.realpathSync.native(match.path)
}

// TICKET-0075: these channels exist only for ACE's own top-level renderer.
// The screenshot overlay uses its own per-window IPC; nothing else should
// reach them. Reject any other sender (an injected iframe/webview) before a
// handler runs.
function assertAppSender(event, window) {
  const frame = event.senderFrame
  if (!window || window.isDestroyed() || event.sender !== window.webContents ||
      !frame || frame.parent || frame !== window.webContents.mainFrame) {
    throw new Error('IPC sender not permitted')
  }
}

function registerHandlers(ipcMain, mainWindow, DB, AgentSvc, TerminalSvc) {
  const getWindow = typeof mainWindow === 'function' ? mainWindow : () => mainWindow
  const selectedFolders = new Set()
  const canonicalDirectory = (folder) => {
    if (typeof folder !== 'string' || !folder.trim()) throw new Error('A directory is required')
    const canonical = fs.realpathSync.native(folder)
    if (!fs.statSync(canonical).isDirectory()) throw new Error('Select a directory')
    return canonical
  }
  const projectFor = (id, candidate) => {
    const project = DB.getProjects().find(p => p.id === id)
    if (!project || resolveProjectRoot(DB, candidate) !== fs.realpathSync.native(project.path)) {
      throw new Error('Project ID and path do not match')
    }
    return project
  }
  // Keep window ref updated
  AgentSvc.setWindow(getWindow())
  if (TerminalSvc) TerminalSvc.setWindow(getWindow())
  TerminalSvc.onState = (agentId, status) => {
    DB.updateAgentStatus(agentId, status)
    if (status !== 'running') getWindow()?.webContents.send('agent:status', { agentId, status })
  }

  // Claude-hook-driven agent status badge (see HookService). Agents launch
  // with `--settings <this file>`; the hooks write per-session status files
  // this watcher forwards to the renderer as 'agent:status'.
  const { dir: hookDir, settingsPath: hookSettingsPath } = ensureHookFiles()
  watchAgentStatus(DB, getWindow)
  // TICKET-0150: SessionStart-hook-driven first-prompt questionnaire popup.
  watchQuestionnaireRequests(DB, getWindow)

  // TICKET-0075: every invoke/send below goes through a sender check.
  const handle = (channel, fn) =>
    ipcMain.handle(channel, (event, ...args) => {
      assertAppSender(event, getWindow())
      return fn(event, ...args)
    })
  const on = (channel, fn) =>
    ipcMain.on(channel, (event, ...args) => {
      try { assertAppSender(event, getWindow()) } catch (_) { return }
      fn(event, ...args)
    })

  // ── Shell operations ────────────────────────────────────────────────────────
  handle('shell:openUrl', async (_, url) => {
    try {
      if (typeof url !== 'string') throw new Error('A web URL is required')
      const parsed = new URL(url)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only HTTP and HTTPS links are supported')
      await shell.openExternal(parsed.href)
      return { ok: true }
    } catch (error) { return { ok: false, error: error.message } }
  })

  handle('shell:showInFolder', (_, { filePath, projectPath } = {}) => {
    const path = require('path')
    const fs = require('fs')
    // filePath comes from text printed in an agent's terminal -- often relative
    // (e.g. "./src/index.js"), which previously got existsSync-checked against
    // Electron main's own cwd instead of the project root, so it never resolved.
    let resolved
    try {
      if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('A file path is required')
      if (/^file:/i.test(filePath)) filePath = require('node:url').fileURLToPath(filePath)
      resolved = path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : resolveWithinRoot(resolveProjectRoot(DB, projectPath), filePath)
    } catch (error) { return { success: false, error: error.message } }
    if (!fs.existsSync(resolved)) return { success: false, error: 'Path does not exist' }
    shell.showItemInFolder(resolved)
    return { success: true }
  })

  handle('clipboard:saveImage', (_, { projectPath, imageBytes } = {}) => {
    try {
      const { clipboard, nativeImage } = require('electron')
      const path = require('path')
      const fs = require('fs')

      const resolvedPath = resolveProjectRoot(DB, projectPath)
      if (imageBytes !== undefined && (!(imageBytes instanceof Uint8Array) || !imageBytes.length || imageBytes.length > 32 * 1024 * 1024)) {
        throw new Error('Image must contain between 1 byte and 32 MB of encoded image data')
      }
      const image = imageBytes === undefined ? clipboard.readImage() : nativeImage.createFromBuffer(Buffer.from(imageBytes))
      if (image.isEmpty()) return { success: false, error: imageBytes === undefined ? 'No image in clipboard' : 'Could not decode pasted image' }

      const folder = resolveWithinRoot(resolvedPath, 'assets/images/screenshots')
      fs.mkdirSync(folder, { recursive: true })

      const iso = new Date().toISOString().replace(/[:.]/g, '-')
      const filename = `pasted-${iso}-${require('node:crypto').randomUUID()}.png`
      const filePath = resolveWithinRoot(resolvedPath, path.join(folder, filename))
      fs.writeFileSync(filePath, image.toPNG(), { flag: 'wx' })

      const relativePath = path.relative(resolvedPath, filePath).split(path.sep).join('/')
      return { success: true, path: filePath, relativePath }
    } catch (error) { return { success: false, error: error.message } }
  })

  // ── Projects ────────────────────────────────────────────────────────────────
  handle('projects:getAll', () => DB.getProjects().map(project => ({
    ...project,
    activeSessions: [...TerminalSvc.sessions.values()].filter(session =>
      ['running', 'connecting'].includes(session.state) && AgentSvc.agents.get(session.agentId)?.meta.projectId === project.id
    ).length,
  })))
  handle('notes:read', async (_, root) => {
    try { return await notesOperation(resolveProjectRoot(DB, root)) }
    catch (error) { return { ok: false, error: error.message } }
  })
  handle('notes:mutate', async (_, root, mutation) => {
    try { return await notesOperation(resolveProjectRoot(DB, root), mutation) }
    catch (error) { return { ok: false, error: error.message } }
  })

  handle('projects:add', (_, name, folderPath) => {
    const canonical = canonicalDirectory(folderPath)
    if (!selectedFolders.delete(canonical)) throw new Error('Select this folder in the native dialog first')
    if (typeof name !== 'string' || !name.trim()) throw new Error('A project name is required')
    DB.addProject(name.trim(), canonical)
    return DB.getProjects()
  })

  handle('projects:remove', (_, id) => {
    for (const agent of DB.getAgentsByProject(id)) {
      TerminalSvc.stopAgent(agent.id)
      AgentSvc.stop(agent.id)
      DB.deleteAgent(agent.id)
    }
    DB.removeProject(id)
    return DB.getProjects()
  })

  // `defaultPath` is optional -- the "New" flow (TICKET-0057) passes ACE's
  // own parent folder (from projects:getDefaultParentDir below); the
  // "Existing" flow calls this with no arg and gets the OS's own default.
  // createDirectory lets the user make a new subfolder from inside the
  // native dialog itself, standard on both Windows and Mac.
  handle('projects:pickFolder', async (_, defaultPath) => {
    const opts = { properties: ['openDirectory', 'createDirectory'] }
    if (defaultPath) opts.defaultPath = defaultPath
    const result = await dialog.showOpenDialog(opts)
    if (result.canceled) return null
    const canonical = canonicalDirectory(result.filePaths[0])
    selectedFolders.add(canonical)
    return canonical
  })

  // TICKET-0057: "parent folder of ACE" for the New-project folder picker's
  // default location -- same isDev split main/index.js already uses for
  // loadURL vs loadFile. In dev, app.getAppPath() resolves to the repo's
  // src/ folder (where package.json lives), so its parent is the repo root
  // ("ACE" itself) and the grandparent is what we want. In a packaged
  // build, app.getAppPath() resolves inside app.asar, which isn't a
  // meaningful filesystem location to browse from -- app.getPath('exe')'s
  // directory (the install folder, or wherever a portable exe/Portable-ACE
  // was placed) is the real on-disk "ACE folder" there instead. Cross-
  // platform by construction: path.dirname/app.getAppPath/app.getPath are
  // all already OS-agnostic, no separate Windows/Mac branches needed.
  handle('projects:getDefaultParentDir', () => {
    try {
      const path = require('path')
      const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
      const aceDir = isDev
        ? path.dirname(app.getAppPath())
        : path.dirname(app.getPath('exe'))
      return path.dirname(aceDir)
    } catch (_) {
      return null
    }
  })

  handle('projects:createNew', async (_, { name, parentDir } = {}) => {
    const canonical = canonicalDirectory(parentDir)
    if (!selectedFolders.delete(canonical)) throw new Error('Select the parent folder in the native dialog first')
    const result = await createProjectFromScaffold({ name, parentDir: canonical, scaffoldDir: getScaffoldDir() })
    if (result.path) selectedFolders.add(canonicalDirectory(result.path))
    return result
  })

  // One-shot: createProjectFromScaffold drops `.claude/.needs-setup` into every
  // project made through `✨ New`. The first Claude AgentTerminal opened for
  // that project calls this once the CLI is up; a truthy return tells the
  // renderer to auto-send `/project-setup`. Deleting the marker here makes it
  // fire exactly once, surviving app restarts and whichever agent gets there
  // first.
  handle('projects:consumeSetupFlag', (_, projectPath) => {
    const fs = require('fs')
    const path = require('path')
    let root
    try {
      root = resolveProjectRoot(DB, projectPath)
    } catch (_) {
      return { needsSetup: false }
    }
    const marker = resolveWithinRoot(root, '.claude/.needs-setup')
    try {
      fs.unlinkSync(marker)
      return { needsSetup: true }
    } catch (_) {
      return { needsSetup: false }
    }
  })

  // ── Agents ──────────────────────────────────────────────────────────────────
  handle('agents:getByProject', (_, projectId) => {
    return DB.getAgentsByProject(projectId).map(row => {
      if (row.status === 'running' && !TerminalSvc.sessions.has(row.id)) {
        DB.updateAgentStatus(row.id, 'lost')
        return { ...row, status: 'lost' }
      }
      return row
    })
  })

  handle('agents:start', (_, { projectId, projectPath, label, provider, model, permissionMode }) => {
    projectFor(projectId, projectPath)
    const projectRoot = resolveProjectRoot(DB, projectPath)
    const launch = resolveLaunchPolicy({ provider, model, projectId }, { getSetting: key => DB.getSetting(key) })
    const resolvedMode = permissionMode || 'safe'
    const result = AgentSvc.start({
      projectId, projectPath: projectRoot, label,
      provider: launch.provider,
      model: launch.model,
      permissionMode: resolvedMode,
    })
    DB.upsertAgent({
      id: result.agentId,
      project_id: projectId,
      agent_name: label,
      session_title: null,
      provider: launch.provider,
      model: launch.model,
      status: 'running',
      permission_mode: resolvedMode,
    })
    return result
  })

  // Re-register agents persisted from a previous run (app reopened, or the
  // project was reselected) so their history + session can be resumed.
  handle('agents:restore', (_, { id, project_id, projectPath, agent_name, session_title, provider, model, permission_mode, session_id }) => {
    projectFor(project_id, projectPath)
    const stored = DB.getAgentsByProject(project_id).find(a => a.id === id)
    if (!stored) throw new Error('Unknown agent')
    return AgentSvc.restore({
      agentId: id,
      projectId: project_id,
      projectPath: resolveProjectRoot(DB, projectPath),
      label: stored.agent_name,
      provider: stored.provider,
      model: stored.model,
      permissionMode: stored.permission_mode,
      sessionId: stored.session_id,
    })
  })

  // Updates an agent's session title -- fired once, client-side, from the
  // first line the user submits into its terminal (auto-title).
  handle('agents:updateSessionTitle', (_, agentId, title) => {
    DB.updateAgentSessionTitle(agentId, title)
    return { ok: true }
  })

  // TICKET-0070 (follow-up): one-off headless call that turns the user's
  // first submitted line into a short, meaningful title. Best-effort --
  // AgentSvc.generateTitle never rejects, it resolves null on any failure.
  handle('agents:generateTitle', async (_, { prompt, cwd, provider }) => {
    let projectRoot
    try { projectRoot = resolveProjectRoot(DB, cwd) }
    catch (_) { return { title: null } }
    const title = await AgentSvc.generateTitle(prompt, projectRoot, provider)
    return { title }
  })

  handle('agents:stop', (_, agentId) => {
    TerminalSvc.stopAgent(agentId)
    AgentSvc.stop(agentId)
    DB.updateAgentStatus(agentId, 'stopped')
    return { ok: true }
  })

  // Removes an agent from the interface entirely. Stops the process first
  // (no-op if it's already stopped) so a delete can never orphan a subprocess.
  handle('agents:delete', (_, agentId) => {
    TerminalSvc.stopAgent(agentId)
    AgentSvc.stop(agentId)
    DB.deleteAgent(agentId)
    return { ok: true }
  })

  // TICKET-0044: the renderer forces a known session id per Claude agent
  // launch (`claude --session-id <uuid>`) and reports it here so the Token
  // Usage tab's "By Agent" breakdown can join tokscale's per-session rows
  // back to real agent names. Fire-and-forget from the renderer's side.
  handle('agents:recordSession', (_, payload) => {
    const owner = DB.getAgentsByProject(payload?.project_id).find(a => a.id === payload?.agent_id)
    if (!owner || typeof payload.session_id !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(payload.session_id)) throw new Error('Invalid agent session')
    const previous = DB.getAgentIdBySession(payload.session_id)
    if (previous && previous !== owner.id) throw new Error('Session belongs to another agent')
    DB.recordAgentSession({ session_id: payload.session_id, agent_id: owner.id, project_id: owner.project_id, agent_name: owner.agent_name, session_title: owner.session_title })
    return { ok: true }
  })

  // ── Token stats ─────────────────────────────────────────────────────────────

  // TICKET-0044: "History (this project)" — real per-session usage for the
  // active project, straight from tokscale (the `prompts` table this used to
  // read has been dead since TICKET-0019). Rows are scoped to the project's
  // workspace key, then annotated with the ACE agent that owns each session
  // (via agent_sessions) so the renderer can build Totals / By Day / By Model /
  // By Agent / By Session without any per-model or per-day tokscale calls.
  // Sessions with no recorded owner (Codex, or anything from before this shipped)
  // are labelled "Untracked". Returns a normalized, flat row list; the renderer aggregates.
  handle('tokens:getProjectHistory', async (_, { projectId, projectPath } = {}) => {
    projectFor(projectId, projectPath)
    let projectRoot
    try { projectRoot = resolveProjectRoot(DB, projectPath) }
    catch (_) { return { rows: [] } }
    const workspaceKey = pathToWorkspaceKey(projectRoot)
    const sessionRows = await TokscaleService.getWorkspaceReport(workspaceKey, ['claude', 'codex'])
    const ownerMap = projectId ? DB.getAgentSessionMap(projectId) : {}

    const rows = sessionRows.map((r) => {
      const owner = ownerMap[r.session_id]
      // created_at is epoch ms; bucket by its local calendar day (YYYY-MM-DD).
      const day = r.created_at ? new Date(r.created_at).toLocaleDateString('en-CA') : 'unknown'
      const models = Array.isArray(r.models_used) && r.models_used.length ? r.models_used : ['unknown']
      return {
        sessionId: r.session_id,
        client: r.client,
        day,
        // A session is almost always one model; join the rare multi-model case
        // rather than misattribute its tokens to just one of them.
        model: models.join(', '),
        input: Number(r.total_input_tokens) || 0,
        output: Number(r.total_output_tokens) || 0,
        cacheRead: Number(r.total_cache_read) || 0,
        cost: Number(r.total_cost) || 0,
        prompts: Number(r.message_count) || 0,
        agentName: owner?.agent_name || 'Untracked',
        agentId: owner?.agent_id || null,
        sessionTitle: owner?.session_title || null,
      }
    })
    return { rows }
  })

  // Live usage dashboard (TICKET-0022) -- sourced straight from tokscale
  // (real subscription quota + today's session transcripts), independent
  // of ACE's own `prompts` table, which the embedded terminal (TICKET-0019)
  // no longer populates. Quota and today's breakdown are fetched
  // independently so one provider being logged out, or one call failing,
  // doesn't blank out the other.
  handle('tokens:getLiveUsage', async () => {
    const clients = ['claude', 'codex']
    const result = {}
    for (const c of clients) result[c] = { plan: null, quota: [], models: [], projects: [], totalTokens: 0, totalCost: 0 }

    try {
      const quota = await TokscaleService.getQuota()
      for (const entry of quota || []) {
        const key = (entry.provider || '').toLowerCase()
        if (result[key]) {
          result[key].plan = entry.plan || null
          result[key].quota = entry.metrics || []
        }
      }
    } catch (error) {
      for (const c of clients) result[c].quotaError = error.message
    }

    try {
      const breakdown = await TokscaleService.getTodayBreakdown(clients)
      for (const c of clients) {
        if (breakdown[c]) {
          result[c].models = breakdown[c].models
          result[c].projects = breakdown[c].projects
          result[c].totalTokens = breakdown[c].totalTokens
          result[c].totalCost = breakdown[c].totalCost
        }
      }
    } catch (error) {
      for (const c of clients) result[c].breakdownError = error.message
    }

    return result
  })

  // TICKET-0151: Prompt Score tab (whole-machine, like Live Usage above,
  // no active-project scoping). Merges tokscale's global per-session report
  // with first-prompt-length events the UserPromptSubmit hook has recorded
  // (only for sessions run through ACE since this shipped, see HookService).
  handle('tokens:getPromptScore', async () => {
    const sessionRows = await TokscaleService.getAllSessionsReport(['claude', 'codex'])
    const events = readPromptEvents()

    // First recorded prompt per session (lowest ts), by chars/words only --
    // never the prompt text, which the hook never wrote to disk.
    const firstPromptBySession = new Map()
    let promptLengthTrackedSince = null
    for (const e of events) {
      if (promptLengthTrackedSince === null || e.ts < promptLengthTrackedSince) promptLengthTrackedSince = e.ts
      const existing = firstPromptBySession.get(e.session_id)
      if (!existing || e.ts < existing.ts) firstPromptBySession.set(e.session_id, e)
    }

    const rows = sessionRows.map((r) => {
      const models = Array.isArray(r.models_used)
        ? r.models_used.filter((m) => m && m !== '<synthetic>')
        : []
      const first = firstPromptBySession.get(r.session_id)
      return {
        sessionId: r.session_id,
        client: r.client,
        createdAt: r.created_at || null,
        models: models.length ? models : ['unknown'],
        input: Number(r.total_input_tokens) || 0,
        output: Number(r.total_output_tokens) || 0,
        cacheRead: Number(r.total_cache_read) || 0,
        cost: Number(r.total_cost) || 0,
        prompts: Number(r.message_count) || 0,
        durationMinutes: Number(r.duration_minutes) || 0,
        firstPromptChars: first ? first.chars : null,
        firstPromptWords: first ? first.words : null,
      }
    })
    return { rows, promptLengthTrackedSince }
  })

  // ── Settings ────────────────────────────────────────────────────────────────
  // Path to the generated Claude settings JSON that wires the agent-status
  // hooks; the renderer passes it to `claude --settings` at launch.
  handle('hooks:settingsPath', () => hookSettingsPath)

  handle('settings:get', (_, key) => DB.getSetting(key))
  handle('settings:set', (_, key, value) => {
    DB.setSetting(key, value)
    // One global mute marker beside the generated sound hook (HookService).
    // The hook is shared across every project ACE launches an agent in, so a
    // single marker -- not a per-project file -- is what it checks.
    if (key === 'notification_sounds_muted') {
      const fs = require('fs')
      const path = require('path')
      const marker = path.join(hookDir, '.muted')
      if (value) {
        try { fs.writeFileSync(marker, '') } catch (_) {}
      } else {
        try { fs.rmSync(marker, { force: true }) } catch (_) {}
      }
    }
    // TICKET-0150: the SessionStart hook script runs standalone, outside
    // Electron/DB -- it checks this marker file directly, same pattern as
    // the mute marker above. Enabled by default, so the marker means "off".
    if (key === 'first_prompt_questionnaire_enabled') {
      const fs = require('fs')
      const path = require('path')
      const marker = path.join(hookDir, '.questionnaire-disabled')
      if (value) {
        try { fs.rmSync(marker, { force: true }) } catch (_) {}
      } else {
        try { fs.writeFileSync(marker, '') } catch (_) {}
      }
    }
    return { ok: true }
  })

  // ── File explorer / editor (TICKET-0021) ────────────────────────────────────
  // `root` comes from the renderer but is only honoured if it matches one of
  // main's registered project paths (TICKET-0075); FileService then refuses
  // any resolved file path that falls outside it.
  handle('fs:readDir', (_, { root, dirPath }) => {
    try {
      return { ok: true, entries: FileService.readDir(resolveProjectRoot(DB, root), dirPath) }
    } catch (error) {
      return { ok: false, error: error.message, code: error.code }
    }
  })

  handle('fs:readFile', (_, { root, filePath }) => {
    try {
      return FileService.readFile(resolveProjectRoot(DB, root), filePath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  handle('fs:writeFile', (_, { root, filePath, content, expectedContent }) => {
    try {
      return FileService.writeFile(resolveProjectRoot(DB, root), filePath, content, expectedContent)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // TICKET-0033: file-tree right-click actions
  handle('fs:openInExplorer', (_, { root, filePath }) => {
    try {
      return FileService.openInExplorer(resolveProjectRoot(DB, root), filePath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  handle('fs:runFile', (_, { root, filePath }) => {
    try {
      return FileService.runFile(resolveProjectRoot(DB, root), filePath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  handle('fs:rename', (_, { root, filePath, newName }) => {
    try {
      return FileService.rename(resolveProjectRoot(DB, root), filePath, newName)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  handle('fs:trash', async (_, { root, filePath }) => {
    try {
      return await FileService.trash(resolveProjectRoot(DB, root), filePath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // ── Screenshots (TICKET-0034, reworked from TICKET-0032) ───────────────────
  // Drag-to-select screen capture, saved into the requesting project's own
  // assets/images/screenshots/ folder -- see ScreenshotService for the capture-overlay
  // flow and the clipboard-path handoff.
  handle('screenshots:captureRegion', async (_, projectPath) => {
    try {
      return await ScreenshotService.captureRegion(resolveProjectRoot(DB, projectPath))
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // ── Git operations ──────────────────────────────────────────────────────────
  // The "Push update" button no longer commits from main. Its richer flow
  // (ticket → branch → local commit → PR, one branch/PR per fix) is driven by
  // the agent through the /push-update skill -- see .claude/skills/push-update/.
  // Only the no-AI pull button is handled here.
  handle('git:pull', async (_, { projectPath } = {}) => {
    let projectRoot
    try { projectRoot = resolveProjectRoot(DB, projectPath) }
    catch (error) { return { ok: false, error: error.message } }
    const { spawn } = require('child_process')

    try {
      // No `shell: true` -- with a shell, spawn re-joins argv into one string
      // and cmd.exe re-splits it on spaces, fragmenting multi-word args. git is
      // git.exe (found on PATH without a shell; libuv auto-appends .exe), so
      // shell:false both works and keeps each argv element intact.
      const proc = spawn('git', ['pull'], {
        cwd: projectRoot,
        windowsHide: true,
      })

      let stdout = ''
      let stderr = ''
      proc.stdout?.on('data', d => stdout += d)
      proc.stderr?.on('data', d => stderr += d)

      return new Promise((resolve) => {
        proc.on('error', err => resolve({ ok: false, error: err.message }))
        proc.on('close', code => {
          if (code === 0) {
            resolve({ ok: true, message: stdout || 'Pulled successfully' })
          } else {
            resolve({ ok: false, error: stderr || `git pull exited with code ${code}` })
          }
        })
      })
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // ── Project build (TICKET-0050) ──────────────────────────────────────────────
  // Runs the project's own build script (prefers `build`, falls back to
  // `package`) in whichever directory actually holds a package.json with one --
  // ACE keeps its package.json under src/ (see project_memory.md Technical
  // Debt), so a plain `<projectPath>/package.json` check would miss it. Returns
  // one settled result the renderer turns into a success/fail line; the last few
  // lines of npm output are surfaced on failure so the error is actionable
  // without opening a terminal.
  handle('project:capabilities', (_, projectPath) => {
    try { return detectBuild(resolveProjectRoot(DB, projectPath)) }
    catch (error) { return { ok: false, error: error.message } }
  })
  handle('project:build', async (_, { projectPath } = {}) => {
    let projectRoot
    try { projectRoot = resolveProjectRoot(DB, projectPath) }
    catch (error) { return { ok: false, error: error.message } }
    const { spawn } = require('child_process')
    const fs = require('fs')
    const path = require('path')

    // src/ first (ACE's own layout), then the project root.
    let capability
    try { capability = detectBuild(projectRoot) }
    catch (error) { return { ok: false, error: error.message } }
    if (!capability.ok) return capability
    const { cwd, script } = capability

    try {
      const result = await new Promise((resolve) => {
        const proc = spawn('npm', ['run', script], {
          cwd,
          windowsHide: true,
          shell: true,
        })
        let stdout = ''
        let stderr = ''
        proc.stdout?.on('data', d => stdout += d)
        proc.stderr?.on('data', d => stderr += d)
        proc.on('close', code => resolve({ code, stdout, stderr }))
        proc.on('error', err => resolve({ code: -1, stderr: err.message }))
      })
      if (result.code === 0) {
        return { ok: true, message: `Build complete (npm run ${script})` }
      }
      const tail = (result.stderr || result.stdout || '')
        .split('\n').filter(Boolean).slice(-5).join('\n')
      return { ok: false, error: tail || `Build exited with code ${result.code}` }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // ── Prerequisites (TICKET-0055) ─────────────────────────────────────────────
  // ACE spawns the real `claude`/`codex` CLIs directly (AgentService.js,
  // agentLaunch.js), so a fresh machine without them on PATH just fails every
  // agent launch with no useful guidance. Checks presence/version of node,
  // npm, and both CLIs, and can install the CLIs via their official npm
  // packages -- confirmed against this project's own working install via
  // `npm ls -g` (@anthropic-ai/claude-code, @openai/codex). Deliberately does
  // NOT attempt to install Node.js itself (see prereqs:openNodeDownload) --
  // that's a much bigger system change than two CLI packages, so the setup
  // UI links out and lets the user handle it, the same as any other
  // dev-tool prerequisite.
  const PREREQ_PACKAGES = {
    claude: '@anthropic-ai/claude-code',
    codex: '@openai/codex',
  }

  handle('prereqs:check', async () => {
    const { spawn } = require('child_process')
    // node/git resolve to real .exe's on Windows (shell:false, same reasoning
    // as git:pull above); npm/claude/codex are .cmd shims there and
    // need a shell to run at all (same convention as project:build's `npm run`
    // and AgentService.js's `spawn(provider, args, {shell: win32})`).
    const checks = [
      { name: 'node', cmd: 'node', args: ['--version'], shell: false },
      { name: 'npm', cmd: 'npm', args: ['--version'], shell: true },
      { name: 'git', cmd: 'git', args: ['--version'], shell: false },
      { name: 'claude', cmd: 'claude', args: ['--version'], shell: process.platform === 'win32' },
      { name: 'codex', cmd: 'codex', args: ['--version'], shell: process.platform === 'win32' },
    ]
    const results = {}
    await Promise.all(checks.map(({ name, cmd, args, shell: useShell }) => new Promise((resolve) => {
      let stdout = ''
      const proc = spawn(cmd, args, { windowsHide: true, shell: useShell })
      let settled = false
      const finish = result => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        results[name] = result
        resolve()
      }
      const timer = setTimeout(() => {
        finish({ present: false, version: null, error: 'Check timed out. Retry when the CLI responds.' })
        try { proc.kill() } catch (_) {}
      }, 8000)
      proc.stdout?.on('data', (d) => { stdout += d })
      proc.on('error', error => finish({ present: false, version: null, error: error.message }))
      proc.on('close', (code) => {
        finish(code === 0
          ? { present: true, version: stdout.trim().replace(/^v/, '') }
          : { present: false, version: null, error: code === null ? 'Check timed out' : 'Command unavailable' })
      })
    })))
    return results
  })

  handle('prereqs:install', async (_, name) => {
    const pkg = PREREQ_PACKAGES[name]
    if (!pkg) return { ok: false, error: `Unknown prerequisite "${name}"` }
    const { spawn } = require('child_process')

    return new Promise((resolve) => {
      const proc = spawn('npm', ['install', '-g', pkg], { windowsHide: true, shell: true })
      let stdout = ''
      let stderr = ''
      proc.stdout?.on('data', (d) => { stdout += d })
      proc.stderr?.on('data', (d) => { stderr += d })
      proc.on('error', (err) => resolve({ ok: false, error: err.message }))
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true, message: `${pkg} installed` })
          return
        }
        const raw = stderr || stdout || ''
        const tail = raw.split('\n').filter(Boolean).slice(-5).join('\n')
        const eaccesHint = /EACCES|permission denied/i.test(raw)
          ? `\n\nThis looks like an npm permissions issue, common on macOS when npm's global folder needs sudo. Try running "sudo npm install -g ${pkg}" in a terminal, or see https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally`
          : ''
        resolve({ ok: false, error: (tail || `npm install exited with code ${code}`) + eaccesHint })
      })
    })
  })

  // One-click Node.js install on Windows via winget (preinstalled on Win 11),
  // so a clean PC isn't stuck: the CLI install buttons need npm and stay
  // disabled until it exists. Other platforms keep linking out
  // (openNodeDownload) -- brew/apt/nvm isn't ours to choose. winget runs its
  // own UAC prompt; a machine-scope Node install needs it. PATH in this
  // already-running process won't pick up the new npm, so the result asks for
  // an ACE restart rather than trying to chain the CLI installs here.
  handle('prereqs:installNode', async () => {
    if (process.platform !== 'win32') return { ok: false, error: 'unsupported' }
    const { spawn } = require('child_process')
    return new Promise((resolve) => {
      const proc = spawn('winget', [
        'install', '--id', 'OpenJS.NodeJS.LTS', '--silent',
        '--accept-package-agreements', '--accept-source-agreements',
      ], { windowsHide: true, shell: true })
      let out = ''
      proc.stdout?.on('data', (d) => { out += d })
      proc.stderr?.on('data', (d) => { out += d })
      proc.on('error', (err) => resolve({ ok: false, error: err.message }))
      proc.on('close', (code) => {
        // winget exits non-zero here when Node is already installed and there's
        // no newer version to upgrade to -- a benign outcome (Node IS present),
        // not a failure. Misreading it as an error left prereqs:check's stale
        // PATH unexplained and skipped the relaunch that would actually detect it.
        const alreadyInstalled = /No available upgrade found|already installed/i.test(out)
        if (code === 0 || alreadyInstalled) {
          resolve({
            ok: true,
            message: alreadyInstalled
              ? 'Node.js is already installed — restart ACE to pick it up on PATH'
              : 'Node.js installed — restart ACE, then install the CLIs',
          })
          return
        }
        const tail = out.split('\n').filter(Boolean).slice(-5).join('\n')
        const hint = /No package found|not recognized|APPINSTALLER/i.test(out)
          ? '\n\nwinget (App Installer) may be missing — install Node from https://nodejs.org instead.'
          : ''
        resolve({ ok: false, error: (tail || `winget exited with code ${code}`) + hint })
      })
    })
  })

  // SetupView only: after a Node install, this process's PATH is stale (see
  // above), so relaunch instead of asking the user to do it. Not wired into
  // the Settings re-run path -- that can run with agent terminals already
  // open, and killing those without asking would be destructive.
  handle('prereqs:relaunch', () => {
    app.relaunch()
    app.exit(0)
  })

  // Symmetrical opposite of prereqs:install, for testing a clean setup
  // (TICKET-0126). Removes only the packages ACE installs -- node/npm/git are
  // the user's own, ACE only ever linked out for those.
  handle('prereqs:uninstall', async (_, name) => {
    const { spawn } = require('child_process')
    if (!PREREQ_PACKAGES[name]) return { ok: false, error: 'Select one provider to remove' }
    const pkgs = [PREREQ_PACKAGES[name]]
    const confirmation = await dialog.showMessageBox(getWindow(), {
      type: 'warning', buttons: ['Cancel', 'Remove globally'], defaultId: 0, cancelId: 0,
      message: `Remove ${pkgs[0]} from this machine?`,
      detail: 'This also removes the CLI from external terminals and other applications. The other provider is kept.',
    })
    if (confirmation.response !== 1) return { ok: false, error: 'Removal cancelled' }

    return new Promise((resolve) => {
      const proc = spawn('npm', ['uninstall', '-g', ...pkgs], { windowsHide: true, shell: true })
      let stdout = ''
      let stderr = ''
      proc.stdout?.on('data', (d) => { stdout += d })
      proc.stderr?.on('data', (d) => { stderr += d })
      proc.on('error', (err) => resolve({ ok: false, error: err.message }))
      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ ok: true, message: `Uninstalled ${pkgs.join(', ')}` })
          return
        }
        const raw = stderr || stdout || ''
        const tail = raw.split('\n').filter(Boolean).slice(-5).join('\n')
        resolve({ ok: false, error: tail || `npm uninstall exited with code ${code}` })
      })
    })
  })

  handle('prereqs:openNodeDownload', () => {
    shell.openExternal('https://nodejs.org')
    return { ok: true }
  })

  handle('prereqs:openGitDownload', () => {
    shell.openExternal('https://git-scm.com/downloads')
    return { ok: true }
  })

  // ── Terminal (TICKET-0019) ──────────────────────────────────────────────────
  // Keystrokes/resize/dispose are fire-and-forget (ipcMain.on) -- there's no
  // meaningful single response to a keystroke. Spawn is the one call with a
  // real result (did it start, what's its id/pid), so it's the one invoke().
  handle('terminal:spawn', async (_, opts = {}) => {
    const cwd = resolveProjectRoot(DB, opts.cwd)
    const agent = AgentSvc.agents.get(opts.agentId)
    if (!agent || fs.realpathSync.native(agent.meta.projectPath) !== cwd) throw new Error('Terminal agent and project do not match')
    const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash'
    if (opts.shell && opts.shell !== shell) throw new Error('Unsupported terminal shell')
    const dimension = (value, fallback) => {
      if (value === undefined) return fallback
      if (!Number.isInteger(value) || value < 1 || value > 500) throw new Error('Invalid terminal dimensions')
      return value
    }
    const cols = dimension(opts.cols, 80)
    const rows = dimension(opts.rows, 24)
    // Reattachment must not depend on a CLI still being installed on disk.
    if (TerminalSvc.sessions.has(opts.agentId)) return TerminalSvc.spawn({ agentId: opts.agentId })
    // Resolve through main's own project records first (TICKET-0075): the
    // renderer-supplied cwd decides where a file gets written here, so it has
    // to be a path ACE already knows about, not whatever string arrived.
    try {
      ensureBundledSkills(cwd, getScaffoldDir())
    } catch (_) {}
    const { buildLaunchCommand } = await import('../services/agentLaunch.mjs')
    if (AgentSvc.agents.get(opts.agentId) !== agent) throw new Error('Agent stopped during startup')
    const sessionId = agent.meta.provider === 'claude' ? require('node:crypto').randomUUID() : null
    const launch = resolveLaunchPolicy({ provider: agent.meta.provider, model: agent.meta.model, projectId: agent.meta.projectId }, { getSetting: key => DB.getSetting(key) })
    const command = buildLaunchCommand({ ...agent.meta, ...launch }, sessionId, hookSettingsPath, process.platform, providerExecutable(launch.provider))
    const result = await TerminalSvc.spawn({ agentId: opts.agentId, cwd, shell, cols, rows, command })
    if (result.success && !result.reconnected && sessionId) DB.recordAgentSession({ session_id: sessionId, agent_id: opts.agentId, project_id: agent.meta.projectId, agent_name: agent.meta.label })
    return result
  })
  on('terminal:write', (_, { id, data } = {}) => TerminalSvc.write(id, data))
  on('terminal:resize', (_, { id, cols, rows } = {}) => {
    if ([cols, rows].every(n => Number.isInteger(n) && n > 0 && n <= 500)) TerminalSvc.resize(id, cols, rows)
  })
  // Renderer unmount only detaches; explicit agent stop/removal owns disposal.
  on('terminal:setAutoAnswer', (_, { id, enabled } = {}) => TerminalSvc.setAutoAnswer(id, enabled))

  // ── Processes panel ─────────────────────────────────────────────────────────
  const ELECTRON_TYPE_LABELS = {
    Browser: 'Main Process',
    Tab: 'Renderer (UI)',
    GPU: 'GPU Compositor',
    Utility: 'Utility Service',
    Zygote: 'Zygote',
  }

  handle('processes:list', () => {
    const metrics = app.getAppMetrics()
    const ptyHostPid = TerminalSvc?.host?.pid || null

    const internal = metrics.map((m) => ({
      kind: 'internal',
      pid: m.pid,
      label: m.pid === ptyHostPid
        ? 'PTY Host (terminals)'
        : (ELECTRON_TYPE_LABELS[m.type] || m.serviceName || m.type),
      memoryKB: Math.round(m.memory.workingSetSize),
      cpu: +(m.cpu.percentCPUUsage.toFixed(1)),
    }))

    const agents = AgentSvc.getRunning().filter(a => TerminalSvc.sessions.get(a.agentId)?.state === 'running').map((a) => ({
      kind: 'agent',
      pid: TerminalSvc.sessions.get(a.agentId)?.pid || null,
      label: a.label,
      provider: a.provider,
      model: a.model,
      memoryKB: null,
      cpu: null,
    }))

    return { internal, agents }
  })
}

module.exports = { registerHandlers, resolveProjectRoot, assertAppSender }
