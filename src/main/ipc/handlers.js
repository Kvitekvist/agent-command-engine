const { dialog } = require('electron')
const { LoadBalancer } = require('../services/LoadBalancer')
const { OptimizationAdvisor } = require('../services/OptimizationAdvisor')
const { FileService } = require('../services/FileService')
const { TokscaleService, pathToWorkspaceKey } = require('../services/TokscaleService')
const { ScreenshotService } = require('../services/ScreenshotService')

function registerHandlers(ipcMain, mainWindow, DB, AgentSvc, TerminalSvc) {
  // Keep window ref updated
  AgentSvc.setWindow(mainWindow)
  if (TerminalSvc) TerminalSvc.setWindow(mainWindow)

  // ── Projects ────────────────────────────────────────────────────────────────
  ipcMain.handle('projects:getAll', () => DB.getProjects())

  ipcMain.handle('projects:add', (_, name, folderPath) => {
    DB.addProject(name, folderPath)
    return DB.getProjects()
  })

  ipcMain.handle('projects:remove', (_, id) => {
    DB.removeProject(id)
    return DB.getProjects()
  })

  ipcMain.handle('projects:pickFolder', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
    if (result.canceled) return null
    return result.filePaths[0]
  })

  ipcMain.handle('projects:createFromTemplate', async (_, projectName) => {
    const fs = require('fs')
    const path = require('path')

    // Template source
    const templatePath = 'C:\\Users\\JensPetterRøyseth\\Documents\\VS Code\\Template'

    // Ask user where to create the new project
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select where to create the new project'
    })
    if (result.canceled) return null

    const parentDir = result.filePaths[0]
    const newProjectPath = path.join(parentDir, projectName)

    // Check if directory already exists
    if (fs.existsSync(newProjectPath)) {
      return { error: 'A folder with this name already exists in the selected location' }
    }

    // Copy template to new location
    try {
      await fs.promises.cp(templatePath, newProjectPath, { recursive: true })
      return { path: newProjectPath }
    } catch (error) {
      return { error: error.message }
    }
  })

  // ── Agents ──────────────────────────────────────────────────────────────────
  ipcMain.handle('agents:getByProject', (_, projectId) => {
    return DB.getAgentsByProject(projectId)
  })

  ipcMain.handle('agents:start', (_, { projectId, projectPath, label, provider, model, permissionMode }) => {
    const resolvedProvider = LoadBalancer.decide({ manualProvider: provider, projectId })
    const resolvedMode = permissionMode || 'safe'
    const result = AgentSvc.start({ projectId, projectPath, label, provider: resolvedProvider, model, permissionMode: resolvedMode })
    DB.upsertAgent({
      id: result.agentId,
      project_id: projectId,
      label,
      provider: resolvedProvider,
      model,
      status: 'running',
      permission_mode: resolvedMode,
    })
    return result
  })

  // Re-register agents persisted from a previous run (app reopened, or the
  // project was reselected) so their history + session can be resumed.
  ipcMain.handle('agents:restore', (_, { id, project_id, projectPath, label, provider, model, permission_mode, session_id }) => {
    return AgentSvc.restore({
      agentId: id,
      projectId: project_id,
      projectPath,
      label,
      provider,
      model,
      permissionMode: permission_mode,
      sessionId: session_id,
    })
  })

  ipcMain.handle('agents:stop', (_, agentId) => {
    AgentSvc.stop(agentId)
    DB.updateAgentStatus(agentId, 'stopped')
    return { ok: true }
  })

  // Removes an agent from the interface entirely. Stops the process first
  // (no-op if it's already stopped) so a delete can never orphan a subprocess.
  ipcMain.handle('agents:delete', (_, agentId) => {
    AgentSvc.stop(agentId)
    DB.deleteAgent(agentId)
    return { ok: true }
  })

  // TICKET-0044: the renderer forces a known session id per Claude agent
  // launch (`claude --session-id <uuid>`) and reports it here so the Token
  // Usage tab's "By Agent" breakdown can join tokscale's per-session rows
  // back to real agent names. Fire-and-forget from the renderer's side.
  ipcMain.handle('agents:recordSession', (_, payload) => {
    DB.recordAgentSession(payload || {})
    return { ok: true }
  })

  // Only this action may wipe a persisted conversation.
  ipcMain.handle('agents:clearContext', (_, agentId) => {
    const result = AgentSvc.clearContext(agentId)
    DB.clearAgentHistory(agentId)
    return result
  })

  // Track each process invocation independently. Keying by execution rather
  // than agent prevents an old close event from completing a newer prompt.
  const inFlight = new Map()

  ipcMain.handle('agents:sendPrompt', async (_, agentId, prompt) => {
    const agent = AgentSvc.agents.get(agentId)
    if (!agent) return { error: 'Agent not found' }

    const startedAt = Date.now()

    // Log prompt row immediately with zero tokens — updated on completion
    const promptId = DB.logPrompt({
      agent_id: agentId,
      project_id: agent.meta.projectId,
      task_label: agent.meta.label,
      prompt_text: prompt,
      response_text: null,
      provider: agent.meta.provider,
      model: agent.meta.model,
      input_tokens: 0,
      output_tokens: 0,
      duration_ms: 0,
    })
    const result = AgentSvc.sendPrompt(agentId, prompt)
    if (result.error) {
      DB.updatePromptTokens(promptId, {
        response_text: result.error,
        input_tokens: 0,
        output_tokens: 0,
        duration_ms: Date.now() - startedAt,
      })
      return result
    }
    inFlight.set(result.executionId, { promptId, startedAt })
    return result
  })

  // When a prompt completes, update the DB row with the fast stdout-parsed
  // token counts + response. Kept in `inFlight` a while longer (instead of
  // deleting here) so the async 'agent:tokens-reconciled' correction below
  // — which lands a moment later, once tokscale resolves — still has the
  // promptId to apply itself to.
  AgentSvc.on('agent:prompt-done', (data) => {
    if (data.sessionId) {
      DB.updateAgentSession(data.agentId, data.sessionId)
    }
    const flight = inFlight.get(data.executionId)
    if (!flight || flight.promptId == null) return
    DB.updatePromptTokens(flight.promptId, {
      response_text: data.response || data.error || null,
      input_tokens: data.tokens?.input || 0,
      output_tokens: data.tokens?.output || 0,
      duration_ms: Date.now() - flight.startedAt,
    })
    // Reconciliation either lands or is skipped (e.g. codex, tokscale
    // unavailable) well within this window; whichever happens first, the
    // entry must not leak for the lifetime of the app.
    setTimeout(() => inFlight.delete(data.executionId), 30_000)
  })

  // Corrects a prompt row's token/cost columns once TokscaleService's
  // reconciliation resolves (see AgentService._reconcileTokens). Never fires
  // for codex — it has no stable session id to reconcile against.
  AgentSvc.on('agent:tokens-reconciled', (data) => {
    const flight = inFlight.get(data.executionId)
    if (!flight || flight.promptId == null) return
    DB.updatePromptUsage(flight.promptId, {
      input_tokens: data.tokens.input,
      output_tokens: data.tokens.output,
      cache_read_tokens: data.tokens.cacheRead,
      cache_creation_tokens: data.tokens.cacheCreation,
      cost_usd: data.costUsd,
    })
  })

  // ── Audit log ───────────────────────────────────────────────────────────────
  ipcMain.handle('prompts:get', (_, filters) => DB.getPrompts(filters || {}))
  ipcMain.handle('prompts:getById', (_, id) => DB.getPromptById(id))

  // ── Token stats ─────────────────────────────────────────────────────────────
  ipcMain.handle('tokens:getStats', (_, filters) => DB.getTokenStats(filters || {}))

  // TICKET-0044: "History (this project)" — real per-session usage for the
  // active project, straight from tokscale (the `prompts` table this used to
  // read has been dead since TICKET-0019). Rows are scoped to the project's
  // workspace key, then annotated with the ACE agent that owns each session
  // (via agent_sessions) so the renderer can build Totals / By Day / By Model /
  // By Agent without any per-model or per-day tokscale calls. Sessions with no
  // recorded owner (Codex, or anything from before this shipped) are labelled
  // "Untracked". Returns a normalized, flat row list; the renderer aggregates.
  ipcMain.handle('tokens:getProjectHistory', async (_, { projectId, projectPath } = {}) => {
    if (!projectPath) return { rows: [] }
    const workspaceKey = pathToWorkspaceKey(projectPath)
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
        agentLabel: owner?.label || 'Untracked',
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
  ipcMain.handle('tokens:getLiveUsage', async () => {
    const clients = ['claude', 'codex']
    const result = {}
    for (const c of clients) result[c] = { plan: null, quota: [], models: [], projects: [], totalTokens: 0 }

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
        }
      }
    } catch (error) {
      for (const c of clients) result[c].breakdownError = error.message
    }

    return result
  })

  // ── Settings ────────────────────────────────────────────────────────────────
  ipcMain.handle('settings:get', (_, key) => DB.getSetting(key))
  ipcMain.handle('settings:set', (_, key, value) => {
    DB.setSetting(key, value)
    return { ok: true }
  })

  // ── Optimization advisor ────────────────────────────────────────────────────
  ipcMain.handle('optimize:analyze', (_, projectId) => OptimizationAdvisor.analyze(projectId))

  // ── File explorer / editor (TICKET-0021) ────────────────────────────────────
  // `root` is always the requesting project's path (as the renderer already
  // knows it) -- FileService refuses any resolved path that falls outside it.
  ipcMain.handle('fs:readDir', (_, { root, dirPath }) => {
    try {
      return { ok: true, entries: FileService.readDir(root, dirPath) }
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('fs:readFile', (_, { root, filePath }) => {
    try {
      return FileService.readFile(root, filePath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('fs:writeFile', (_, { root, filePath, content }) => {
    try {
      return FileService.writeFile(root, filePath, content)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // TICKET-0033: file-tree right-click actions
  ipcMain.handle('fs:openInExplorer', (_, { root, filePath }) => {
    try {
      return FileService.openInExplorer(root, filePath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  ipcMain.handle('fs:runFile', (_, { root, filePath }) => {
    try {
      return FileService.runFile(root, filePath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // ── Screenshots (TICKET-0034, reworked from TICKET-0032) ───────────────────
  // Drag-to-select screen capture, saved into the requesting project's own
  // .cpi/screenshots/ folder -- see ScreenshotService for the capture-overlay
  // flow and the clipboard-path handoff.
  ipcMain.handle('screenshots:captureRegion', async (_, projectPath) => {
    try {
      return await ScreenshotService.captureRegion(projectPath)
    } catch (error) {
      return { ok: false, error: error.message }
    }
  })

  // ── Terminal (TICKET-0019) ──────────────────────────────────────────────────
  // Keystrokes/resize/dispose are fire-and-forget (ipcMain.on) -- there's no
  // meaningful single response to a keystroke. Spawn is the one call with a
  // real result (did it start, what's its id/pid), so it's the one invoke().
  ipcMain.handle('terminal:spawn', (_, opts) => TerminalSvc.spawn(opts))
  ipcMain.on('terminal:write', (_, { id, data } = {}) => TerminalSvc.write(id, data))
  ipcMain.on('terminal:resize', (_, { id, cols, rows } = {}) => TerminalSvc.resize(id, cols, rows))
  ipcMain.on('terminal:dispose', (_, { id } = {}) => TerminalSvc.dispose(id))
  ipcMain.on('terminal:setAutoAnswer', (_, { id, enabled } = {}) => TerminalSvc.setAutoAnswer(id, enabled))
}

module.exports = { registerHandlers }
